import { useMemo, useState } from 'react'
import { isSupabaseConfigured, resetPassword, signIn, signUp } from '../lib/supabase'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { safeLocalStorageSet } from '../lib/browserStorage'
import { DEMO_USER, DEMO_SESSION_KEY } from '../lib/demoSession'
import { CURRENT_STUDENT_COHORTS, signInCohortLearner } from '../lib/cohortLearner'

export default function AuthModal({ isOpen, onClose, onSuccess }) {
    const [mode, setMode] = useState('signin')
    const [entryMode, setEntryMode] = useState('course')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [studentName, setStudentName] = useState('')
    const [studentCohort, setStudentCohort] = useState(CURRENT_STUDENT_COHORTS.find((cohort) => !cohort.requiresStudyId)?.id || CURRENT_STUDENT_COHORTS[0].id)
    const [accountType, setAccountType] = useState('learner')
    const [fullName, setFullName] = useState('')
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

    const chooseEntryMode = (nextMode) => {
        setEntryMode(nextMode)
        setError('')
        setStudentError('')
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
                studyId: '',
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
                if (accountType === 'instructor' && fullName.trim().length < 2) throw new Error('Enter your full name to apply as an instructor.')
                const { error: signUpError } = await signUp(email, password, accountType === 'instructor'
                    ? { full_name: fullName.trim(), requested_role: 'instructor' }
                    : { requested_role: 'learner' })
                if (signUpError) throw signUpError
                setMessage(accountType === 'instructor'
                    ? 'Application submitted. Confirm your email, then wait for a course administrator to approve your instructor account.'
                    : 'Check your email for a confirmation link before signing in.')
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
            className="ath-auth-overlay fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.42)] px-4 backdrop-blur-md"
            onClick={(event) => {
                if (event.target === event.currentTarget) onClose()
            }}
        >
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="auth-modal-title"
                className="ath-auth-dialog w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-[var(--ath-radius-lg)] border border-[var(--ath-line)] bg-[var(--ath-surface-strong)] shadow-[0_24px_64px_rgba(15,23,42,0.2)]"
            >
                <div className="border-b border-[var(--ath-line)] bg-[var(--ath-panel-muted)] px-6 py-5">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="editorial-kicker">The Scholarly Editorial</p>
                            <h2 id="auth-modal-title" className="mt-2 text-2xl font-semibold tracking-tight text-[var(--ath-text)]">
                                {entryMode === 'course' ? 'Open your course' : entryMode === 'demo' ? 'Preview ALGET' : copy[mode].title}
                            </h2>
                            <p className="mt-1.5 text-sm leading-6 text-[var(--ath-muted)]">
                                {entryMode === 'course' ? 'Choose your cohort and continue to the assigned learning path.' : entryMode === 'demo' ? 'Explore the workspace with sample learner data.' : copy[mode].subtitle}
                            </p>
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

                <div className="px-6 py-5">
                    {!isSupabaseConfigured && (
                        <div className="mb-4 border-l-2 border-[var(--ath-primary)] bg-[var(--ath-panel-muted)] px-3 py-2.5 text-sm leading-6 text-[var(--ath-primary-deep)]">
                            Cloud authentication is not configured in this environment. Course entry and preview mode are available locally; account sign-in requires the hosted auth service.
                        </div>
                    )}

                    <div className="mb-5">
                        <p className="editorial-label">Choose how to continue</p>
                        <div className="mt-3 grid gap-2 sm:grid-cols-3" role="group" aria-label="Choose how to continue">
                            {[
                                ['course', 'Course learner', 'Name + cohort'],
                                ['account', 'ALGET account', 'Email + password'],
                                ['demo', 'Preview demo', 'No account needed'],
                            ].map(([value, label, detail]) => (
                                <button
                                    key={value}
                                    type="button"
                                    aria-pressed={entryMode === value}
                                    onClick={() => chooseEntryMode(value)}
                                    className={`rounded-[1.1rem] border px-3 py-3 text-left transition-colors ${entryMode === value
                                        ? 'border-[var(--ath-primary)] bg-[var(--ath-panel-muted)] text-[var(--ath-primary-deep)]'
                                        : 'border-[var(--ath-line)] bg-[var(--ath-surface-strong)] text-[var(--ath-secondary)] hover:bg-white'
                                        }`}
                                >
                                    <span className="block text-sm font-semibold">{label}</span>
                                    <span className="mt-1 block text-xs text-[var(--ath-muted)]">{detail}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {entryMode === 'course' && <form onSubmit={handleStudentEntry} className="mb-5 border-b border-[var(--ath-line)] pb-5">
                        <p className="editorial-label">Current students</p>
                        <p className="mt-2 text-sm leading-6 text-[var(--ath-muted)]">
                            Enter your name and course cohort to open the assigned learning path. Research participants should use the invitation-bound account supplied by the research coordinator instead.
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                            <a
                                href="/guides/cat100/index.html"
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-full border border-[var(--ath-line)] bg-[var(--ath-surface-strong)] px-3 py-1.5 text-[var(--ath-primary)] transition-colors hover:bg-white"
                            >
                                CAT 100 guide
                            </a>
                            <a
                                href="/guides/cat531/index.html"
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-full border border-[var(--ath-line)] bg-[var(--ath-surface-strong)] px-3 py-1.5 text-[var(--ath-primary)] transition-colors hover:bg-white"
                            >
                                CAT 531 guide
                            </a>
                        </div>
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
                                    {CURRENT_STUDENT_COHORTS.filter((cohort) => !cohort.requiresStudyId).map((cohort) => (
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
                    </form>}

                    {entryMode === 'account' && <form onSubmit={handleSubmit} className="space-y-4">
                        <p className="editorial-label">Account sign in</p>
                        <p className="text-sm leading-6 text-[var(--ath-muted)]">
                            Research participants must use the invitation-bound account supplied by the coordinator. Do not create a second account for the study.
                            Contact fields are excluded from outcomes and telemetry; approved gift-card delivery details belong only in the separate compensation form.
                        </p>
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
                            mode === 'signup' && <div>
                                <label htmlFor="account-type" className="editorial-label mb-2 block">Account type</label>
                                <select id="account-type" value={accountType} onChange={(event) => setAccountType(event.target.value)} className="editorial-input">
                                    <option value="learner">Learner</option>
                                    <option value="instructor">Instructor (requires administrator approval)</option>
                                </select>
                            </div>
                        )}

                        {mode === 'signup' && accountType === 'instructor' && (
                            <div>
                                <label htmlFor="instructor-full-name" className="editorial-label mb-2 block">Full name</label>
                                <input id="instructor-full-name" type="text" value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Your full name" className="editorial-input" autoComplete="name" required />
                            </div>
                        )}

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
                    </form>}

                    {entryMode === 'demo' && <div className="rounded-[1.2rem] border border-[var(--ath-line)] bg-[var(--ath-panel-muted)] p-4">
                        <p className="editorial-label">Preview only</p>
                        <p className="mt-2 text-sm leading-6 text-[var(--ath-muted)]">
                            Explore the learner workspace with sample data. Demo progress is local to this browser and is not a participant or course record.
                        </p>
                        <button
                            type="button"
                            onClick={enterDemoMode}
                            className="editorial-button mt-4 w-full px-4 py-3 text-sm"
                        >
                            Continue in Demo Mode
                        </button>
                    </div>}

                    {entryMode === 'account' && <div className="mt-5 border-t border-[var(--ath-line)] pt-4">
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
                    </div>}

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
