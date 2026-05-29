// Capture a comprehensive screenshot set for a professional design critique.
// Requires: VITE_E2E_AUTH_BYPASS=true npx vite --port 5175 (auth-bypass) + backend :8000.
import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { mkdirSync } from 'fs'
const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const OUT = join(ROOT, 'screenshots', 'design_audit')
mkdirSync(OUT, { recursive: true })
const require = createRequire(import.meta.url)
const { chromium } = require(join(ROOT, 'frontend', 'node_modules', 'playwright'))
const B = 'http://127.0.0.1:5175'

async function dismissTour(p) {
  for (let k = 0; k < 5; k++) { let acted = false; for (const n of ['Skip tour', 'Skip', 'Got it', 'Close', 'Done']) { try { const b = p.getByRole('button', { name: new RegExp('^' + n + '$', 'i') }).first(); if (await b.isVisible({ timeout: 250 })) { await b.click(); await p.waitForTimeout(120); acted = true } } catch {} } if (!acted) break }
}
async function setDark(p, dark) {
  try {
    const tt = p.getByRole('button', { name: /dark mode|light mode|theme/i }).first()
    const cur = await p.evaluate(() => document.documentElement.getAttribute('data-theme'))
    if ((dark && cur !== 'dark') || (!dark && cur === 'dark')) { await tt.click({ timeout: 1000 }); await p.waitForTimeout(300) }
  } catch {}
}

// [name, path, viewport, fullPage, dark]
const shots = [
  ['landing', '/', [1440, 900], true, false],
  ['reading-statics', '/book/statics/01/01', [1440, 3200], false, false],
  ['reading-aiethics-interactive', '/book/ai-ethics/01/01', [1440, 3600], false, false],
  ['toc-statics', '/book/statics', [1440, 1400], false, false],
  ['dashboard', '/dashboard', [1440, 1600], true, false],
  ['analytics', '/analytics', [1440, 1600], true, false],
  ['lab', '/lab', [1440, 1400], true, false],
  ['diagnostic', '/diagnostic/statics', [1440, 1400], true, false],
  ['reading-dark', '/book/statics/01/01', [1440, 2400], false, true],
  ['landing-dark', '/', [1440, 900], true, true],
  ['reading-tablet', '/book/statics/01/01', [834, 2200], false, false],
  ['dashboard-tablet', '/dashboard', [834, 1600], true, false],
  ['landing-mobile', '/', [390, 844], true, false],
  ['reading-mobile', '/book/statics/01/01', [390, 2400], false, false],
  ['dashboard-mobile', '/dashboard', [390, 1600], true, false],
  ['toc-mobile', '/book/statics', [390, 1400], false, false],
]

const br = await chromium.launch()
let darkCtx = null
for (const [name, path, vp, full, dark] of shots) {
  const ctx = await br.newContext({ viewport: { width: vp[0], height: vp[1] }, deviceScaleFactor: 1 })
  const p = await ctx.newPage()
  try {
    await p.goto(B + path, { waitUntil: 'networkidle', timeout: 20000 })
    await p.waitForTimeout(1200)
    await dismissTour(p)
    if (dark) { await setDark(p, true); await p.waitForTimeout(300) }
    await p.waitForTimeout(700)
    await p.screenshot({ path: join(OUT, `${name}.png`), fullPage: full })
    console.log('OK  ', name)
  } catch (e) { console.log('FAIL', name, String(e).slice(0, 70)) }
  await ctx.close()
}
await br.close()
console.log('\nSaved to', OUT)
