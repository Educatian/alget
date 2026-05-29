// Cloudflare Pages Function: server-side cohort access-code validation for the
// static deploy (mirrors the FastAPI /api/access/validate). Codes live here /
// in Pages env vars, NEVER in the client bundle. Set ENGINEERING_ACCESS_CODE /
// EDUCATION_ACCESS_CODE / RESEARCHER_ACCESS_CODE in the Pages project to override
// the fallbacks below.
const ENV_KEY = {
  engineering: 'ENGINEERING_ACCESS_CODE',
  education: 'EDUCATION_ACCESS_CODE',
  researcher: 'RESEARCHER_ACCESS_CODE',
}
const FALLBACK = {
  engineering: 'eng123',
  education: 'edu123',
  researcher: 'immersivebama',
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
  const expected = String((context.env && context.env[envKey]) || FALLBACK[scope] || '').trim()
  const valid = Boolean(expected) && String(passcode || '').trim() === expected
  return Response.json({ valid, scope }, { headers: CORS })
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS })
}
