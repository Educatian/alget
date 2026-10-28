import { useState } from 'react'
import { ID_PREFIX, signIn } from '../lib/account'

const MESSAGES = {
    bad_credentials: 'That ID and password do not match. Check both and try again.',
    locked: 'Too many tries for this ID. Wait a few minutes, then try again.',
    network: 'Could not reach the server. Check your connection and try again.',
}

/** Sign-in for the accounts preview: a roster ID (TAMU-001, UTK-001 ...) and the password from the instructor. */
export default function SignIn({ onSignedIn }) {
    const [id, setId] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [busy, setBusy] = useState(false)

    async function submit(event) {
        event.preventDefault()
        setBusy(true)
        setError('')
        const result = await signIn(id, password)
        setBusy(false)
        if (result.error) {
            setError(MESSAGES[result.error] || 'Sign-in did not work. Try again in a moment.')
            return
        }
        onSignedIn(result)
    }

    return (
        <div className="editorial-shell flex min-h-screen items-center justify-center bg-[var(--ath-background)] px-4">
            <form
                onSubmit={submit}
                className="w-full max-w-sm rounded-3xl border border-[var(--ath-line)] bg-[var(--ath-panel)] p-8 shadow-lg"
                aria-labelledby="signin-title"
            >
                <p className="editorial-kicker">AI Literacy</p>
                <h1 id="signin-title" className="mt-1 text-2xl font-semibold text-[var(--ath-text)]">Sign in</h1>
                <p className="mt-2 text-sm text-[var(--ath-muted)]">
                    Use the student ID and password your instructor gave you. Your notes, progress and written activities are saved to your ID, and your instructor can see your progress and written activities.
                </p>

                <label htmlFor="signin-id" className="mt-6 block text-sm font-medium text-[var(--ath-text)]">Student ID</label>
                <input
                    id="signin-id"
                    value={id}
                    onChange={(e) => setId(e.target.value)}
                    placeholder={`${ID_PREFIX}-001`}
                    autoComplete="username"
                    autoCapitalize="characters"
                    spellCheck={false}
                    required
                    className="mt-1 w-full rounded-xl border border-[var(--ath-line)] bg-white px-3 py-2 text-base text-[var(--ath-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(15,81,103,0.28)]"
                />

                <label htmlFor="signin-password" className="mt-4 block text-sm font-medium text-[var(--ath-text)]">Password</label>
                <input
                    id="signin-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="word-word-number"
                    autoComplete="current-password"
                    autoCapitalize="none"
                    spellCheck={false}
                    required
                    className="mt-1 w-full rounded-xl border border-[var(--ath-line)] bg-white px-3 py-2 text-base text-[var(--ath-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(15,81,103,0.28)]"
                />

                {error && <p role="alert" className="mt-4 rounded-xl bg-[rgba(254,242,242,0.9)] px-3 py-2 text-sm text-red-800">{error}</p>}

                <button
                    type="submit"
                    disabled={busy}
                    className="mt-6 w-full rounded-xl bg-[var(--ath-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--ath-background)] shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                    {busy ? 'Signing in…' : 'Sign in'}
                </button>
            </form>
        </div>
    )
}
