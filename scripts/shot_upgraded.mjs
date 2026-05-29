import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const require = createRequire(import.meta.url)
const { chromium } = require(join(ROOT, 'frontend', 'node_modules', 'playwright'))
const B = 'http://127.0.0.1:5173'
const routes = [['statics-0302', '/book/statics/03/02'], ['aiethics-0202', '/book/ai-ethics/02/02']]
const br = await chromium.launch()
const ctx = await br.newContext({ viewport: { width: 1440, height: 1700 } })
const p = await ctx.newPage()
await p.goto(B + '/', { waitUntil: 'networkidle' }).catch(() => {})
for (const n of ['Sign in to start', 'Sign in']) { try { const b = p.getByRole('button', { name: n }).first(); if (await b.isVisible({ timeout: 1200 })) { await b.click(); await p.waitForTimeout(300); break } } catch {} }
try { const d = p.getByRole('button', { name: 'Continue in Demo Mode' }); if (await d.isVisible({ timeout: 1200 })) { await d.click(); await p.waitForTimeout(400) } } catch {}
for (const [name, path] of routes) {
  await p.goto(B + path, { waitUntil: 'networkidle', timeout: 15000 })
  await p.waitForTimeout(1400)
  for (const n of ['Skip tour', 'Skip']) { try { const b = p.getByRole('button', { name: n }).first(); if (await b.isVisible({ timeout: 600 })) { await b.click(); await p.waitForTimeout(150) } } catch {} }
  await p.screenshot({ path: join(ROOT, 'screenshots', `upgraded_${name}.png`), fullPage: false })
  console.log('captured', name)
}
await br.close()
