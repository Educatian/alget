// UI screenshot harness for ALGET visual audit.
// Usage: node scripts/ui_shots.mjs [outDir]
// Requires: vite dev server on http://127.0.0.1:5173 and `npx playwright install chromium`.
import { mkdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { createRequire } from 'module'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const require = createRequire(import.meta.url)
const { chromium } = require(join(ROOT, 'frontend', 'node_modules', 'playwright'))
const OUT = process.argv[2] ? join(ROOT, process.argv[2]) : join(ROOT, 'screenshots', 'ui_audit')
mkdirSync(OUT, { recursive: true })
const BASE = 'http://127.0.0.1:5173'

const ROUTES = [
  { name: 'landing', path: '/' },
  { name: 'learn', path: '/learn' },
  { name: 'book-statics-0101', path: '/book/statics/01/01' },
  { name: 'book-ail606-0101', path: '/book/ail606-supplement/01/01' },
  { name: 'book-toc', path: '/book/statics' },
  { name: 'dashboard', path: '/dashboard' },
  { name: 'analytics', path: '/analytics' },
  { name: 'lab', path: '/lab' },
]
const VIEWPORTS = [
  { tag: 'desktop', width: 1440, height: 900 },
  { tag: 'laptop', width: 1280, height: 800 },
  { tag: 'mobile', width: 390, height: 844 },
]

async function enterDemo(page) {
  for (const name of ['Sign in to start', 'Sign in']) {
    try {
      const b = page.getByRole('button', { name }).first()
      if (await b.isVisible({ timeout: 1500 })) { await b.click(); await page.waitForTimeout(300); break }
    } catch {}
  }
  try {
    const demo = page.getByRole('button', { name: 'Continue in Demo Mode' })
    if (await demo.isVisible({ timeout: 1500 })) { await demo.click(); await page.waitForTimeout(500) }
  } catch {}
  await dismissTour(page)
}

async function dismissTour(page) {
  for (const name of ['Skip tour', 'Skip', 'Got it', 'Close']) {
    try {
      const b = page.getByRole('button', { name }).first()
      if (await b.isVisible({ timeout: 800 })) { await b.click(); await page.waitForTimeout(200) }
    } catch {}
  }
}

const browser = await chromium.launch()
const results = []
for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  // establish demo session once per context
  await page.goto(BASE + '/', { waitUntil: 'networkidle' }).catch(() => {})
  await enterDemo(page)
  for (const r of ROUTES) {
    try {
      await page.goto(BASE + r.path, { waitUntil: 'networkidle', timeout: 15000 })
      await page.waitForTimeout(700)
      await dismissTour(page)
      await page.waitForTimeout(500)
      const file = join(OUT, `${r.name}__${vp.tag}.png`)
      await page.screenshot({ path: file, fullPage: false })
      results.push(`OK   ${r.name} @ ${vp.tag}`)
    } catch (e) {
      results.push(`FAIL ${r.name} @ ${vp.tag}: ${String(e).slice(0, 80)}`)
    }
  }
  await ctx.close()
}
await browser.close()
console.log(results.join('\n'))
console.log('\nSaved to ' + OUT)
