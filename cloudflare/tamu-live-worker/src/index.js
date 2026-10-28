/**
 * ALGET TAMU live class: who is reading now, and where, plus shared underlines, pushed over one
 * WebSocket per open reader. Separate from the tutor worker (alget-tamu-tutor), whose D1 it reads
 * for sessions and synced highlights; it never writes there.
 *
 *   GET /live   WebSocket, subprotocols ['alget-live', <session token>]
 *     client -> {type: 'where', section, heading, away}     what the reader has on screen
 *     client -> {type: 'highlights', section}               after the reader's highlights synced
 *     client -> 'ping'                                       keep-alive, answered 'pong'
 *     server -> {type: 'presence', online, reading, sections: {section: n}, headings: {heading: n}, here}
 *     server -> {type: 'shared', section, passages: [...]}   see shared.js
 *   GET /healthz
 *
 * Counts are of other students (not the reader, instructors, or TAMU-9xx test IDs) and carry no
 * names. One ClassRoom Durable Object holds the course's sockets; it hibernates between messages.
 */
import { sessionInfo } from '../../tamu-tutor-worker/src/accounts.js'
import { sharedForSection } from './shared.js'

const ROOM = 'ai-literacy'
const PROTOCOL = 'alget-live'
const STALE_MS = 120_000
const SECTION = /^[a-z0-9-]+\/\d\d\/\d\d$/
const RECOMPUTE_MS = 2000

const isStudent = (e) => e.role === 'student' && !/^TAMU-9/.test(e.id || '')

/** What one reader is told: other students online, how many are reading each section, and where in theirs. */
export function presenceFor(entries, self, now = Date.now()) {
    const online = new Set()
    const reading = new Map() // student -> most recent entry that is on a section and not away
    for (const e of entries) {
        if (e.id === self.id || !isStudent(e) || now - e.lastSeen > STALE_MS) continue
        online.add(e.id)
        if (e.away || !e.section) continue
        const prev = reading.get(e.id)
        if (!prev || e.lastSeen > prev.lastSeen) reading.set(e.id, e)
    }
    const sections = {}
    const headings = {}
    for (const e of reading.values()) {
        sections[e.section] = (sections[e.section] || 0) + 1
        if (e.section === self.section && e.heading) headings[e.heading] = (headings[e.heading] || 0) + 1
    }
    return { online: online.size, reading: reading.size, sections, headings, here: sections[self.section] || 0 }
}

export class ClassRoom {
    constructor(ctx, env) {
        this.ctx = ctx
        this.env = env
        this.shared = new Map() // section -> passages (in memory; rebuilt after hibernation)
        this.pending = new Map() // section -> timer for a coalesced recompute
        if (typeof WebSocketRequestResponsePair !== 'undefined') {
            ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'))
        }
    }

    entries(closing = null) {
        return this.ctx.getWebSockets().filter((ws) => ws !== closing && ws.readyState === 1).map((ws) => {
            const a = ws.deserializeAttachment() || {}
            const pinged = this.ctx.getWebSocketAutoResponseTimestamp?.(ws)
            return { ws, ...a, lastSeen: Math.max(a.at || 0, pinged ? pinged.getTime() : 0) }
        })
    }

    async fetch(request) {
        const url = new URL(request.url)
        const [client, server] = Object.values(new WebSocketPair())
        this.ctx.acceptWebSocket(server)
        server.serializeAttachment({ id: url.searchParams.get('id'), role: url.searchParams.get('role'), section: null, heading: null, away: false, at: Date.now() })
        return new Response(null, { status: 101, webSocket: client, headers: { 'Sec-WebSocket-Protocol': PROTOCOL } })
    }

    async webSocketMessage(ws, message) {
        if (typeof message !== 'string' || message.length > 1000) return
        let msg
        try { msg = JSON.parse(message) } catch { return }
        const a = ws.deserializeAttachment() || {}
        const section = SECTION.test(String(msg?.section || '')) ? msg.section : null
        if (msg?.type === 'where') {
            const heading = typeof msg.heading === 'string' ? msg.heading.trim().slice(0, 160) || null : null
            ws.serializeAttachment({ ...a, section, heading, away: Boolean(msg.away), at: Date.now() })
            if (section && section !== a.section) await this.sendShared(ws, section)
            this.broadcastPresence()
        } else if (msg?.type === 'highlights' && section) {
            ws.serializeAttachment({ ...a, at: Date.now() })
            this.recompute(section)
        }
    }

    webSocketClose(ws, code) {
        try { ws.close(code === 1005 ? 1000 : code, 'closed') } catch { /* already closed */ }
        this.broadcastPresence(ws)
    }

    webSocketError(ws) {
        this.broadcastPresence(ws)
    }

    broadcastPresence(closing = null) {
        const all = this.entries(closing)
        for (const e of all) {
            try { e.ws.send(JSON.stringify({ type: 'presence', ...presenceFor(all, e) })) } catch { /* gone */ }
        }
    }

    async passages(section) {
        if (!this.shared.has(section)) this.shared.set(section, await sharedForSection(this.env, section))
        return this.shared.get(section)
    }

    async sendShared(ws, section) {
        try { ws.send(JSON.stringify({ type: 'shared', section, passages: await this.passages(section) })) } catch { /* gone */ }
    }

    // Several readers highlighting at once cost one D1 read per section every RECOMPUTE_MS.
    recompute(section) {
        if (this.pending.has(section)) return
        this.pending.set(section, setTimeout(async () => {
            this.pending.delete(section)
            this.shared.delete(section)
            const passages = await this.passages(section)
            const body = JSON.stringify({ type: 'shared', section, passages })
            for (const e of this.entries()) {
                if (e.section === section) {
                    try { e.ws.send(body) } catch { /* gone */ }
                }
            }
        }, RECOMPUTE_MS))
    }
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url)
        if (url.pathname === '/healthz') return Response.json({ ok: true, room: Boolean(env.CLASSROOM) })
        if (url.pathname !== '/live') return Response.json({ error: 'not_found' }, { status: 404 })

        const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean)
        if (!allowed.includes(request.headers.get('Origin') || '')) return Response.json({ error: 'origin_not_allowed' }, { status: 403 })
        if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return Response.json({ error: 'websocket_only' }, { status: 426 })
        if (!env.CLASSROOM || !env.DB) return Response.json({ error: 'not_configured' }, { status: 503 })

        // The session token rides in the subprotocol list, so it is never in a URL or a log line.
        const offered = String(request.headers.get('Sec-WebSocket-Protocol') || '').split(',').map((s) => s.trim())
        const token = offered.find((p) => /^[0-9a-f]{64}$/.test(p))
        if (!offered.includes(PROTOCOL) || !token) return Response.json({ error: 'signed_out' }, { status: 401 })
        const session = await sessionInfo(new Request(url, { headers: { Authorization: `Bearer ${token}` } }), env)
        if (!session) return Response.json({ error: 'signed_out' }, { status: 401 })

        const room = env.CLASSROOM.get(env.CLASSROOM.idFromName(ROOM))
        const target = new URL('https://classroom/connect')
        target.searchParams.set('id', session.id)
        target.searchParams.set('role', session.role)
        return room.fetch(target, { headers: { Upgrade: 'websocket' } })
    },
}
