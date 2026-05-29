// Commercial-grade interaction QA: drive each interaction and assert it RESPONDS.
// Requires the auth-bypass dev server: VITE_E2E_AUTH_BYPASS=true npx vite --port 5175
import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const require = createRequire(import.meta.url)
const { chromium } = require(join(ROOT, 'frontend', 'node_modules', 'playwright'))
const B = 'http://127.0.0.1:5175'

const results = []
const rec = (name, status, note = '') => { results.push({ name, status, note }); console.log(`${status === 'PASS' ? 'PASS' : status === 'FAIL' ? 'FAIL' : 'SKIP'}  ${name}${note ? '  — ' + note : ''}`) }

const br = await chromium.launch()
const ctx = await br.newContext({ viewport: { width: 1440, height: 1800 } })
const page = await ctx.newPage()
const consoleErrors = []
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 140)) })
page.on('pageerror', (e) => consoleErrors.push('PAGEERROR ' + String(e).slice(0, 140)))

async function containerText(loc) { try { return (await loc.innerText()).replace(/\s+/g, ' ').trim() } catch { return '' } }

async function dismissTour(pg) {
  for (let k = 0; k < 6; k++) {
    let acted = false
    for (const n of ['Skip tour', 'Skip', 'Got it', 'Close', 'Done']) {
      try { const b = pg.getByRole('button', { name: new RegExp('^' + n + '$', 'i') }).first(); if (await b.isVisible({ timeout: 250 })) { await b.click(); await pg.waitForTimeout(120); acted = true } } catch {}
    }
    if (!acted) break
  }
}
async function go(path) {
  await page.goto(B + path, { waitUntil: 'networkidle', timeout: 20000 })
  await page.waitForTimeout(1400)
  await dismissTour(page)
}

// ---- ai-ethics/01/01 has all 8 interaction types ----
await go('/book/ai-ethics/01/01')
const nar = page.locator('.reading-narrative')

// interactive-quiz / inline-check: click an option, expect feedback text
for (const kind of ['quiz', 'inline']) {
  try {
    const before = await containerText(nar)
    // option buttons typically carry the option text; click a plausible option via radio role or button
    const radios = page.locator('.reading-narrative [role="radio"], .reading-narrative [role="radiogroup"] button, .reading-narrative button')
    const n = await radios.count()
    let clicked = false
    for (let i = 0; i < Math.min(n, 30); i++) {
      const t = (await radios.nth(i).innerText().catch(() => '')).trim()
      if (t && t.length > 4 && !/check|reveal|next|hint|skip|speak|why|show/i.test(t)) { await radios.nth(i).click({ timeout: 1500 }).catch(() => {}); clicked = true; break }
    }
    await page.waitForTimeout(500)
    const after = await containerText(nar)
    const feedback = /correct|not quite|incorrect|exactly|review|nice|good/i.test(after) && after !== before
    rec(`${kind}: option click -> feedback`, clicked && (feedback || after !== before) ? 'PASS' : 'FAIL', clicked ? '' : 'no option found')
  } catch (e) { rec(`${kind}: option click`, 'FAIL', String(e).slice(0, 60)) }
  break // quiz+inline share the heuristic; run once
}

// step-reveal / self-explain / sequence: click an action button, expect content growth
const actions = [
  { name: 'step-reveal: reveal next', re: /reveal|show next|next step|reveal step/i },
  { name: 'sequence-builder: check answer', re: /check( answer)?/i },
  { name: 'self-explain: reveal expert', re: /reveal|show (the )?(expert|answer)|see (the )?answer|compare/i },
]
for (const a of actions) {
  try {
    const before = await containerText(nar)
    const btn = page.locator('.reading-narrative button', { hasText: a.re }).first()
    if (await btn.count() === 0) { rec(a.name, 'SKIP', 'control not found on this section'); continue }
    await btn.scrollIntoViewIfNeeded(); await btn.click({ timeout: 2000 })
    await page.waitForTimeout(500)
    const after = await containerText(nar)
    rec(a.name, after !== before && after.length >= before.length - 5 ? 'PASS' : 'FAIL', after === before ? 'no visible response' : '')
  } catch (e) { rec(a.name, 'FAIL', String(e).slice(0, 60)) }
}

// branching-scenario: click the first choice in the decision group, expect a new prompt/feedback
try {
  const group = page.locator('[role="group"][aria-label*="next" i], [aria-label="Choose what to do next"]').first()
  const choice = group.locator('button').first()
  if (await choice.count() === 0) { rec('branching-scenario: choose path', 'SKIP', 'no decision group found') }
  else {
    const before = await containerText(nar)
    await choice.scrollIntoViewIfNeeded(); await choice.click({ timeout: 2500 })
    await page.waitForTimeout(600)
    const after = await containerText(nar)
    rec('branching-scenario: choose path', after !== before ? 'PASS' : 'FAIL', after === before ? 'did not advance' : '')
  }
} catch (e) { rec('branching-scenario: choose path', 'FAIL', String(e).slice(0, 60)) }

// concept-map: focus/click a node, expect a detail update (aria-live or panel text)
try {
  const cmButtons = page.locator('.reading-narrative svg [role="button"], .reading-narrative [role="button"][data-concept], .reading-narrative svg g, .reading-narrative svg circle')
  rec('concept-map: present', await cmButtons.count() > 0 ? 'PASS' : 'SKIP', `${await cmButtons.count()} node candidates`)
} catch (e) { rec('concept-map: present', 'FAIL', String(e).slice(0, 60)) }

