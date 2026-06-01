import { chromium, expect } from '@playwright/test'

const baseURL = process.env.ALGET_APP_URL || 'https://significant-upgrade.alget.pages.dev'

const cases = [
  {
    guide: '/guides/cat100/index.html',
    courseName: 'CAT 100',
    cohortId: 'cat100-summer1-2026',
    cohortLabel: 'CAT 100 Summer I',
    learnerName: 'Guide Check CAT100 Summer1',
    bookPath: '/book/cat100-supplement/01/01',
    requiredGuideText: [
      'Current students',
      'real full name',
      'CAT 100 Summer I',
      'CAT 100 Summer II',
      'course LMS',
    ],
  },
  {
    guide: '/guides/cat100/index.html',
    courseName: 'CAT 100',
    cohortId: 'cat100-summer2-2026',
    cohortLabel: 'CAT 100 Summer II',
    learnerName: 'Guide Check CAT100 Summer2',
    bookPath: '/book/cat100-supplement/01/01',
    requiredGuideText: [
      'Current students',
      'real full name',
      'CAT 100 Summer I',
      'CAT 100 Summer II',
      'course LMS',
    ],
  },
  {
    guide: '/guides/cat531/index.html',
    courseName: 'CAT 531',
    cohortId: 'cat531-summer2026',
    cohortLabel: 'CAT 531',
    learnerName: 'Guide Check CAT531',
    bookPath: '/book/cat531-supplement/01/01',
    requiredGuideText: [
      'Current students',
      'real full name',
      'CAT 531',
      'portfolio evidence',
      'official course LMS',
    ],
  },
]

async function verifyGuidePage(page, testCase) {
  await page.goto(new URL(testCase.guide, baseURL).toString(), {
    waitUntil: 'networkidle',
    timeout: 60_000,
  })
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 20_000 })

  const bodyText = await page.locator('body').innerText({ timeout: 20_000 })
  const missing = testCase.requiredGuideText.filter((text) => !bodyText.includes(text))
  if (missing.length) {
    throw new Error(`${testCase.cohortLabel} guide missing text: ${missing.join(', ')}`)
  }

  const media = await page.evaluate(async () => {
    const video = document.querySelector('video')
    const audio = document.querySelector('audio')
    if (!video || !audio) return { video: 0, audio: 0 }
    await Promise.all([video, audio].map((el) => new Promise((resolve, reject) => {
      if (Number.isFinite(el.duration) && el.duration > 0) {
        resolve()
        return
      }
      el.addEventListener('loadedmetadata', resolve, { once: true })
      el.addEventListener('error', () => reject(new Error(`${el.tagName} failed to load`)), { once: true })
      el.load()
    })))
    return {
      video: video.duration,
      audio: audio.duration,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }
  })
  if (media.video <= 0 || media.audio <= 0) {
    throw new Error(`${testCase.cohortLabel} guide media did not load`)
  }
  if (media.overflow > 2) {
    throw new Error(`${testCase.cohortLabel} guide has horizontal overflow: ${media.overflow}`)
  }

  await page.getByRole('link', { name: /Open ALGET/i }).click()
}

async function enterAsCurrentStudent(page, testCase) {
  await page.waitForURL(/\/learn/, { timeout: 30_000 })
  await page.getByRole('button', { name: /Sign in to start/i }).click({ timeout: 30_000 })
  await page.getByLabel('Name').fill(testCase.learnerName)
  await page.getByLabel('Cohort').selectOption(testCase.cohortId)
  await page.getByRole('button', { name: /Enter my course/i }).click()
  await expect(page.getByText(testCase.learnerName).first()).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText(testCase.courseName).first()).toBeVisible({ timeout: 30_000 })
}

async function verifyFirstTextbookPage(page, testCase) {
  await page.goto(new URL(testCase.bookPath, baseURL).toString(), {
    waitUntil: 'networkidle',
    timeout: 60_000,
  })
  await expect(page.getByRole('button', { name: /Open the AI help panel/i })).toBeVisible({
    timeout: 30_000,
  })
  await expect(page.locator('.reading-narrative, #main-content').first()).toBeVisible({
    timeout: 30_000,
  })
  await expect(page.getByRole('button', { name: /Get a hint/i }).first()).toBeVisible({
    timeout: 30_000,
  })
}

const browser = await chromium.launch()
const results = []

try {
  for (const testCase of cases) {
    const page = await browser.newPage({ viewport: { width: 1366, height: 820 } })
    try {
      await verifyGuidePage(page, testCase)
      await enterAsCurrentStudent(page, testCase)
      await verifyFirstTextbookPage(page, testCase)
      results.push({ cohort: testCase.cohortLabel, ok: true })
      console.log(`PASS ${testCase.cohortLabel}`)
    } catch (error) {
      results.push({ cohort: testCase.cohortLabel, ok: false, error: error.message })
      console.error(`FAIL ${testCase.cohortLabel}: ${error.message}`)
    } finally {
      await page.close()
    }
  }
} finally {
  await browser.close()
}

const failed = results.filter((result) => !result.ok)
if (failed.length) {
  process.exitCode = 1
}
