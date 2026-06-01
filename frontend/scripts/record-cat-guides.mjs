import { chromium } from '@playwright/test'
import fs from 'node:fs/promises'
import path from 'node:path'

const baseURL = process.env.ALGET_RECORD_BASE_URL || 'http://127.0.0.1:6197'
const outRoot = path.resolve('public/guides')
const tempRoot = path.resolve('tmp/guide-recordings')

const scripts = {
  cat100: {
    label: 'CAT 100 Summer I',
    cohortId: 'cat100-summer1-2026',
    name: 'Your Name',
    courseTitle: /CAT 100: Computer Concepts Supplement/i,
    output: 'cat100/media/cat100-walkthrough.webm',
    profile: {
      cohortId: 'cat100-summer1-2026',
      cohortLabel: 'CAT 100 Summer I',
      courseId: 'cat100-supplement',
      track: 'education',
      fullName: 'Your Name',
      learnerHash: 'guidecat100',
      enteredAt: '2026-06-01T00:00:00.000Z',
    },
    captions: [
      'Open ALGET and choose Sign in to start.',
      'Use Current students, enter your real name, and choose your CAT 100 cohort.',
      'After entry, ALGET opens the CAT 100 pathway tied to your name.',
      'Start with the diagnostic when prompted, then move through modules in order.',
      'Use the guide link, support tools, checks, and artifacts as your weekly route.',
    ],
  },
  cat531: {
    label: 'CAT 531',
    cohortId: 'cat531-summer2026',
    name: 'Your Name',
    courseTitle: /CAT 531: Technology and Teaching Supplement/i,
    output: 'cat531/media/cat531-walkthrough.webm',
    profile: {
      cohortId: 'cat531-summer2026',
      cohortLabel: 'CAT 531',
      courseId: 'cat531-supplement',
      track: 'education',
      fullName: 'Your Name',
      learnerHash: 'guidecat531',
      enteredAt: '2026-06-01T00:00:00.000Z',
    },
    captions: [
      'Open ALGET and choose Sign in to start.',
      'Use Current students, enter your real name, and choose CAT 531.',
      'After entry, ALGET opens only the CAT 531 Technology and Teaching pathway.',
      'Read each module as a teaching decision under classroom constraints.',
      'Save portfolio evidence: the decision, evidence, rejected option, and revision.',
    ],
  },
}

async function ensureCaptionLayer(page) {
  await page.evaluate(() => {
    if (document.getElementById('guide-caption-layer')) return
    const layer = document.createElement('div')
    layer.id = 'guide-caption-layer'
    layer.setAttribute('aria-hidden', 'true')
    layer.style.position = 'fixed'
    layer.style.left = '50%'
    layer.style.bottom = '28px'
    layer.style.transform = 'translateX(-50%)'
    layer.style.zIndex = '2147483647'
    layer.style.maxWidth = 'min(980px, calc(100vw - 48px))'
    layer.style.padding = '14px 20px'
    layer.style.borderRadius = '8px'
    layer.style.background = 'rgba(12, 22, 28, 0.88)'
    layer.style.color = '#ffffff'
    layer.style.font = '700 26px/1.35 Inter, Arial, sans-serif'
    layer.style.textAlign = 'center'
    layer.style.boxShadow = '0 18px 50px rgba(0,0,0,.28)'
    layer.style.pointerEvents = 'none'
    document.body.appendChild(layer)
  })
}

async function caption(page, text, delay = 1300) {
  await ensureCaptionLayer(page)
  await page.evaluate((value) => {
    const layer = document.getElementById('guide-caption-layer')
    if (layer) layer.textContent = value
  }, text)
  await page.waitForTimeout(delay)
}

async function recordCourse(browser, key, config) {
  const videoDir = path.join(tempRoot, key)
  await fs.rm(videoDir, { recursive: true, force: true })
  await fs.mkdir(videoDir, { recursive: true })

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    recordVideo: {
      dir: videoDir,
      size: { width: 1280, height: 720 },
    },
  })
  const page = await context.newPage()

  await page.goto(baseURL, { waitUntil: 'networkidle' })
  await caption(page, config.captions[0])
  await page.getByRole('button', { name: /sign in to start/i }).click()
  await caption(page, config.captions[1], 900)
  await page.getByLabel('Name').fill(config.name)
  await page.getByLabel('Cohort').selectOption(config.cohortId)
  await page.waitForTimeout(1000)

  await page.evaluate((profile) => {
    localStorage.setItem('alget_cohort_learner_v1', JSON.stringify(profile))
    localStorage.setItem('alget_social_alias', profile.fullName)
    localStorage.setItem('alget_demo_session', JSON.stringify({
      id: `guide-${profile.cohortId}`,
      email: `${profile.fullName} - ${profile.cohortLabel}`,
      displayName: profile.fullName,
      cohortId: profile.cohortId,
      cohortLabel: profile.cohortLabel,
      courseId: profile.courseId,
      track: profile.track,
      isCohortLearner: true,
      isDemo: true,
      user_metadata: {
        full_name: profile.fullName,
        cohort_id: profile.cohortId,
        cohort_label: profile.cohortLabel,
        course_id: profile.courseId,
        learner_hash: profile.learnerHash,
      },
    }))
  }, config.profile)

  await caption(page, config.captions[2], 900)
  await page.goto(`${baseURL}/learn`, { waitUntil: 'networkidle' })
  await page.getByText(config.courseTitle).waitFor({ timeout: 15000 })
  await caption(page, config.captions[3], 1600)
  await page.getByRole('link', { name: /course guide/i }).first().focus().catch(() => {})
  await caption(page, config.captions[4], 1800)

  const courseCard = page.getByText(config.courseTitle).first()
  await courseCard.scrollIntoViewIfNeeded()
  await page.waitForTimeout(900)
  await context.close()

  const videoFiles = await fs.readdir(videoDir)
  const recorded = videoFiles.find((file) => file.endsWith('.webm'))
  if (!recorded) throw new Error(`No Playwright video produced for ${key}`)
  const target = path.join(outRoot, config.output)
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.copyFile(path.join(videoDir, recorded), target)
}

await fs.mkdir(tempRoot, { recursive: true })
const browser = await chromium.launch()
try {
  for (const [key, config] of Object.entries(scripts)) {
    await recordCourse(browser, key, config)
  }
} finally {
  await browser.close()
}
