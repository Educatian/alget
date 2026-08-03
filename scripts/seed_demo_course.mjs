#!/usr/bin/env node
/**
 * Put the control plane into the state a demo, a screen recording, or a manual
 * walkthrough needs: an accountable instructor and a course shell to attach a
 * source to.
 *
 * These two records gate everything downstream — the ingestion form only accepts
 * a PDF against an existing course, and a course requires a registered owner.
 * Building them by hand is where walkthroughs kept failing silently, because the
 * admin forms load their option lists once on mount and a missing owner leaves a
 * required select empty rather than reporting anything.
 *
 * Instructor registration is deliberately not used: it provisions a real account
 * and emails an invitation, which a demo should never trigger. The profile is
 * written directly and linked to the signed-in administrator.
 *
 *   node scripts/seed_demo_course.mjs
 *   node scripts/seed_demo_course.mjs --course-key statistics-primer --title "Statistics Primer"
 *   node scripts/seed_demo_course.mjs --reset
 *
 * Authorises with the session captured by
 * frontend/scripts/capture-admin-session.mjs, so no service-role key is needed
 * and every write is subject to the same row-level security a person would be.
 */
import fs from 'node:fs/promises'
import path from 'node:path'

const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://tyyjkkykcggukfbkwpia.supabase.co').replace(/\/$/, '')
const ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_mMb65EEINC5Zd7tG45OgCQ_8Qo4TL9_'
const STATE_PATH = process.env.ALGET_DEMO_STORAGE_STATE || 'frontend/tmp/admin-session.json'

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback
}
const reset = process.argv.includes('--reset')
// A walkthrough that shows course creation on camera needs the owner to exist
// but the course not to: creating it twice fails on the unique course key.
const instructorOnly = process.argv.includes('--instructor-only')
const COURSE_KEY = arg('course-key', 'intelligent-textbooks')
const COURSE_TITLE = arg('title', 'Intelligent Textbooks: Evidence and Design')
const COURSE_DOMAIN = arg('domain', 'Learning Engineering')

/** Access token and identity from the captured browser session. */
async function readSession() {
  let raw
  try {
    raw = JSON.parse(await fs.readFile(path.resolve(STATE_PATH), 'utf8'))
  } catch {
    throw new Error(`No session at ${STATE_PATH}. Run frontend/scripts/capture-admin-session.mjs first.`)
  }
  for (const origin of raw.origins || []) {
    for (const item of origin.localStorage || []) {
      if (!/^sb-.*-auth-token$/.test(item.name)) continue
      const parsed = JSON.parse(item.value)
      const stored = parsed.currentSession || parsed
      let token = stored.access_token
      if (!token) continue

      // Access tokens last about an hour, and a captured session is usually
      // older than that by the time it is reused. Refresh rather than sending
      // the operator back through a browser sign-in.
      const claims = () => JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString())
      if (claims().exp * 1000 < Date.now() + 60000 && stored.refresh_token) {
        const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
          method: 'POST',
          headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: stored.refresh_token }),
        })
        if (!response.ok) {
          throw new Error(`The captured session has expired and could not be refreshed (${response.status}). Re-run capture-admin-session.mjs.`)
        }
        const refreshed = await response.json()
        token = refreshed.access_token
        // Persist so the next run, and the recorder, start from a live session.
        item.value = JSON.stringify({ ...stored, ...refreshed })
        await fs.writeFile(path.resolve(STATE_PATH), JSON.stringify(raw, null, 2))
        console.log('  refreshed the captured session')
      }
      const payload = claims()
      return { token, userId: payload.sub, email: payload.email, role: payload.app_metadata?.role }
    }
  }
  throw new Error('The captured session carries no Supabase access token.')
}

async function rest(session, pathname, { method = 'GET', body, prefer } = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${pathname}`, {
    method,
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${session.token}`,
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const text = await response.text()
  if (!response.ok) throw new Error(`${method} ${pathname} -> ${response.status} ${text.slice(0, 220)}`)
  return text ? JSON.parse(text) : null
}

const session = await readSession()
if (!['admin', 'course_admin'].includes(session.role)) {
  throw new Error(`Session role is "${session.role || 'none'}"; seeding needs admin or course_admin.`)
}
console.log(`session ${session.email} (${session.role})`)

if (reset) {
  // A published record is retired, never deleted: the schema withholds DELETE on
  // published modules and pilots from ordinary callers on purpose, so that a
  // release leaves a trail. Retiring is what removes it from the reader, which
  // filters on status = 'published'.
  const retired = await rest(session, `published_course_modules?course_id=eq.${COURSE_KEY}&status=eq.published`, {
    method: 'PATCH', prefer: 'return=representation', body: { status: 'retired' },
  })
  console.log(`  retired ${retired.length} published module(s)`)

  const cancelled = await rest(session, `faculty_pilots?course_id=eq.${COURSE_KEY}&status=neq.cancelled`, {
    method: 'PATCH', prefer: 'return=representation', body: { status: 'cancelled' },
  })
  console.log(`  cancelled ${cancelled.length} pilot(s)`)

  await rest(session, `managed_courses?course_key=eq.${COURSE_KEY}`, { method: 'DELETE', prefer: 'return=minimal' })
  console.log('  removed the course shell')
  console.log('reset complete; the instructor profile and the audit trail were left in place')
  process.exit(0)
}

const existingProfiles = await rest(session, `instructor_profiles?email=eq.${encodeURIComponent(session.email)}&select=id,display_name`)
let instructor = existingProfiles[0]
if (instructor) {
  console.log(`  instructor already registered (${instructor.id})`)
} else {
  const created = await rest(session, 'instructor_profiles', {
    method: 'POST',
    prefer: 'return=representation',
    body: {
      user_id: session.userId,
      email: session.email,
      display_name: session.email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      status: 'active',
    },
  })
  instructor = created[0]
  console.log(`  instructor registered (${instructor.id})`)
}

if (instructorOnly) {
  console.log('\nready. The course shell is left for the walkthrough to create on camera.')
  process.exit(0)
}

const existingCourses = await rest(session, `managed_courses?course_key=eq.${COURSE_KEY}&select=id,title`)
if (existingCourses[0]) {
  console.log(`  course already present: ${existingCourses[0].title}`)
} else {
  const created = await rest(session, 'managed_courses', {
    method: 'POST',
    prefer: 'return=representation',
    body: {
      course_key: COURSE_KEY,
      title: COURSE_TITLE,
      domain: COURSE_DOMAIN,
      owner_instructor_id: instructor.id,
      created_by: session.userId,
    },
  })
  console.log(`  course created: ${created[0].title} (${COURSE_KEY})`)
}

console.log('\nready. Upload a source under /instructor -> Shadow pilot, or record with:')
console.log(`  ALGET_DEMO_COURSE_KEY=${COURSE_KEY} node scripts/record-agentic-demo.mjs`)
