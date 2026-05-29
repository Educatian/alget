// Measure reading-view layout widths + toolbar button inventory at desktop width.
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { createRequire } from 'module'
const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const require = createRequire(import.meta.url)
const { chromium } = require(join(ROOT, 'frontend', 'node_modules', 'playwright'))
const BASE = 'http://127.0.0.1:5173'

async function dismissTour(page) {
  for (const name of ['Skip tour', 'Skip', 'Got it', 'Close']) {
    try { const b = page.getByRole('button', { name }).first(); if (await b.isVisible({ timeout: 700 })) { await b.click(); await page.waitForTimeout(150) } } catch {}
  }
}

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
const page = await ctx.newPage()
await page.goto(BASE + '/', { waitUntil: 'networkidle' }).catch(() => {})
for (const name of ['Sign in to start', 'Sign in']) { try { const b = page.getByRole('button', { name }).first(); if (await b.isVisible({ timeout: 1200 })) { await b.click(); await page.waitForTimeout(300); break } } catch {} }
try { const d = page.getByRole('button', { name: 'Continue in Demo Mode' }); if (await d.isVisible({ timeout: 1200 })) { await d.click(); await page.waitForTimeout(400) } } catch {}
await dismissTour(page)
await page.goto(BASE + '/book/statics/01/01', { waitUntil: 'networkidle', timeout: 15000 })
await page.waitForTimeout(1200)
await dismissTour(page)

const measure = await page.evaluate(() => {
  const w = (el) => (el ? Math.round(el.getBoundingClientRect().width) : null)
  const q = (s) => document.querySelector(s)
  const narrative = q('.reading-narrative')
  const para = narrative ? narrative.querySelector('p') : null
  const aside = document.querySelector('aside')
  const main = document.querySelector('#main-content, main')
  // content column = parent of narrative
  const col = narrative ? narrative.closest('main, [class*="max-w"], div') : null
  return {
    viewport: window.innerWidth,
    aside_sidebar: w(aside),
    main: w(main),
    reading_narrative: w(narrative),
    first_paragraph: w(para),
    computed_reading_width: narrative ? getComputedStyle(narrative).getPropertyValue('--reading-width').trim() : null,
    body_scrollWidth: document.body.scrollWidth,
  }
})

// toolbar button inventory: visible text, title, aria-label, box
const buttons = await page.evaluate(() => {
  const header = document.querySelector('header') || document.body
  return [...header.querySelectorAll('button, a[role="button"]')].slice(0, 40).map((b) => ({
    text: (b.textContent || '').trim().slice(0, 24),
    title: b.getAttribute('title') || '',
    aria: b.getAttribute('aria-label') || '',
    w: Math.round(b.getBoundingClientRect().width),
    h: Math.round(b.getBoundingClientRect().height),
  })).filter((b) => b.w > 0)
})

console.log('LAYOUT', JSON.stringify(measure, null, 2))
console.log('\nTOOLBAR BUTTONS (' + buttons.length + '):')
for (const b of buttons) console.log(`  [${b.w}x${b.h}] text="${b.text}" title="${b.title}" aria="${b.aria}"`)
await browser.close()
