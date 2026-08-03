/**
 * Capture a signed-in administrator session for the demo recorder.
 *
 * Opens a real browser window and waits while YOU sign in. No credential ever
 * passes through this script or the agent driving it; only the resulting
 * session cookies / tokens are written to disk.
 *
 *   node scripts/capture-admin-session.mjs
 *
 * Then record with:
 *   ALGET_DEMO_STORAGE_STATE=tmp/admin-session.json node scripts/record-agentic-demo.mjs
 *
 * The saved file grants access to the account. Keep it out of version control
 * (tmp/ is git-ignored) and delete it when the recording is done.
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs/promises'
import path from 'node:path'

const BASE = process.env.ALGET_DEMO_BASE_URL || 'https://alget.pages.dev'
const STATE = path.resolve(process.env.ALGET_DEMO_STORAGE_STATE || 'tmp/admin-session.json')
const TIMEOUT_MS = 10 * 60 * 1000

const browser = await chromium.launch({ headless: false, args: ['--window-size=1360,900'] })
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
const page = await context.newPage()
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })

console.log(`\nA browser window is open at ${BASE}`)
console.log('Sign in as the course administrator, then leave the window open.')
console.log('This script saves the session as soon as an administrator role is detected.\n')

const started = Date.now()
let saved = false

while (Date.now() - started < TIMEOUT_MS) {
  const status = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => /^sb-.*-auth-token$/.test(k))
    if (!key) return { signedIn: false }
    let parsed
    try { parsed = JSON.parse(localStorage.getItem(key) || '{}') } catch { return { signedIn: false } }
    const token = parsed?.access_token || parsed?.currentSession?.access_token
    const user = parsed?.user || parsed?.currentSession?.user
    if (!token) return { signedIn: false }
    // Read the role claim out of the JWT payload without verifying it; the
    // server re-verifies on every privileged call.
    let role = user?.app_metadata?.role
    if (!role) {
      try { role = JSON.parse(atob(token.split('.')[1] || '')).app_metadata?.role } catch { /* leave undefined */ }
    }
    return { signedIn: true, email: user?.email || '(unknown)', role: role || '(none)' }
  }).catch(() => ({ signedIn: false }))

  if (status.signedIn) {
    if (['admin', 'course_admin'].includes(status.role)) {
      await fs.mkdir(path.dirname(STATE), { recursive: true })
      await context.storageState({ path: STATE })
      console.log(`Signed in as ${status.email} with role "${status.role}".`)
      console.log(`Session saved -> ${STATE}`)
      saved = true
      break
    }
    console.log(`Signed in as ${status.email}, but role is "${status.role}".`)
    console.log('Grant app_metadata.role = "course_admin", then sign out and back in.')
    await page.waitForTimeout(8000)
  } else {
    await page.waitForTimeout(2500)
  }
}

if (!saved) console.log('\nTimed out without an administrator session. Nothing was saved.')

await context.close()
await browser.close()
