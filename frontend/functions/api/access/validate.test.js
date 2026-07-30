import { describe, expect, it } from 'vitest'

import { onRequestPost } from './validate.js'

const requestFor = (scope, passcode) =>
  new Request('https://example.invalid/api/access/validate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ scope, passcode }),
  })

const validate = async (env, scope, passcode) => {
  const response = await onRequestPost({ env, request: requestFor(scope, passcode) })
  return { body: await response.json(), status: response.status }
}

describe('access validation configuration', () => {
  it('accepts an explicitly configured synthetic code', async () => {
    const result = await validate(
      { ENGINEERING_ACCESS_CODE: 'synthetic-engineering-code-2026' },
      'engineering',
      ' Synthetic-Engineering-Code-2026 ',
    )

    expect(result).toEqual({ body: { scope: 'engineering', valid: true }, status: 200 })
  })

  it.each([
    ['missing', {}],
    ['blank', { ENGINEERING_ACCESS_CODE: '   ' }],
    ['non-string', { ENGINEERING_ACCESS_CODE: { unexpected: true } }],
    ['control-character', { ENGINEERING_ACCESS_CODE: 'synthetic-engineering-code-2026\n' }],
  ])('fails closed when configuration is %s', async (_label, env) => {
    const result = await validate(env, 'engineering', 'synthetic-unconfigured-code')

    expect(result).toEqual({
      body: { error: 'access_code_not_configured', scope: 'engineering', valid: false },
      status: 503,
    })
  })

  it('does not enable a fallback compatibility switch', async () => {
    const result = await validate(
      { ALLOW_FALLBACK_ACCESS_CODES: 'true' },
      'engineering',
      'synthetic-unconfigured-code',
    )

    expect(result.body.valid).toBe(false)
    expect(result.status).toBe(503)
  })
})