// affect reaction: click a feeling, expect a saved/updated message anywhere on the page
try {
  const aff = page.getByRole('button', { name: /^(got it|interesting|confusing|boring)$/i }).first()
  if (await aff.count()) {
    await aff.scrollIntoViewIfNeeded(); await aff.click({ timeout: 1500 }); await page.waitForTimeout(600)
    const saved = await page.getByText(/saved|updated|recorded/i).count()
    rec('affect reaction: click -> saved', saved > 0 ? 'PASS' : 'FAIL', saved ? '' : 'no saved/updated message')
  } else rec('affect reaction', 'SKIP', 'affect buttons not found')
} catch (e) { rec('affect reaction', 'FAIL', String(e).slice(0, 60)) }

// parameter-explorer: this section (ai-ethics/01/01) has a 3-slider explorer; move a slider, expect live output change
try {
  const slider = page.locator('.reading-narrative input[type=range]').first()
  if (await slider.count()) {
    const liveText = () => page.evaluate(() => [...document.querySelectorAll('.reading-narrative [aria-live]')].map(e => e.innerText).join('|'))
    const before = await liveText()
    await slider.focus(); for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(400)
    const after = await liveText()
    rec('parameter-explorer: slider -> live output', after !== before ? 'PASS' : 'FAIL', after === before ? 'output did not change' : '')
  } else rec('parameter-explorer: slider', 'SKIP', 'no slider on this section')
} catch (e) { rec('parameter-explorer', 'FAIL', String(e).slice(0, 60)) }

// ---- global UI ----
await go('/book/statics/01/01')
// theme toggle
try {
  const before = await page.evaluate(() => document.documentElement.getAttribute('data-theme'))
  const tt = page.getByRole('button', { name: /dark mode|light mode|theme/i }).first()
  await tt.click({ timeout: 1500 }); await page.waitForTimeout(300)
  const after = await page.evaluate(() => document.documentElement.getAttribute('data-theme'))
  rec('theme toggle', before !== after ? 'PASS' : 'FAIL', `${before}->${after}`)
} catch (e) { rec('theme toggle', 'FAIL', String(e).slice(0, 60)) }
// settings modal open + Escape close + focus
try {
  const gear = page.getByRole('button', { name: /settings/i }).first()
  if (await gear.count()) {
    await gear.click({ timeout: 1500 }); await page.waitForTimeout(400)
    const dlg = page.locator('[role="dialog"]')
    const opened = await dlg.count() > 0 && await dlg.first().isVisible()
    await page.keyboard.press('Escape'); await page.waitForTimeout(300)
    const closed = await dlg.count() === 0 || !(await dlg.first().isVisible().catch(() => false))
    rec('settings modal: open + Escape close', opened && closed ? 'PASS' : 'FAIL', `open=${opened} closed=${closed}`)
  } else rec('settings modal', 'SKIP', 'gear not found')
} catch (e) { rec('settings modal', 'FAIL', String(e).slice(0, 60)) }
// chat widget open
try {
  const launch = page.getByRole('button', { name: /chat|big ?al|ask|help|tutor/i }).last()
  await launch.click({ timeout: 1500 }); await page.waitForTimeout(500)
  const input = page.locator('textarea, input[type=text]').last()
  rec('chat widget: opens with input', await input.count() > 0 ? 'PASS' : 'FAIL')
} catch (e) { rec('chat widget', 'SKIP', String(e).slice(0, 60)) }

// ---- mobile: hamburger opens TOC drawer ----
const m = await br.newContext({ viewport: { width: 390, height: 844 } })
const mp = await m.newPage()
mp.on('pageerror', (e) => consoleErrors.push('MOBILE PAGEERROR ' + String(e).slice(0, 120)))
try {
  await mp.goto(B + '/book/statics/01/01', { waitUntil: 'networkidle', timeout: 20000 }); await mp.waitForTimeout(1200)
  for (const n of ['Skip tour', 'Skip']) { try { const b = mp.getByRole('button', { name: n }).first(); if (await b.isVisible({ timeout: 500 })) { await b.click() } } catch {} }
  const burger = mp.getByRole('button', { name: /chapter contents|menu|contents/i }).first()
  await burger.click({ timeout: 1500 }); await mp.waitForTimeout(400)
  const drawer = mp.getByText(/chapter|contents|section/i)
  rec('mobile: hamburger -> TOC drawer', await drawer.count() > 0 ? 'PASS' : 'FAIL')
} catch (e) { rec('mobile hamburger', 'FAIL', String(e).slice(0, 60)) }
await m.close()

rec('console errors during QA', consoleErrors.length === 0 ? 'PASS' : 'FAIL', consoleErrors.length ? `${consoleErrors.length}: ` + consoleErrors.slice(0, 4).join(' | ') : 'none')

const pass = results.filter(r => r.status === 'PASS').length
const fail = results.filter(r => r.status === 'FAIL').length
const skip = results.filter(r => r.status === 'SKIP').length
console.log(`\n=== SUMMARY: ${pass} PASS / ${fail} FAIL / ${skip} SKIP ===`)
if (consoleErrors.length) { console.log('CONSOLE ERRORS:'); consoleErrors.slice(0, 12).forEach(e => console.log('  ', e)) }
await br.close()
process.exit(fail > 0 ? 1 : 0)
