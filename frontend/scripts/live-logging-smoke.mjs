#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const DEFAULT_APP_URL = 'https://significant-upgrade.alget.pages.dev'
const SERVICE_KEY_FILE = 'C:\\Users\\jewoo\\Desktop\\supabase_alget_servicerole.txt'

const COHORTS = [
  {
    cohortId: 'cat531-summer2026',
    cohortLabel: 'CAT 531',
    courseId: 'cat531-supplement',
    name: 'Codex Smoke CAT531',
  },
  {
    cohortId: 'cat100-summer1-2026',
    cohortLabel: 'CAT 100 Summer I',
    courseId: 'cat100-supplement',
    name: 'Codex Smoke CAT100 Summer1',
  },
  {
    cohortId: 'cat100-summer2-2026',
    cohortLabel: 'CAT 100 Summer II',
    courseId: 'cat100-supplement',
    name: 'Codex Smoke CAT100 Summer2',
  },
]

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return
  const text = fs.readFileSync(filePath, 'utf8')
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#') || !line.includes('=')) continue
    const [key, ...rest] = line.split('=')
    const name = key.trim()
    if (!name || process.env[name]) continue
    let value = rest.join('=').trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    process.env[name] = value
  }
}

function parseArgs(argv) {
  const options = {
    appUrl: process.env.ALGET_APP_URL || DEFAULT_APP_URL,
    headed: false,
  }

  for (const arg of argv) {
    if (arg === '--headed') options.headed = true
    else if (arg.startsWith('--app-url=')) options.appUrl = arg.slice('--app-url='.length)
  }

  return options
}

function hashString(value = '') {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

function learnerHash({ cohortId, name }) {
  return hashString(`${cohortId}:${name.trim().replace(/\s+/g, ' ').toLocaleLowerCase()}`)
}

function getSupabaseConfig(repoRoot) {
  loadEnvFile(path.join(repoRoot, '.env'))
  loadEnvFile(path.join(repoRoot, 'frontend', '.env'))
  loadEnvFile(path.join(repoRoot, 'frontend', '.env.production'))

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ||
    (fs.existsSync(SERVICE_KEY_FILE) ? fs.readFileSync(SERVICE_KEY_FILE, 'utf8').trim() : '')

  if (!supabaseUrl || !serviceKey) {
    throw new Error('Supabase URL and service role key are required for live logging smoke.')
  }

  return { supabaseUrl, serviceKey }
}

async function retry(label, fn, attempts = 12, delayMs = 1000) {
  let lastError = null
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const value = await fn()
      if (value) return value
    } catch (error) {
      lastError = error
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs))
  }
  throw lastError || new Error(`${label} did not become available`)
}

async function waitForRequiredEvents(supabase, userId, sectionId, startedAt, required) {
  let lastRows = []
  for (let attempt = 0; attempt < 12; attempt += 1) {
    lastRows = await readEventTypes(supabase, userId, sectionId, startedAt)
    const eventTypes = new Set(lastRows.map((row) => row.event_type))
    if (required.every((eventType) => eventTypes.has(eventType))) {
      return lastRows
    }
    await new Promise((resolve) => setTimeout(resolve, 1500))
  }

  const seen = Array.from(new Set(lastRows.map((row) => row.event_type))).sort()
  throw new Error(`missing event types for ${sectionId}; required=${required.join(',')}; seen=${seen.join(',') || 'none'}; rows=${lastRows.length}`)
}

async function selectReadableText(page) {
  return page.evaluate(() => {
    const root = document.querySelector('.reading-narrative') || document.querySelector('#main-content') || document.body
    const paragraphs = Array.from(root.querySelectorAll('p[data-reading-kind="paragraph"], p'))
    const paragraph = paragraphs.find((node) => (node.textContent || '').trim().length > 80)
    if (!paragraph?.firstChild) return false

    const textNode = Array.from(paragraph.childNodes).find((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 40)
    if (!textNode) return false

    const range = document.createRange()
    range.setStart(textNode, 0)
    range.setEnd(textNode, Math.min(80, textNode.textContent.length))
    const selection = window.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
    paragraph.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: 240, clientY: 240 }))
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: 240, clientY: 240 }))
    return true
  })
}

async function createHighlight(page) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const paragraph = page.locator('.reading-narrative p[data-reading-kind="paragraph"]').filter({ hasText: /\w/ }).first()
    await paragraph.scrollIntoViewIfNeeded({ timeout: 10_000 })
    const box = await paragraph.boundingBox()
    if (box) {
      const y = box.y + Math.min(24, box.height / 2)
      await page.mouse.move(box.x + 12, y)
      await page.mouse.down()
      await page.mouse.move(Math.min(box.x + box.width - 12, box.x + 360), y, { steps: 8 })
      await page.mouse.up()
    } else {
      const selected = await selectReadableText(page)
      if (!selected) continue
    }
    await page.waitForTimeout(700)

    const highlightButton = page.getByRole('button', { name: /^Highlight$/i })
    if (!(await highlightButton.count())) continue
    await highlightButton.first().evaluate((button) => button.click(), { timeout: 10_000 })
    await page.waitForTimeout(900)

    const markCount = await page.locator('mark[data-highlight="user"]').count()
    const exportCount = await page.getByRole('button', { name: /Export \d+ highlights/i }).count()
    if (markCount > 0 || exportCount > 0) {
      return true
    }
  }

  throw new Error('Could not create a visible highlight during live smoke.')
}

