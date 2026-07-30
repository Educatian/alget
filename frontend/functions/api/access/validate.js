// Cloudflare Pages Function: server-side cohort access-code validation for the
// static deploy (mirrors the FastAPI /api/access/validate). Codes live here /
// in Pages env vars, NEVER in the client bundle. Set ENGINEERING_ACCESS_CODE /
// EDUCATION_ACCESS_CODE / RESEARCHER_ACCESS_CODE in the Pages project.
const ENV_KEY = {
  engineering: 'ENGINEERING_ACCESS_CODE',
  education: 'EDUCATION_ACCESS_CODE',
  researcher: 'RESEARCHER_ACCESS_CODE',
}
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
}

export async function onRequestPost(context) {
  let body = {}
  try {
    body = await context.request.json()
  } catch {
    return Response.json({ valid: false, scope: null }, { status: 400, headers: CORS })
  }
  const scope = body && body.scope
  const passcode = body && body.passcode
  const envKey = ENV_KEY[scope]
  if (!envKey) {
    return Response.json({ valid: false, scope: scope ?? null }, { headers: CORS })
  }
  const configured = context.env && context.env[envKey]
  const malformed = typeof configured !== 'string' || [...configured].some(
    (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
  )
  const expected = malformed ? '' : configured.trim()
  if (!expected || malformed) {
    return Response.json(
      { valid: false, scope, error: 'access_code_not_configured' },
      { status: 503, headers: CORS },
    )
  }
  // Case-insensitive + trimmed compare so "EDU123"/" edu123 " also pass.
  const valid = typeof passcode === 'string' && passcode.trim().toLowerCase() === expected.toLowerCase()
  return Response.json({ valid, scope }, { headers: CORS })
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS })
}
