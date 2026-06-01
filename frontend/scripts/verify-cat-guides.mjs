import { chromium } from '@playwright/test'

const baseURL = process.env.ALGET_RECORD_BASE_URL || 'http://127.0.0.1:6197'
const guides = [
  { id: 'cat100', title: 'CAT 100 ALGET Student Guide', h1: /Use ALGET as your guided practice space/i },
  { id: 'cat531', title: 'CAT 531 ALGET Student Guide', h1: /Use ALGET to build teaching judgment/i },
]

const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  for (const guide of guides) {
    await page.goto(`${baseURL}/guides/${guide.id}/index.html`, { waitUntil: 'networkidle' })
    await page.waitForFunction((expected) => document.title.includes(expected), guide.title, { timeout: 10000 })
    await page.getByRole('heading', { name: guide.h1 }).waitFor({ timeout: 10000 })
    const media = await page.evaluate(async () => {
      const video = document.querySelector('video')
      const audio = document.querySelector('audio')
      await Promise.all([video, audio].map((el) => new Promise((resolve, reject) => {
        if (!el) {
          reject(new Error('media element missing'))
          return
        }
        if (Number.isFinite(el.duration) && el.duration > 0) {
          resolve()
          return
        }
        el.addEventListener('loadedmetadata', resolve, { once: true })
        el.addEventListener('error', () => reject(new Error(`${el.tagName} failed`)), { once: true })
        el.load()
      })))
      const navBottom = document.querySelector('.topbar')?.getBoundingClientRect().bottom || 0
      const firstHeadingTop = document.querySelector('h1')?.getBoundingClientRect().top || 0
      return {
        videoDuration: video.duration,
        audioDuration: audio.duration,
        navDoesNotCoverHero: firstHeadingTop > navBottom,
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }
    })
    if (media.videoDuration <= 0 || media.audioDuration <= 0) {
      throw new Error(`${guide.id} media did not load`)
    }
    if (media.scrollWidth > media.clientWidth + 2) {
      throw new Error(`${guide.id} has horizontal overflow`)
    }
    console.log(`${guide.id}: video ${media.videoDuration.toFixed(1)}s, audio ${media.audioDuration.toFixed(1)}s`)
  }
} finally {
  await browser.close()
}
