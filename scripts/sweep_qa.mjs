// Automated screenshot + render sweep across EVERY section.
// Requires auth-bypass dev server: VITE_E2E_AUTH_BYPASS=true npx vite --port 5175 + backend :8000.
// Writes per-section screenshots + a JSON report; flags sections that fail render assertions.
import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { mkdirSync, writeFileSync, readdirSync, existsSync } from 'fs'
const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const require = createRequire(import.meta.url)
const { chromium } = require(join(ROOT, 'frontend', 'node_modules', 'playwright'))
const B = process.env.SWEEP_BASE || 'http://127.0.0.1:5175'
const OUT = join(ROOT, 'screenshots', 'sweep')
const SHOT = process.argv.includes('--shots')
mkdirSync(OUT, { recursive: true })

// enumerate sections from the content tree
const CONTENT = join(ROOT, 'frontend', 'content')
const routes = []
for (const course of readdirSync(CONTENT)) {
  const cdir = join(CONTENT, course)
  if (!existsSync(cdir) || course.startsWith('_')) continue
  let chapters
  try { chapters = readdirSync(cdir) } catch { continue }
  for (const ch of chapters) {
    const chdir = join(cdir, ch)
    let files
    try { files = readdirSync(chdir) } catch { continue }
    for (const f of files) {
      if (f.endsWith('.mdx')) routes.push({ course, ch, sec: f.replace('.mdx', ''), path: `/book/${course}/${ch}/${f.replace('.mdx', '')}` })
    }
  }
}
console.log(`Sweeping ${routes.length} sections...`)

const br = await chromium.launch()
const ctx = await br.newContext({ viewport: { width: 1280, height: 1600 }, deviceScaleFactor: 1 })
const page = await ctx.newPage()
let consoleErrs = []
page.on('console', (m) => { if (m.type() === 'error') consoleErrs.push(m.text().slice(0, 160)) })
page.on('pageerror', (e) => consoleErrs.push('PAGEERROR ' + String(e).slice(0, 160)))

const report = []
let pass = 0, fail = 0
const RAW_TAG = /<(parameter-explorer|step-reveal|sequence-builder|branching-scenario|concept-map|self-explain|inline-check|interactive-quiz|artifact-studio|dynamic-scenario|worked-example|[a-z]+-diagram)/

for (let i = 0; i < routes.length; i++) {
  const r = routes[i]
  consoleErrs = []
  const issues = []
  try {
    await page.goto(B + r.path, { waitUntil: 'networkidle', timeout: 20000 })
    await page.waitForTimeout(700)
    for (const n of ['Skip tour', 'Skip']) { try { const b = page.getByRole('button', { name: new RegExp('^' + n + '$', 'i') }).first(); if (await b.isVisible({ timeout: 200 })) { await b.click(); await page.waitForTimeout(100) } } catch {} }
    await page.waitForTimeout(500)
    const m = await page.evaluate(() => {
      const nar = document.querySelector('.reading-narrative')
      return {
        narLen: nar ? nar.innerText.trim().length : 0,
        narText: nar ? nar.innerText.slice(0, 4000) : '',
        overflow: document.body.scrollWidth > window.innerWidth + 2,
        scrollW: document.body.scrollWidth,
        interactives: document.querySelectorAll('.reading-narrative .reading-breakout, .reading-narrative [role="radiogroup"], .reading-narrative input[type=range]').length,
        h2: document.querySelectorAll('.reading-narrative h2').length,
      }
    })
    if (m.narLen < 400) issues.push(`thin/empty render (narLen=${m.narLen})`)
    if (RAW_TAG.test(m.narText)) issues.push('raw unrendered tag visible in text')
    if (m.overflow) issues.push(`horizontal overflow (scrollW=${m.scrollW} vp=1280)`)
    if (m.interactives === 0) issues.push('no interactive components rendered')
    if (consoleErrs.length) issues.push(`${consoleErrs.length} console error(s): ${consoleErrs.slice(0, 2).join(' | ')}`)
    const ok = issues.length === 0
    if (ok) pass++; else fail++
    if (SHOT || !ok) { try { await page.screenshot({ path: join(OUT, `${r.course}__${r.ch}_${r.sec}${ok ? '' : '__FAIL'}.png`) }) } catch {} }
    report.push({ path: r.path, ok, issues, metrics: m && { narLen: m.narLen, interactives: m.interactives, h2: m.h2 } })
    if (!ok) console.log(`FAIL ${r.path} :: ${issues.join('; ')}`)
    if ((i + 1) % 32 === 0) console.log(`  ...${i + 1}/${routes.length} (pass=${pass} fail=${fail})`)
  } catch (e) {
    fail++; report.push({ path: r.path, ok: false, issues: ['navigation/load error: ' + String(e).slice(0, 80)] })
    console.log(`FAIL ${r.path} :: load error`)
  }
}
await br.close()
writeFileSync(join(OUT, 'sweep_report.json'), JSON.stringify({ total: routes.length, pass, fail, failures: report.filter(r => !r.ok) }, null, 2))
console.log(`\n=== SWEEP DONE: ${pass}/${routes.length} PASS, ${fail} FAIL ===`)
console.log('report: screenshots/sweep/sweep_report.json')
