/**
 * Learning events from the TAMU preview, stored in D1 (migrations/0001_events.sql) for
 * sequence analysis. The browser's logger (frontend/src/lib/loggingService.js) sends batches:
 *
 *   POST /events {session_id, events: [{seq, ts, event, target, section_id, data}]}
 *
 * The student ID comes from the session, never from the request.
 */

const MAX_BATCH = 200
const MAX_DATA = 4000
const EVENT_NAME = /^[a-z][a-z0-9_]{1,47}$/
const SESSION = /^[0-9a-f-]{36}$/
const text = (v, max) => (v === null || v === undefined || v === '' ? null : String(v).slice(0, max))

export async function saveEvents(studentId, body, env) {
    if (!env.DB) return [{ error: 'not_configured' }, 503]
    const sessionId = String(body?.session_id || '')
    const events = Array.isArray(body?.events) ? body.events : null
    if (!SESSION.test(sessionId) || !events || !events.length || events.length > MAX_BATCH) return [{ error: 'bad_events' }, 400]

    const serverTs = new Date().toISOString()
    const rows = []
    for (const e of events) {
        const seq = Number(e?.seq)
        const ts = text(e?.ts, 40)
        if (!Number.isInteger(seq) || seq < 1 || !ts || Number.isNaN(Date.parse(ts)) || !EVENT_NAME.test(String(e?.event))) continue
        let data = e?.data && typeof e.data === 'object' ? JSON.stringify(e.data) : null
        if (data && data.length > MAX_DATA) data = JSON.stringify({ truncated: true, size: data.length })
        rows.push([studentId, sessionId, seq, ts, serverTs, e.event, text(e.section_id, 80), text(e.target, 200), data])
    }
    if (rows.length) {
        const insert = env.DB.prepare(
            'INSERT OR IGNORE INTO events (student_id, session_id, seq, client_ts, server_ts, event, section_id, target, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        )
        await env.DB.batch(rows.map((r) => insert.bind(...r)))
    }
    return [{ ok: true, stored: rows.length, skipped: events.length - rows.length }, 200]
}
