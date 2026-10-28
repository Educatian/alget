/**
 * TAMU preview accounts (static preview built with VITE_TAMU_ACCOUNTS=true and VITE_TUTOR_URL).
 * Students sign in with a roster ID (TAMU-001 ...) and password checked by the tutor worker.
 * The reader's browser data (highlights and notes, written activities, review schedule, mastery, reader settings)
 * is mirrored to the worker's /progress store so it follows the student to another device.
 *
 * The rest of the app keeps using localStorage as before: writes to SYNCED keys are noticed
 * here and sent to the server a few seconds later; signing in loads the student's copy and
 * signing out removes it from this browser, so students sharing a computer stay apart.
 */
import { STATIC_DEMO } from './staticDemo'

const URL = (import.meta.env.VITE_TUTOR_URL || '').replace(/\/$/, '')
export const ACCOUNTS_ENABLED = STATIC_DEMO && Boolean(URL) && import.meta.env.VITE_TAMU_ACCOUNTS === 'true'

const SESSION_KEY = 'alget_tamu_session_v1'
const PENDING_KEY = 'alget_tamu_pending_v1'
export const SYNCED = /^((alget_highlights_v1|alget_activity_v1):.+|alget_review_v1|alget_local_mastery_v1|alget_adaptive_signals_v1|alget_reader_prefs_v1|alget_onboarding_completed_v1)$/
const FLUSH_MS = 4000
const RETRY_MS = 15000

// The original methods, so loading the server copy is not sent straight back.
const rawSet = Storage.prototype.setItem
const rawRemove = Storage.prototype.removeItem
const store = () => window.localStorage

const readJson = (key) => {
    try { return JSON.parse(store().getItem(key)) } catch { return null }
}

export const currentSession = () => readJson(SESSION_KEY)
export const studentUser = (id) => ({ id, email: id })

export function authHeaders() {
    const token = currentSession()?.token
    return token ? { Authorization: `Bearer ${token}` } : {}
}

function signedOutHere() {
    for (const key of [...syncedKeys(), SESSION_KEY, PENDING_KEY]) rawRemove.call(store(), key)
    window.dispatchEvent(new CustomEvent('alget-signed-out'))
}

function syncedKeys() {
    const keys = []
    for (let i = 0; i < store().length; i++) {
        const key = store().key(i)
        if (key && SYNCED.test(key)) keys.push(key)
    }
    return keys
}

// Pending changes are kept in localStorage too, so a reload sends them before reading the server copy.
let timer = null
function queue(key, value) {
    rawSet.call(store(), PENDING_KEY, JSON.stringify({ ...(readJson(PENDING_KEY) || {}), [key]: value }))
    clearTimeout(timer)
    timer = setTimeout(flush, FLUSH_MS)
}

export async function flush({ keepalive = false } = {}) {
    clearTimeout(timer)
    const set = readJson(PENDING_KEY)
    if (!set || !Object.keys(set).length || !currentSession()) return
    try {
        const res = await fetch(`${URL}/progress`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify({ set }),
            keepalive,
        })
        if (res.status === 401) return signedOutHere()
        if (res.ok || res.status === 400 || res.status === 413) {
            // Drop what was sent; keep anything queued while the request was in flight.
            const left = readJson(PENDING_KEY) || {}
            for (const [key, value] of Object.entries(set)) if (left[key] === value) delete left[key]
            rawSet.call(store(), PENDING_KEY, JSON.stringify(left))
            if (Object.keys(left).length) timer = setTimeout(flush, FLUSH_MS)
            return
        }
    } catch { /* offline: retry below */ }
    timer = setTimeout(flush, RETRY_MS)
}

let watching = false
function watchStorage() {
    if (watching) return
    watching = true
    Storage.prototype.setItem = function setItem(key, value) {
        rawSet.call(this, key, value)
        if (this === store() && SYNCED.test(key) && currentSession()) queue(key, String(value))
    }
    Storage.prototype.removeItem = function removeItem(key) {
        rawRemove.call(this, key)
        if (this === store() && SYNCED.test(key) && currentSession()) queue(key, null)
    }
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') flush({ keepalive: true })
    })
}

/** Replaces this browser's copy with the student's server copy. Returns the HTTP status. */
async function loadProgress(token) {
    const res = await fetch(`${URL}/progress`, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) return res.status
    const { items = {} } = await res.json()
    for (const key of syncedKeys()) rawRemove.call(store(), key)
    for (const [key, value] of Object.entries(items)) if (SYNCED.test(key)) rawSet.call(store(), key, value)
    return 200
}

export async function signIn(id, password) {
    let res
    let data = {}
    try {
        res = await fetch(`${URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, password }),
        })
        data = await res.json().catch(() => ({}))
    } catch {
        return { error: 'network' }
    }
    if (!res.ok) return { error: data.error || `http_${res.status}`, minutes: data.minutes }
    // Another student's data may still be here if they closed the tab without signing out.
    for (const key of [...syncedKeys(), PENDING_KEY]) rawRemove.call(store(), key)
    rawSet.call(store(), SESSION_KEY, JSON.stringify({ token: data.token, id: data.id }))
    try { await loadProgress(data.token) } catch { /* start empty; changes still sync */ }
    watchStorage()
    return { id: data.id }
}

/** On page load: resume a saved session, sending unsent changes before reading the server copy. */
export async function resumeSession() {
    const session = currentSession()
    if (!session?.token) return null
    try {
        await flush()
        if (!currentSession()) return null
        if ((await loadProgress(session.token)) === 401) {
            signedOutHere()
            return null
        }
    } catch { /* offline: keep working from this browser's copy */ }
    watchStorage()
    return session.id
}

export async function signOut() {
    await flush()
    const headers = authHeaders()
    signedOutHere()
    try { await fetch(`${URL}/logout`, { method: 'POST', headers }) } catch { /* the session expires on its own */ }
}
