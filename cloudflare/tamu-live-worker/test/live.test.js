import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { sharedPassages } from '../src/shared.js'
import worker, { presenceFor } from '../src/index.js'

const TEXT = 'A spam filter learned from thousands of labelled emails, while a calculator follows fixed rules written by people.'
const hl = (from, to, color = 'yellow', note = '') => {
    const start = TEXT.indexOf(from)
    const end = TEXT.indexOf(to) + to.length
    return { id: `${start}`, color, note, anchor: { exact: TEXT.slice(start, end), prefix: TEXT.slice(Math.max(0, start - 32), start), suffix: TEXT.slice(end, end + 32), start, end } }
}
const row = (id, ...list) => ({ student_id: id, value: JSON.stringify(list) })

test('a passage underlined by one student is not shared', () => {
    assert.deepEqual(sharedPassages([row('TAMU-001', hl('spam', 'emails'))]), [])
})

test('overlapping underlines from two students become one shared passage, in whole words, without notes', () => {
    const out = sharedPassages([
        row('TAMU-001', hl('spam', 'labelled', 'yellow', 'my private note')),
        row('TAMU-002', hl('learned', 'emails', 'red')),
        row('TAMU-003', hl('calculator', 'rules')),
    ])
    assert.equal(out.length, 1)
    assert.equal(out[0].exact, 'learned from thousands of labelled')
    assert.equal(out[0].count, 2)
    assert.deepEqual(out[0].tags, { yellow: 1, red: 1 })
    assert.equal(TEXT.slice(out[0].start, out[0].end), out[0].exact)
    assert.ok(TEXT.endsWith(out[0].suffix.trim()) || TEXT.includes(out[0].suffix))
    assert.ok(!JSON.stringify(out).includes('private note'))
})

test('a cut inside a word widens to the whole word, and the count is the peak overlap', () => {
    const t1 = hl('spam', 'thousands')
    const cut = { ...t1, anchor: { ...t1.anchor, exact: t1.anchor.exact.slice(0, -3), end: t1.anchor.end - 3, suffix: TEXT.slice(t1.anchor.end - 3, t1.anchor.end + 29) } } // "...thousa"
    const out = sharedPassages([
        row('TAMU-001', cut),
        row('TAMU-002', hl('filter', 'emails')),
        row('TAMU-003', hl('learned', 'from')),
    ])
    assert.equal(out[0].exact, 'filter learned from thousands')
    assert.equal(out[0].count, 3)
})

test('a reader whose offsets are shifted by a few characters still lines up by text', () => {
    const shifted = (h, d) => ({ ...h, anchor: { ...h.anchor, start: h.anchor.start + d, end: h.anchor.end + d } })
    const out = sharedPassages([
        row('TAMU-001', hl('spam', 'labelled')),
        row('TAMU-002', shifted(hl('learned', 'emails'), 7)),
        row('TAMU-003', shifted(hl('thousands', 'calculator'), -3)),
    ])
    assert.equal(out.length, 1)
    assert.equal(out[0].exact, 'learned from thousands of labelled emails') // 002 and 003 share "emails" too
    assert.equal(out[0].count, 3)
})

test('one student with two overlapping highlights still counts once', () => {
    assert.deepEqual(sharedPassages([row('TAMU-001', hl('spam', 'from'), hl('learned', 'emails'))]), [])
})

test('broken anchors are ignored', () => {
    const bad = { anchor: { exact: 'nope', start: 5, end: 30 } }
    assert.deepEqual(sharedPassages([row('TAMU-001', bad), row('TAMU-002', bad), { student_id: 'TAMU-003', value: 'not json' }]), [])
})

test('presence counts other students only, by section and by heading', () => {
    const now = 1_000_000
    const e = (id, section, heading, extra = {}) => ({ id, role: 'student', section, heading, away: false, lastSeen: now - 1000, ...extra })
    const me = e('TAMU-001', 'ai-literacy/01/02', 'Temperature')
    const all = [
        me,
        e('TAMU-001', 'ai-literacy/01/01', null), // my other tab
        e('TAMU-002', 'ai-literacy/01/02', 'Temperature'),
        e('TAMU-003', 'ai-literacy/01/02', 'Tokens'),
        e('TAMU-004', 'ai-literacy/02/01', 'Bias'),
        e('TAMU-005', 'ai-literacy/01/02', 'Tokens', { away: true }),
        e('TAMU-006', 'ai-literacy/01/02', 'Tokens', { lastSeen: now - 300_000 }),
        e('TAMU-999', 'ai-literacy/01/02', 'Tokens'),
        e('TAMU-901', 'ai-literacy/01/02', 'Tokens', { role: 'instructor' }),
        e('UTK-950', 'ai-literacy/01/02', 'Tokens'), // 9xx test IDs on any site
    ]
    assert.deepEqual(presenceFor(all, me, now), {
        online: 4, reading: 3, here: 2,
        sections: { 'ai-literacy/01/02': 2, 'ai-literacy/02/01': 1 },
        headings: { Temperature: 1, Tokens: 1 },
    })
})

const TOKEN = 'a'.repeat(64)
const sha = (s) => createHash('sha256').update(s).digest('hex')
function env(row = { student_id: 'TAMU-001', role: 'student' }) {
    const calls = []
    return {
        calls,
        ALLOWED_ORIGINS: 'https://preview.example',
        DB: { prepare: () => ({ bind: (hash) => ({ first: async () => (hash === sha(TOKEN) ? row : null) }) }) },
        CLASSROOM: {
            idFromName: (name) => name,
            get: () => ({ fetch: async (url) => { calls.push(String(url)); return new Response('upgraded', { status: 200 }) } }),
        },
    }
}
const live = (headers) => new Request('https://live.example/live', { headers: { Origin: 'https://preview.example', Upgrade: 'websocket', ...headers } })

test('the live socket needs an allowed origin, a websocket upgrade and a valid session', async () => {
    const e = env()
    assert.equal((await worker.fetch(new Request('https://live.example/live', { headers: { Origin: 'https://evil.example', Upgrade: 'websocket' } }), e)).status, 403)
    assert.equal((await worker.fetch(new Request('https://live.example/live', { headers: { Origin: 'https://preview.example' } }), e)).status, 426)
    assert.equal((await worker.fetch(live({ 'Sec-WebSocket-Protocol': 'alget-live' }), e)).status, 401)
    assert.equal((await worker.fetch(live({ 'Sec-WebSocket-Protocol': `alget-live, ${'b'.repeat(64)}` }), e)).status, 401)
    assert.equal(e.calls.length, 0)
    const ok = await worker.fetch(live({ 'Sec-WebSocket-Protocol': `alget-live, ${TOKEN}` }), e)
    assert.equal(await ok.text(), 'upgraded')
    assert.equal(e.calls[0], 'https://classroom/connect?id=TAMU-001&role=student')
})
