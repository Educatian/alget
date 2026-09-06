import test from 'node:test'
import assert from 'node:assert/strict'
import worker, { normalizeUnloadEvents, persistUnloadEvents } from './index.js'

const USER_ID = '11111111-1111-4111-8111-111111111111'
const SESSION_ID = '22222222-2222-4222-8222-222222222222'
const ENV = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'publishable-test-key',
}

function event(overrides = {}) {
  return {
    user_id: USER_ID,
    session_id: SESSION_ID,
    sequence_num: 3,
    event_type: 'sequence_check',
    event_target: 'sequence',
    event_data: { mode: 'order', answer: 'private learner answer', correct_count: 3 },
    section_id: 'inst-design/02/08',
    client_ts: '2026-09-04T12:00:00.000Z',
    ...overrides,
  }
}

test('unload relay accepts body token and uses Worker Supabase configuration', async () => {
  const calls = []
  const previousFetch = globalThis.fetch
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init })
    return new Response('', { status: 201 })
  }
  try {
    const response = await persistUnloadEvents(ENV, {
      access_token: 'learner-token',
      supabase_url: 'https://attacker.example.invalid',
      events: [event()],
    })
    assert.equal(response.status, 200)
    const payload = await response.json()
    assert.equal(payload.persisted_count, 1)
    assert.equal(payload.canonical_mirror.persisted, true)
    assert.equal(calls.length, 2)
    assert.match(calls[0].url, /example\.supabase\.co\/rest\/v1\/event_logs$/)
    assert.match(calls[1].url, /example\.supabase\.co\/rest\/v1\/interaction_events$/)
    assert.equal(calls[0].init.headers.Authorization, 'Bearer learner-token')
    const stored = JSON.parse(calls[0].init.body)[0]
    assert.equal(stored.event_data.answer, undefined)
  } finally {
    globalThis.fetch = previousFetch
  }
})

test('unload relay rejects missing access token without writing', async () => {
  const previousFetch = globalThis.fetch
  let called = false
  globalThis.fetch = async () => {
    called = true
    return new Response('', { status: 201 })
  }
  try {
    const response = await persistUnloadEvents(ENV, { events: [event()] })
    assert.equal(response.status, 401)
    assert.equal(called, false)
  } finally {
    globalThis.fetch = previousFetch
  }
})

test('Worker route owns both /log-events and /api/log-events paths', async () => {
  const previousFetch = globalThis.fetch
  globalThis.fetch = async () => new Response('', { status: 201 })
  try {
    const response = await worker.fetch(new Request('https://worker.example/api/log-events', {
      method: 'POST',
      body: JSON.stringify({ access_token: 'learner-token', events: [event()] }),
      headers: { 'content-type': 'application/json' },
    }), ENV, {})
    assert.equal(response.status, 200)
    assert.equal((await response.json()).persisted_count, 1)
  } finally {
    globalThis.fetch = previousFetch
  }
})

test('unload relay drops malformed events and reports an empty batch', () => {
  const result = normalizeUnloadEvents([
    event({ user_id: 'not-a-uuid' }),
    event({ event_type: '' }),
  ])
  assert.deepEqual(result, [])
})