async function exerciseLearnerFlow(page, appUrl, cohort) {
  await page.goto(appUrl, { waitUntil: 'networkidle', timeout: 60_000 })
  await page.getByRole('button', { name: /Sign in to start/i }).click()
  await page.getByLabel('Name').fill(cohort.name)
  await page.getByLabel('Cohort').selectOption(cohort.cohortId)
  await page.getByRole('button', { name: /Enter my course/i }).click()
  await expect(page.getByText(cohort.name).first()).toBeVisible({ timeout: 30_000 })

  await page.goto(new URL(`/book/${cohort.courseId}/01/01`, appUrl).toString(), {
    waitUntil: 'networkidle',
    timeout: 60_000,
  })
  await expect(page.getByRole('button', { name: /Open the AI help panel/i })).toBeVisible({ timeout: 30_000 })

  await createHighlight(page)

  const hintButton = page.getByRole('button', { name: /Get a hint/i }).first()
  if (await hintButton.count()) {
    await hintButton.click({ timeout: 10_000 })
    const closeChat = page.getByRole('button', { name: /Close BigAL tutor chat/i }).last()
    if (await closeChat.count()) {
      await closeChat.click({ timeout: 10_000 })
    }
  }

  await page.getByRole('radio', { name: /It asks you to name a decision/i }).click({ timeout: 20_000 })
  await page.getByRole('button', { name: /Check Answer/i }).click({ timeout: 20_000 })
  await expect(page.getByRole('status').filter({ hasText: /Correct|Not Quite/i })).toBeVisible({ timeout: 20_000 })

  await page.getByRole('button', { name: /Open the AI help panel/i }).click()
  await page.getByRole('tab', { name: /Reframe/i }).click({ timeout: 20_000 })
  await page.getByRole('tab', { name: /Practice/i }).click({ timeout: 20_000 })

  await page.waitForTimeout(8_000)

  return page.evaluate(() => {
    const entries = Object.entries(window.localStorage)
    const authEntry = entries.find(([, value]) => {
      try {
        const parsed = JSON.parse(value)
        return Boolean(parsed?.user?.id || parsed?.currentSession?.user?.id)
      } catch {
        return false
      }
    })
    let userId = null
    if (authEntry) {
      const parsed = JSON.parse(authEntry[1])
      userId = parsed?.user?.id || parsed?.currentSession?.user?.id || null
    }

    return {
      userId,
      cohortProfile: JSON.parse(window.localStorage.getItem('alget_cohort_learner_v1') || 'null'),
    }
  })
}

async function findUserId(supabase, cohort) {
  const hash = learnerHash({ cohortId: cohort.cohortId, name: cohort.name })
  const { data, error } = await supabase
    .from('cohort_learners')
    .select('user_id,display_name,cohort_id,learner_hash')
    .eq('cohort_id', cohort.cohortId)
    .eq('learner_hash', hash)
    .limit(1)

  if (error) throw error
  return data?.[0]?.user_id || null
}

async function readEventTypes(supabase, userId, sectionId, startedAt) {
  const { data, error } = await supabase
    .from('event_logs')
    .select('event_type,event_target,section_id,client_ts')
    .eq('user_id', userId)
    .eq('section_id', sectionId)
    .gte('client_ts', startedAt)
    .order('client_ts', { ascending: true })

  if (error) throw error
  return data || []
}

async function readMirrorCount(supabase, userId, sectionId, startedAt) {
  const { count, error } = await supabase
    .from('interaction_events')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('section_id', sectionId)
    .gte('event_ts', startedAt)

  if (error) throw error
  return count || 0
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const scriptDir = path.dirname(fileURLToPath(import.meta.url))
  const repoRoot = path.resolve(scriptDir, '..', '..')
  const { supabaseUrl, serviceKey } = getSupabaseConfig(repoRoot)
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const browser = await chromium.launch({ headless: !options.headed })
  const results = []

  try {
    for (const cohort of COHORTS) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
      await context.addInitScript(() => {
        window.localStorage.setItem('alget_onboarding_completed_v1', 'done')
      })
      const page = await context.newPage()
      const startedAt = new Date(Date.now() - 1000).toISOString()
      const sectionId = `${cohort.courseId}/01/01`

      const clientState = await exerciseLearnerFlow(page, options.appUrl, cohort)
      await context.close()

      const userId = clientState.userId || await retry(`${cohort.cohortId} roster row`, () => findUserId(supabase, cohort))
      if (!userId) {
        throw new Error(`${cohort.cohortId} did not expose an authenticated user id`)
      }
      const required = ['page_view', 'click', 'highlight_create', 'hint_request', 'problem_attempt', 'support_tab_select']
      const events = await waitForRequiredEvents(supabase, userId, sectionId, startedAt, required)
      const mirrorCount = await readMirrorCount(supabase, userId, sectionId, startedAt)
      if (mirrorCount < events.length) {
        throw new Error(`${cohort.cohortId} interaction_events mirror lagging: ${mirrorCount}/${events.length}`)
      }

      results.push({
        cohortId: cohort.cohortId,
        courseId: cohort.courseId,
        sectionId,
        userId,
        eventTypes: Array.from(new Set(events.map((row) => row.event_type))).sort(),
        eventCount: events.length,
        mirrorCount,
      })
    }
  } finally {
    await browser.close()
  }

  console.log(JSON.stringify({ ok: true, appUrl: options.appUrl, results }, null, 2))
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2))
  process.exit(1)
})
