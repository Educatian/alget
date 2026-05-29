import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const require = createRequire(import.meta.url)
const { chromium } = require(join(ROOT, 'frontend', 'node_modules', 'playwright'))
const B = 'http://127.0.0.1:5175'
const routes = [
  ['statics-0102', '/book/statics/01/02'],
  ['aiethics-0202', '/book/ai-ethics/02/02'],
  ['instdesign-0201', '/book/inst-design/02/01'],
  ['cat100-0601', '/book/cat100-supplement/06/01'],
]
const br = await chromium.launch()
const ctx = await br.newContext({ viewport: { width: 1440, height: 2200 }, deviceScaleFactor: 1 })
const p = await ctx.newPage()
const errs = []
p.on('pageerror', (e) => errs.push(String(e).slice(0, 120)))
for (const [name, path] of routes) {
  await p.goto(B + path, { waitUntil: 'networkidle', timeout: 20000 })
  await p.waitForTimeout(1600)
  for (const n of ['Skip tour', 'Skip']) { try { const b = p.getByRole('button', { name: n }).first(); if (await b.isVisible({ timeout: 500 })) { await b.click(); await p.waitForTimeout(200) } } catch {} }
  // count rendered advanced interactives on the page
  const counts = await p.evaluate(() => {
    const q = (s) => document.querySelectorAll(s).length
    return {
      sliders: q('input[type=range]'),
      buttons: q('button'),
      svgs: q('svg'),
      h2: q('.reading-narrative h2'),
    }
  })
  await p.screenshot({ path: join(ROOT, 'screenshots', `wired_${name}.png`), fullPage: false })
  console.log(name, JSON.stringify(counts), 'errs:', errs.length)
}
await br.close()
