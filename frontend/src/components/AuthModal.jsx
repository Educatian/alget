import { useMemo, useState } from 'react'
import { isSupabaseConfigured, resetPassword, signIn, signUp } from '../lib/supabase'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { safeLocalStorageSet } from '../lib/browserStorage'
import { DEMO_USER, DEMO_SESSION_KEY } from '../lib/demoSession'
import { CURRENT_STUDENT_COHORTS, signInCohortLearner } from '../lib/cohortLearner'

export default function AuthModal({ isOpen, onClose, onSuccess }) {
    const [mode, setMode] = useState('signin')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [studentName, setStudentName] = useState('')
    const [studentCohort, setStudentCohort] = useState(CURRENT_STUDENT_COHORTS[0].id)
    const [loading, setLoading] = useState(false)
    const [studentLoading, setStudentLoading] = useState(false)
    const [error, setError] = useState('')
    const [studentError, setStudentError] = useState('')
    const [message, setMessage] = useState('')

    const dialogRef = useFocusTrap(isOpen, onClose)

    const copy = useMemo(() => ({
        signin: {
            title: 'Welcome Back',
            subtitle: 'Sign in to continue learning',
            action: 'Sign In'
        },
        signup: {
            title: 'Create Your Workspace',
            subtitle: 'Start with a learner account or continue in demo mode',
            action: 'Create Account'
        },
        forgot: {
            title: 'Reset Password',
            subtitle: 'We will send a password reset link to your inbox',
            action: 'Send Reset Link'
        }
    }), [])

    if (!isOpen) return null

    const switchMode = (nextMode) => {
        setMode(nextMode)
        setError('')
        setMessage('')
    }

    const enterDemoMode = () => {
        // Persist the demo session so it survives reloads and direct section URLs
        // (the hosted demo is shareable; App restores this on load).
        safeLocalStorageSet(DEMO_SESSION_KEY, JSON.stringify(DEMO_USER))
        onSuccess?.(DEMO_USER)
    }

    const handleStudentEntry = async (event) => {
        event.preventDefault()
        setStudentLoading(true)
        setStudentError('')
        setError('')
        setMessage('')

        try {
            const user = await signInCohortLearner({
                cohortId: studentCohort,
                fullName: studentName,
            })
            onSuccess?.(user, { redirectTo: '/learn' })
        } catch (err) {
            setStudentError(err?.message || 'Unable to open your student course right now.')
        } finally {
            setStudentLoading(false)
        }
    }

    const handleSubmit = async (event) => {
        event.preventDefault()
        setLoading(true)
        setError('')
        setMessage('')

        try {
            if (!isSupabaseConfigured && mode !== 'forgot') {
                setMessage('Supabase is not configured locally. Use demo mode below to continue testing the product flow.')
                return
            }

            if (mode === 'signin') {
                const { data, error: signInError } = await signIn(email, password)
                if (signInError) throw signInError
                onSuccess?.(data.user)
                return
            }

            if (mode === 'signup') {
                const { error: signUpError } = await signUp(email, password)
                if (signUpError) throw signUpError
                setMessage('Check your email for a confirmation link before signing in.')
                return
            }

            const { error: resetError } = await resetPassword(email)
            if (resetError) throw resetError
            setMessage('Password reset email sent. Return here after you update your password.')
        } catch (err) {
            const errorMessage = err?.message || 'An unexpected authentication error occurred.'

            if (errorMessage.includes('Invalid login credentials')) {
                setError('That email and password do not match. Try again or continue in demo mode.')
            } else if (errorMessage.includes('User already registered')) {
                setError('This email is already registered. Sign in instead of creating a new account.')
            } else if (errorMessage.includes('Email not confirmed')) {
                setError('Please confirm your email first, then return here to sign in.')
            } else if (errorMessage.includes('Supabase not configured')) {
                setError('Cloud auth is unavailable in this local setup. Use demo mode to keep testing.')
            } else {
                setError(errorMessage)
            }
        } finally {
            setLoading(false)
        }
    }

    return (
        // Backdrop click dismisses the dialog. The keyboard-equivalent
        // dismissal (Escape) is handled by useFocusTrap, so a key handler on
        // this presentational overlay would be redundant.
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.42)] px-4 backdrop-blur-md"
            onClick={(event) => {
                if (event.target === event.currentTarget) onClose()
            }}
        >
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="auth-modal-title"
                className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-[2rem] border border-[var(--ath-line)] bg-[var(--ath-surface-strong)] shadow-[0_32px_80px_rgba(15,23,42,0.22)]"
            >
                <div className="border-b border-[var(--ath-line)] bg-[var(--ath-panel-muted)] px-8 py-7">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="editorial-kicker">The Scholarly Editorial</p>
                            <h2 id="auth-modal-title" className="mt-3 text-3xl font-semibold tracking-tight text-[var(--ath-text)]">{copy[mode].title}</h2>
                            <p className="mt-2 text-sm leading-7 text-[var(--ath-muted)]">{copy[mode].subtitle}</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="rounded-full border border-[var(--ath-line)] bg-[var(--ath-surface-strong)] px-3 py-1.5 text-sm font-semibold text-[var(--ath-secondary)] transition-colors hover:text-[var(--ath-text)]"
                            aria-label="Close sign in dialog"
                        >
                            Close
                        </button>
                    </div>
                </div>

                <div className="px-8 py-7">
                    {!isSupabaseConfigured && (
                        <div className="mb-5 rounded-[1.3rem] border border-[var(--ath-line)] bg-[var(--ath-panel-muted)] px-4 py-4 text-sm leading-7 text-[var(--ath-primary-deep)]">
                            Local demo mode is active. Cloud authentication is not configured in this environment, so the fastest path is to continue with a sample learner.
                        </div>
                    )}

                    <form onSubmit={handleStudentEntry} className="mb-6 rounded-[1.4rem] border border-[var(--ath-line)] bg-[var(--ath-panel)] p-4">
                        <p className="editorial-label">Current students</p>
                        <p className="mt-2 text-sm leading-6 text-[var(--ath-muted)]">
                            CAT 531 and CAT 100 summer students can enter with their name so progress is tied to the right learner.
                        </p>
                        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_0.9fr]">
                            <div>
                                <label htmlFor="student-name" className="editorial-label mb-2 block">Name</label>
                                <input
                                    id="student-name"
                                    type="text"
                                    value={studentName}
                                    onChange={(event) => setStudentName(event.target.value)}
                                    placeholder="Your full name"
                                    className="editorial-input"
                                    autoComplete="name"
                                    required
                                />
                            </div>
                            <div>
                                <label htmlFor="student-cohort" className="editorial-label mb-2 block">Cohort</label>
                                <select
                                    id="student-cohort"
                                    value={studentCohort}
                                    onChange={(event) => setStudentCohort(event.target.value)}
                                    className="editorial-input"
                                >
                                    {CURRENT_STUDENT_COHORTS.map((cohort) => (
                                        <option key={cohort.id} value={cohort.id}>{cohort.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        {studentError && (
                            <div className="mt-3 rounded-[1.2rem] border border-[color-mix(in_srgb,var(--ath-danger)_32%,transparent)] bg-[color-mix(in_srgb,var(--ath-danger)_12%,var(--ath-panel))] px-4 py-3 text-sm font-medium text-[var(--ath-danger)]">
                                {studentError}
                            </div>
                        )}
                        <button
                            type="submit"
                            disabled={studentLoading}
                            className="editorial-button mt-4 w-full px-5 py-3 text-sm disabled:opacity-60"
                        >
                            {studentLoading ? 'Opening course...' : 'Enter my course'}
                        </button>
                    </form>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="auth-email" className="editorial-label mb-2 block">Email</label>
                            <input
                                id="auth-email"
                                type="email"
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                                placeholder="your@email.com"
                                className="editorial-input"
                                required
                            />
                        </div>

                        {mode !== 'forgot' && (
                            <div>
                                <div className="mb-2 flex items-center justify-between gap-3">
                                    <label htmlFor="auth-password" className="editorial-label">Password</label>
                                    {mode === 'signin' && (
                                        <button
                                            type="button"
                                            onClick={() => switchMode('forgot')}
                                            className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ath-secondary)] transition-colors hover:text-[var(--ath-primary)]"
                                        >
                                            Forgot password
                                        </button>
                                    )}
                                </div>
                                <input
                                    id="auth-password"
                                    type="password"
                                    value={password}
                                    onChange={(event) => setPassword(event.target.value)}
                                    placeholder="Minimum 6 characters"
                                    className="editorial-input"
                                    minLength={6}
                                    required
                                />
                            </div>
                        )}

                        {error && (
                            <div className="rounded-[1.2rem] border border-[color-mix(in_srgb,var(--ath-danger)_32%,transparent)] bg-[color-mix(in_srgb,var(--ath-danger)_12%,var(--ath-panel))] px-4 py-3 text-sm font-medium text-[var(--ath-danger)]">
                                {error}
                            </div>
                        )}

                        {message && (
                            <div className="rounded-[1.2rem] border border-[color-mix(in_srgb,var(--ath-primary)_28%,transparent)] bg-[color-mix(in_srgb,var(--ath-primary)_10%,var(--ath-panel))] px-4 py-3 text-sm font-medium text-[var(--ath-primary-deep)]">
                                {message}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="editorial-button w-full px-5 py-3.5 text-sm disabled:opacity-60"
                        >
                            {loading ? 'Working...' : copy[mode].action}
                        </button>
                    </form>

                    <div className="mt-6 rounded-[1.4rem] border border-[var(--ath-line)] bg-[var(--ath-panel)] p-4">
                        <p className="editorial-label">Testing and demo</p>
                        <div className="mt-3 flex flex-wrap gap-3">
                            <button
                                type="button"
                                onClick={enterDemoMode}
                                className="editorial-button-secondary px-4 py-2 text-sm"
                            >
                                Continue in Demo Mode
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setEmail('demo@alget.local')
                                    setPassword('demo1234')
                                    switchMode('signin')
                                }}
                                className="editorial-button-secondary px-4 py-2 text-sm"
                            >
                                Fill Sample Credentials
                            </button>
                        </div>
                    </div>

                    <div className="mt-6 text-center text-sm">
                        {mode === 'signin' && (
                            <p className="text-[var(--ath-muted)]">
                                Need an account?{' '}
                                <button
                                    type="button"
                                    onClick={() => switchMode('signup')}
                                    className="font-semibold text-[var(--ath-primary)]"
                                >
                                    Sign Up
                                </button>
                            </p>
                        )}
                        {mode === 'signup' && (
                            <p className="text-[var(--ath-muted)]">
                                Already have an account?{' '}
                                <button
                                    type="button"
                                    onClick={() => switchMode('signin')}
                                    className="font-semibold text-[var(--ath-primary)]"
                                >
                                    Sign In
                                </button>
                            </p>
                        )}
                        {mode === 'forgot' && (
                            <button
                                type="button"
                                onClick={() => switchMode('signin')}
                                className="font-semibold text-[var(--ath-primary)]"
                            >
                                Back to Sign In
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
