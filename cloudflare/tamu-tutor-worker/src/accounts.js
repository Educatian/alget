/**
 * TAMU preview accounts: sign-in with a roster ID (TAMU-001 ...) and password, sessions, and
 * per-ID progress.
 *
 *   ACCOUNTS KV  account:<ID>  {salt, hash, iter}   PBKDF2-SHA256 of the password (scripts/make_accounts.mjs)
 *                fail:<ID>     failed sign-ins       expires after LOCK_MINUTES
 *   DB (D1)      sessions      SHA-256 of the token, ID, expiry (migrations/0002)
 *                progress      one row per (ID, browser storage key)
 *
 * Sessions and progress live in D1 because KV is eventually consistent: a session written at
 * sign-in could look missing for up to a minute from another location, signing the student out.
 *
 * Progress holds only the reader's own browser data (highlights and notes, written activities, review schedule,
 * mastery, reader settings), restricted to the keys in PROGRESS_KEY.
 */

const SESSION_DAYS = 30
const MAX_FAILS = 8
const LOCK_MINUTES = 15
const MAX_VALUE = 200_000
const MAX_TOTAL = 2_000_000

export const PROGRESS_KEY = /^((alget_highlights_v1|alget_activity_v1):[a-z0-9-]+\/\d\d\/\d\d|alget_review_v1|alget_local_mastery_v1|alget_adaptive_signals_v1|alget_reader_prefs_v1|alget_onboarding_completed_v1)$/

/** Accepts "TAMU-007", "tamu007" or just "7". */
export function normalizeId(raw) {
    const digits = String(raw || '').trim().toUpperCase().replace(/^TAMU-?/, '')
    return /^\d{1,3}$/.test(digits) ? `TAMU-${digits.padStart(3, '0')}` : null
}

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
const unhex = (s) => new Uint8Array(s.match(/../g).map((h) => parseInt(h, 16)))

export async function hashPassword(password, saltHex, iterations) {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
    return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: unhex(saltHex), iterations, hash: 'SHA-256' }, key, 256))
}

function sameHex(a, b) {
    if (a.length !== b.length) return false
    let diff = 0
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
    return diff === 0
}

/** Returns [body, status]. */
export async function login(body, env) {
    const id = normalizeId(body?.id)
    const password = String(body?.password || '').trim().toLowerCase()
    if (!id || !password) return [{ error: 'bad_credentials' }, 401]
    const fails = Number(await env.ACCOUNTS.get(`fail:${id}`)) || 0
    if (fails >= MAX_FAILS) return [{ error: 'locked', minutes: LOCK_MINUTES }, 429]
    const account = await env.ACCOUNTS.get(`account:${id}`, 'json')
    const ok = account && sameHex(await hashPassword(password, account.salt, account.iter), account.hash)
    if (!ok) {
        await env.ACCOUNTS.put(`fail:${id}`, String(fails + 1), { expirationTtl: LOCK_MINUTES * 60 })
        return [{ error: 'bad_credentials' }, 401]
    }
    if (fails) await env.ACCOUNTS.delete(`fail:${id}`)
    const token = hex(crypto.getRandomValues(new Uint8Array(32)))
    const now = Math.floor(Date.now() / 1000)
    await env.DB.batch([
        env.DB.prepare('DELETE FROM sessions WHERE expires < ?').bind(now),
        env.DB.prepare('INSERT INTO sessions (token_hash, student_id, created, expires) VALUES (?, ?, ?, ?)')
            .bind(await sha256(token), id, new Date().toISOString(), now + SESSION_DAYS * 24 * 3600),
    ])
    return [{ token, id }, 200]
}

const sha256 = async (text) => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))
const bearer = (request) => {
    const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
    return /^[0-9a-f]{64}$/.test(token) ? token : null
}

/** The signed-in ID for a request, or null. */
export async function sessionId(request, env) {
    const token = bearer(request)
    if (!token || !env.DB) return null
    const row = await env.DB.prepare('SELECT student_id FROM sessions WHERE token_hash = ? AND expires > ?')
        .bind(await sha256(token), Math.floor(Date.now() / 1000)).first()
    return row?.student_id || null
}

export async function logout(request, env) {
    const token = bearer(request)
    if (token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(token)).run()
    return [{ ok: true }, 200]
}

export async function getProgress(id, env) {
    const { results } = await env.DB.prepare('SELECT key, value FROM progress WHERE student_id = ?').bind(id).all()
    return [{ id, items: Object.fromEntries(results.map((r) => [r.key, r.value])) }, 200]
}

/** body.set: {key: string | null}; null removes the key. */
export async function saveProgress(id, body, env) {
    const set = body?.set
    if (!set || typeof set !== 'object' || Array.isArray(set)) return [{ error: 'bad_progress' }, 400]
    for (const [key, value] of Object.entries(set)) {
        if (!PROGRESS_KEY.test(key)) return [{ error: 'bad_key', key }, 400]
        if (value !== null && !(typeof value === 'string' && value.length <= MAX_VALUE)) return [{ error: 'bad_value', key }, 400]
    }
    const { results } = await env.DB.prepare('SELECT key, length(value) AS size FROM progress WHERE student_id = ?').bind(id).all()
    const sizes = Object.fromEntries(results.map((r) => [r.key, r.size]))
    for (const [key, value] of Object.entries(set)) sizes[key] = value === null ? 0 : value.length
    if (Object.values(sizes).reduce((a, b) => a + b, 0) > MAX_TOTAL) return [{ error: 'too_large' }, 413]
    const now = new Date().toISOString()
    await env.DB.batch(Object.entries(set).map(([key, value]) => (value === null
        ? env.DB.prepare('DELETE FROM progress WHERE student_id = ? AND key = ?').bind(id, key)
        : env.DB.prepare('INSERT INTO progress (student_id, key, value, updated) VALUES (?, ?, ?, ?) ON CONFLICT (student_id, key) DO UPDATE SET value = excluded.value, updated = excluded.updated').bind(id, key, value, now))))
    return [{ ok: true, keys: Object.values(sizes).filter(Boolean).length }, 200]
}
