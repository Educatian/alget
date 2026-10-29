/**
 * TAMU live class (accounts mode with VITE_LIVE_URL): one WebSocket to the alget-tamu-live worker
 * (cloudflare/tamu-live-worker) that tells the reader how many classmates are online, how many are
 * reading each section and which part of this one, and which passages several classmates underlined.
 *
 * The reader reports only what is on screen (section, heading, tab hidden) and, after its
 * highlights sync, which section changed. Counts carry no names. Sites with section discussions also
 * hear when someone posts in the reader's section ('alget-discussion' window event).
 */
import { ACCOUNTS_ENABLED, currentSession } from './account'

const BASE = (import.meta.env.VITE_LIVE_URL || '').replace(/\/$/, '').replace(/^http/, 'ws')
export const LIVE_ENABLED = ACCOUNTS_ENABLED && Boolean(BASE)

const PING_MS = 25000
const WHERE_MS = 1500 // scrolling changes the heading often; report where the reader settles
const HIGHLIGHTS = /^alget_highlights_v1:(.+)$/

let ws = null
let retry = 0
let retryTimer = null
let pingTimer = null
let whereTimer = null
let where = { section: null, heading: null }
let state = { connected: false, presence: null, shared: {} }
const listeners = new Set()

function emit(patch) {
    state = { ...state, ...patch }
    for (const fn of listeners) fn(state)
}

function send(message) {
    if (ws?.readyState === 1) ws.send(typeof message === 'string' ? message : JSON.stringify(message))
}

function sendWhere() {
    send({ type: 'where', ...where, away: document.visibilityState === 'hidden' })
}

function connect() {
    const token = currentSession()?.token
    if (!LIVE_ENABLED || ws || !token || !listeners.size) return
    clearTimeout(retryTimer)
    // The session token goes in the subprotocol list, not the URL.
    const socket = new WebSocket(`${BASE}/live`, ['alget-live', token])
    ws = socket
    socket.onopen = () => {
        retry = 0
        emit({ connected: true })
        sendWhere()
        pingTimer = setInterval(() => send('ping'), PING_MS)
    }
    socket.onmessage = (event) => {
        if (event.data === 'pong') return
        let msg
        try { msg = JSON.parse(event.data) } catch { return }
        if (msg.type === 'presence') emit({ presence: msg })
        if (msg.type === 'shared' && msg.section) emit({ shared: { ...state.shared, [msg.section]: msg.passages || [] } })
        if (msg.type === 'discussion' && msg.section) window.dispatchEvent(new CustomEvent('alget-discussion', { detail: { section: msg.section } }))
    }
    socket.onclose = () => {
        clearInterval(pingTimer)
        if (ws === socket) ws = null
        emit({ connected: false, presence: null })
        if (currentSession() && listeners.size) retryTimer = setTimeout(connect, Math.min(30000, 1000 * 2 ** retry++))
    }
}

if (LIVE_ENABLED) {
    document.addEventListener('visibilitychange', sendWhere)
    // Highlights reach the server a few seconds after they are made (lib/account.js); then the
    // live worker recomputes the shared passages for everyone in that section.
    window.addEventListener('alget-progress-synced', (event) => {
        for (const key of event.detail || []) {
            const section = HIGHLIGHTS.exec(key)?.[1]
            if (section) send({ type: 'highlights', section })
        }
    })
    window.addEventListener('alget-signed-out', () => {
        clearTimeout(retryTimer)
        ws?.close()
        ws = null
        emit({ connected: false, presence: null, shared: {} })
    })
}

export function subscribeLive(fn) {
    listeners.add(fn)
    fn(state)
    connect()
    return () => {
        listeners.delete(fn)
        if (!listeners.size) {
            clearTimeout(retryTimer)
            ws?.close()
            ws = null
        }
    }
}

/** After posting in a section's discussion: classmates reading that section reload it. */
export function notifyDiscussion(section) {
    send({ type: 'discussion', section })
}

export function setLiveWhere(section, heading) {
    heading = heading?.trim() || null
    if (where.section === section && where.heading === heading) return
    const newSection = where.section !== section
    where = { section, heading }
    clearTimeout(whereTimer)
    // A new section is reported at once (it also fetches that section's shared underlines).
    if (newSection) sendWhere()
    else whereTimer = setTimeout(sendWhere, WHERE_MS)
}
