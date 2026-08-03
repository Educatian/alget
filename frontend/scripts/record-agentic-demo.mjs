/**
 * Record the ALGET governed-agentic-workflow tour as a video.
 *
 * Beats: control plane -> instructor registry -> course shell -> PDF ingestion
 * (upload, in-flight conversion, ingested result) -> governed agent run ->
 * learner pathway unlock -> reading -> study planner (draft -> awaiting
 * approval -> active) -> instructor intervention queue -> adaptation controls.
 *
 * Against the deployed site the administrator pipeline is skipped: every
 * /admin/* endpoint re-verifies the caller against Supabase, so those beats
 * need a real course administrator. Against a local stack started with
 * ALGET_ADMIN_TOKEN, the recorder supplies the matching header and the whole
 * pipeline runs. See docs/DEMO_RECORDING.md.
 *
 *   ALGET_DEMO_BASE_URL=http://127.0.0.1:5173 \
 *   ALGET_DEMO_ADMIN_TOKEN=local-demo-admin-token \
 *   ALGET_DEMO_PDF=../reading/Sosnovsky_2025.pdf \
 *   node scripts/record-agentic-demo.mjs
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs/promises'
import path from 'node:path'

const BASE = process.env.ALGET_DEMO_BASE_URL || 'https://alget.pages.dev'
const ACCESS_CODE = process.env.ALGET_DEMO_ACCESS_CODE || 'eng123'
const ADMIN_TOKEN = process.env.ALGET_DEMO_ADMIN_TOKEN || ''
const STATE_PATH = process.env.ALGET_DEMO_STORAGE_STATE || ''
const PDF_PATH = process.env.ALGET_DEMO_PDF || ''
// Source document for the faculty pipeline — the only path that yields a
// learner-visible generated module — and the course whose reader shows it.
const GOOGLE_DOC = process.env.ALGET_DEMO_GOOGLE_DOC || ''
let READER_COURSE = process.env.ALGET_DEMO_READER_COURSE || ''
const VP = { width: 1280, height: 800 }
const OUT = path.resolve('tmp/agentic-demo')

// The course is named after the source document's subject, not borrowed from
// the authored catalogue: the reader builds a table of contents from published
// modules alone when a course has no authored chapters behind it.
const COURSE_KEY = process.env.ALGET_DEMO_COURSE_KEY || 'intelligent-textbooks'
const COURSE_TITLE = process.env.ALGET_DEMO_COURSE_TITLE || 'Intelligent Textbooks: Evidence and Design'
// The reader opens the course the tour just built, unless told otherwise.
READER_COURSE = READER_COURSE || COURSE_KEY

const done = []
const skipped = []
const beat = (name) => { done.push(name); console.log(`  beat: ${name}`) }
const skip = (name, why) => { skipped.push(`${name} (${why})`); console.log(`  SKIP: ${name} — ${why}`) }

/** Visible pointer + caption band, installed so it survives navigation. */
function installChrome() {
  if (window.__demoChrome) return
  const mount = () => {
    if (window.__demoChrome || !document.documentElement) return
    const cur = document.createElement('div')
    cur.style.cssText = 'position:fixed;z-index:2147483647;width:22px;height:22px;'
      + 'margin:-11px 0 0 -11px;border-radius:50%;background:rgba(158,27,50,.30);'
      + 'border:2px solid #9E1B32;pointer-events:none;left:-99px;top:-99px;'
      + 'transition:transform .08s ease;box-shadow:0 0 10px rgba(158,27,50,.45)'
    const cap = document.createElement('div')
    cap.style.cssText = 'position:fixed;z-index:2147483646;left:50%;bottom:26px;'
      + 'transform:translateX(-50%);max-width:76%;padding:11px 20px;border-radius:9px;'
      + 'background:rgba(17,17,19,.90);color:#fff;'
      + 'font:500 15px/1.45 ui-sans-serif,system-ui,-apple-system,sans-serif;'
      + 'text-align:center;pointer-events:none;opacity:0;transition:opacity .25s ease;'
      + 'box-shadow:0 6px 24px rgba(0,0,0,.32)'
    document.documentElement.append(cur, cap)
    window.__demoChrome = { cur, cap }
    if (window.__demoCaption) {
      cap.textContent = window.__demoCaption
      cap.style.opacity = window.__demoCaption ? '1' : '0'
    }
    const move = (e) => { cur.style.left = e.clientX + 'px'; cur.style.top = e.clientY + 'px' }
    document.addEventListener('mousemove', move, true)
    document.addEventListener('mousedown', (e) => { cur.style.transform = 'scale(.62)'; move(e) }, true)
    document.addEventListener('mouseup', () => { cur.style.transform = 'scale(1)' }, true)
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount)
  else mount()
  setInterval(mount, 1200)
}

/** One cohort intervention already awaiting review, for the queue beat. */
function seedIntervention() {
  const now = new Date().toISOString()
  const workflow = {
    id: 'workflow-demo-intervention', owner_id: 'e2e-user',
    course_id: 'statics', workflow_type: 'instructor_intervention', status: 'awaiting_approval',
    risk_level: 'medium', goal: 'Re-teach force vectors', created_at: now, updated_at: now,
  }
  const intervention = {
    id: 'intervention-demo', workflow_id: workflow.id, course_id: 'statics',
    concept_id: 'force_vectors', title: 'Re-teach force vectors',
    status: 'awaiting_approval', risk_level: 'medium', created_at: now, updated_at: now,
    agent_workflows: workflow,
    proposal: {
      summary: 'Prepare a short compare-and-correct activity; review the next evidence snapshot before further action.',
      evidence: { learner_count: 8, average_mastery: 0.38, urgency: 'urgent', causal_claim: false },
      delivery: { executed: false, requires_instructor_approval: true },
    },
  }
  localStorage.setItem('alget_agentic_lms_v1', JSON.stringify({
    goals: [], workflows: [workflow], studyPlans: [], interventions: [intervention], events: [],
  }))
}

const hold = (page, ms) => page.waitForTimeout(ms)

// Caption timings, relative to the first frame, so narration and subtitles can
// be laid over the finished recording without guessing where each line lands.
const captionLog = []
let recordingStartedAt = 0

async function caption(page, text) {
  if (text && recordingStartedAt) {
    const at = (Date.now() - recordingStartedAt) / 1000
    const previous = captionLog[captionLog.length - 1]
    if (previous) previous.end = at
    captionLog.push({ at, end: at, text })
  }
  await page.evaluate((value) => {
    window.__demoCaption = value
    const cap = window.__demoChrome?.cap
    if (!cap) return
    cap.textContent = value
    cap.style.opacity = value ? '1' : '0'
  }, text).catch(() => {})
}

const seen = (locator, ms = 4000) => locator.isVisible({ timeout: ms }).catch(() => false)

/** Move the visible pointer onto an element, pause, then click it. */
async function show(page, locator, { pause = 560 } = {}) {
  await locator.scrollIntoViewIfNeeded().catch(() => {})
  const box = await locator.boundingBox().catch(() => null)
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 20 })
    await hold(page, pause)
  }
  await locator.click()
}

async function type(page, locator, value, delay = 45) {
  await show(page, locator, { pause: 380 })
  await locator.fill('')
  await locator.type(value, { delay })
  await hold(page, 400)
}

/** The reading surface opens a 5-step product tour; dismiss it if present. */
async function dismissProductTour(page) {
  for (const name of [/Skip tour/i, /Skip for now/i]) {
    const btn = page.getByRole('button', { name }).first()
    if (await seen(btn, 2200)) {
      await show(page, btn)
      await hold(page, 1000)
      return true
    }
  }
  return false
}

const tab = (page, name) => page.getByRole('button', { name }).first()

async function main() {
  const adminMode = Boolean(PDF_PATH && (ADMIN_TOKEN || STATE_PATH))
  console.log(`base: ${BASE}`)
  console.log(`mode: ${adminMode ? 'FULL TOUR (administrator pipeline enabled)' : 'learner-only'}`)

  let pdfAbs = ''
  if (adminMode) {
    pdfAbs = path.resolve(PDF_PATH)
    await fs.access(pdfAbs)
    console.log(`pdf:  ${pdfAbs}`)
  }

  await fs.rm(OUT, { recursive: true, force: true })
  await fs.mkdir(OUT, { recursive: true })

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: VP,
    deviceScaleFactor: 1,
    recordVideo: { dir: OUT, size: VP },
    ...(STATE_PATH ? { storageState: STATE_PATH } : {}),
  })
  if (ADMIN_TOKEN) await context.setExtraHTTPHeaders({ 'X-Alget-Admin-Token': ADMIN_TOKEN })
  await context.addInitScript(installChrome)

  const page = await context.newPage()
  page.setDefaultTimeout(25000)
  recordingStartedAt = Date.now()

  try {
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await page.evaluate(seedIntervention)

  // ---- 1. Landing -------------------------------------------------------
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await caption(page, 'ALGET — an intelligent textbook that plans with you, not for you.')
  await hold(page, 3800)
  await page.mouse.wheel(0, 480); await hold(page, 1800)
  await caption(page, 'Every recommendation ties a learner action to visible evidence.')
  await hold(page, 2800)
  await page.mouse.wheel(0, -480); await hold(page, 1400)
  beat('landing')

  // ---- 2. Build a course from a source document -------------------------
  if (adminMode) {
    await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' })
    await dismissProductTour(page)
    await caption(page, 'A course is built under one accountable pipeline.')
    await hold(page, 3200)

    // 2a. Register the accountable owner.
    const instructorsTab = tab(page, /^Instructors$/i)
    if (await seen(instructorsTab)) {
      await show(page, instructorsTab)
      await hold(page, 1800)
      // Registration itself is skipped on camera: it provisions a real account
      // and emails an invitation, which a recording should not trigger.
      await caption(page, 'Every course has an accountable owner on the register before anything is built.')
      await hold(page, 3600)
      beat('instructor-registry')
    } else skip('instructor-registry', 'Instructors tab not visible')

    // 2b. Create the course shell.
    const coursesTab = tab(page, /^Courses$/i)
    if (await seen(coursesTab)) {
      await show(page, coursesTab)
      await hold(page, 1800)
      await caption(page, 'The course shell binds an owner, a domain, and a release policy.')
      await hold(page, 2600)
      await type(page, page.getByLabel(/Course key/i), COURSE_KEY)
      await type(page, page.getByLabel(/^Course title$/i), COURSE_TITLE)
      await type(page, page.getByLabel(/Course domain/i), 'Learning Engineering')
      const instructorSelect = page.getByLabel(/Course instructor/i)
      await show(page, instructorSelect, { pause: 380 })
      const owners = await instructorSelect.locator('option').count().catch(() => 0)
      if (owners < 2) skip('course-owner', 'no registered instructor available to own the course')
      await instructorSelect.selectOption({ index: 1 }).catch(() => {})
      await hold(page, 800)
      await show(page, page.getByRole('button', { name: /^Create$/ }))
      await hold(page, 3000)
      beat('course-created')
      // The ingestion and instructor surfaces read their course lists once on
      // mount, so a course created in this session is invisible to them until
      // the app reloads.
      await page.reload({ waitUntil: 'networkidle' })
      await dismissProductTour(page)
      await hold(page, 1200)
    } else skip('course-created', 'Courses tab not visible')

    // 2c. Ingest the source PDF — the beat the demo is built around.
    const ingestionTab = tab(page, /^PDF ingestion$/i)
    if (await seen(ingestionTab)) {
      await show(page, ingestionTab)
      await hold(page, 2000)
      await caption(page, 'PDF to governed source: page-addressable text, a checksum, OCR risk flags.')
      await hold(page, 3400)

      const courseSelect = page.getByLabel(/PDF target course/i)
      const options = await courseSelect.locator('option').count().catch(() => 0)
      if (options > 1) {
        await show(page, courseSelect, { pause: 380 })
        await courseSelect.selectOption({ index: 1 })
        await hold(page, 1000)
        await page.getByLabel(/Course PDF/i).setInputFiles(pdfAbs)
        await caption(page, `Uploading ${path.basename(pdfAbs)} as the course source.`)
        await hold(page, 2600)

        await show(page, page.getByRole('button', { name: /Convert PDF/i }))
        await caption(page, 'The pipeline extracts every page and checksums the source.')
        if (await seen(page.getByRole('button', { name: /Converting/i }), 2500)) beat('pdf-converting-state')
        await page.waitForFunction(
          () => !/Converting/i.test(document.body.innerText),
          null, { timeout: 180000 },
        ).catch(() => {})
        await hold(page, 2600)
        await caption(page, 'Ingested and recorded — pages, quality, and any warnings.')
        await hold(page, 4200)
        beat('pdf-ingested')
      } else skip('pdf-ingested', 'no managed course available in the target select')
    } else skip('pdf-ingested', 'PDF ingestion tab not visible')

    // 2d. The governed agent run over that source.
    const agentsTab = tab(page, /^Agent control$/i)
    if (await seen(agentsTab)) {
      await show(page, agentsTab)
      await hold(page, 2200)
      await caption(page, 'Agents plan first. Nothing executes on its own.')
      await hold(page, 3000)
      const runCourse = page.getByLabel(/Agent run course/i)
      if (await seen(runCourse)) {
        await show(page, runCourse, { pause: 380 })
        await runCourse.selectOption({ index: 1 }).catch(() => {})
        await hold(page, 1400)
      }
      const planBtn = page.getByRole('button', { name: /Create run plan/i })
      if (await seen(planBtn) && await planBtn.isEnabled().catch(() => false)) {
        await show(page, planBtn)
        await hold(page, 3200)
        const approveRun = page.getByRole('button', { name: /Approve plan/i }).first()
        if (await seen(approveRun, 6000)) {
          await caption(page, 'A person approves the run — and release stays gated even then.')
          await hold(page, 2600)
          await show(page, approveRun)
          await hold(page, 3200)
        }
        beat('agent-run-approved')
      } else skip('agent-run-approved', 'run plan control disabled — course or approved source missing')
    } else skip('agent-run-approved', 'Agent control tab not visible')
  } else {
    skip('course-creation', 'no administrator pipeline configured')
  }

  // ---- 2e. Generate the course learners actually read -------------------
  // The faculty pipeline is the only path that produces a learner-visible
  // module: draft from a source, review it in shadow mode, then publish it into
  // the course reader.
  if (GOOGLE_DOC || pdfAbs) {
    await page.goto(`${BASE}/instructor`, { waitUntil: 'networkidle' })
    await dismissProductTour(page)
    // The dashboard defaults to the alphabetically first assigned course, which
    // need not be the one this tour just built.
    const courseSelect = page.getByLabel(/^Course$/i)
    const anySelect = page.locator('select').first()
    const picker = await seen(courseSelect, 3000) ? courseSelect : anySelect
    if (await seen(picker, 3000)) {
      await picker.selectOption({ label: COURSE_TITLE }).catch(async () => {
        await picker.selectOption({ value: COURSE_KEY }).catch(() => {})
      })
      await hold(page, 1800)
    }

    const pilotTab = tab(page, /^Shadow pilot$/i)
    if (await seen(pilotTab)) {
      await show(page, pilotTab)
      await hold(page, 2000)
      await caption(page, 'A course source becomes a draft the instructor reviews privately first.')
      await hold(page, 3000)

      const pdfField = page.getByLabel(/PDF course source/i)
      const docField = page.getByLabel(/Google Docs course source/i)
      if (pdfAbs && await seen(pdfField)) {
        await pdfField.setInputFiles(pdfAbs)
        await caption(page, `Uploading ${path.basename(pdfAbs)}.`)
        await hold(page, 2400)
        await show(page, page.getByRole('button', { name: /Upload & draft/i }))
        await caption(page, 'ALGET reads the source and drafts objectives, sections, activities, and simulations.')
        if (await seen(page.getByRole('button', { name: /Drafting/i }), 3000)) beat('draft-generating-state')
        await page.waitForFunction(
          () => !/Drafting…/.test(document.body.innerText),
          null, { timeout: 240000 },
        ).catch(() => {})
        await hold(page, 3400)
      } else if (await seen(docField)) {
        await type(page, docField, GOOGLE_DOC, 12)
        await show(page, page.getByRole('button', { name: /Connect & draft/i }))
        await caption(page, 'ALGET reads the source and drafts objectives, sections, activities, and simulations.')
        if (await seen(page.getByRole('button', { name: /Connecting/i }), 2500)) beat('draft-generating-state')
        await page.waitForFunction(
          () => !/Connecting…/.test(document.body.innerText),
          null, { timeout: 180000 },
        ).catch(() => {})
        await hold(page, 3400)
      }
      {
        await caption(page, 'The generated module — grounded in the source, nothing published yet.')
        await hold(page, 4000)
        beat('course-drafted')

        const startShadow = page.getByRole('button', { name: /Start shadow mode/i })
        if (await seen(startShadow)) {
          await show(page, startShadow)
          await hold(page, 3400)
          await caption(page, 'Shadow mode: the instructor can see it, students cannot.')
          await hold(page, 3000)
          beat('shadow-started')
        }
        const markReady = page.getByRole('button', { name: /Mark ready for review/i })
        if (await seen(markReady)) {
          await show(page, markReady)
          await hold(page, 2800)
        }
        const publish = page.getByRole('button', { name: /Approve & publish/i })
        if (await seen(publish)) {
          await caption(page, 'Publishing is a separate, deliberate approval.')
          await hold(page, 2600)
          await show(page, publish)
          await page.waitForFunction(
            () => !/Publishing…/.test(document.body.innerText),
            null, { timeout: 120000 },
          ).catch(() => {})
          await hold(page, 3400)
          beat('course-published')
        } else skip('course-published', 'publish control never became available')
      }
    } else skip('course-drafted', 'Shadow pilot tab not reachable')

    // The learner side of the same course now carries the generated module.
    if (READER_COURSE) {
      await page.goto(`${BASE}/book/${READER_COURSE}`, { waitUntil: 'networkidle' })
      await dismissProductTour(page)
      await caption(page, 'The learner opens the course.')
      await hold(page, 3000)
      const publishedChapter = page.getByText(/Instructor-published modules/i).first()
      if (await seen(publishedChapter, 8000)) {
        await publishedChapter.scrollIntoViewIfNeeded().catch(() => {})
        await hold(page, 1400)
        await caption(page, 'The module built from the source is here — Instructor-published modules.')
        await hold(page, 3600)
        await show(page, publishedChapter).catch(() => {})
        await hold(page, 2400)
        beat('published-module-in-toc')

        // Open one generated section so the module is seen as a lesson, not a
        // table-of-contents entry.
        const generatedSection = page.getByRole('button', { name: /Introduction to Intelligent Textbooks/i }).first()
        const anySection = page.locator('nav button, aside button').filter({ hasText: /Intelligent Textbooks|Generation \d/i }).first()
        const target = await seen(generatedSection, 4000) ? generatedSection : anySection
        if (await seen(target, 4000)) {
          await show(page, target)
          await hold(page, 4200)
          await caption(page, 'A lesson generated from the PDF: objectives, reading, activity, and a proposed simulation.')
          await hold(page, 4000)
          await page.mouse.wheel(0, 520); await hold(page, 3000)
          await page.mouse.wheel(0, 520); await hold(page, 3000)
          beat('published-section-open')
        } else skip('published-section-open', 'generated section entry not clickable')
      } else skip('published-module-in-toc', 'published chapter not rendered in the reader')
    }
  }

  // ---- 3. Learner pathway access ----------------------------------------
  await caption(page, 'On the learner side, pathways are access-gated and validated server-side.')
  await page.goto(`${BASE}/learn`, { waitUntil: 'networkidle' })
  await hold(page, 2600)

  const codeField = page.getByLabel(/access code/i)
  if (await seen(codeField)) {
    await type(page, codeField, ACCESS_CODE, 130)
    await show(page, page.getByRole('button', { name: /^Unlock$/i }))
    await hold(page, 3600)
    await caption(page, 'The pathways open up.')
    await hold(page, 2800)
    beat('pathway-unlock')
  } else skip('pathway-unlock', 'already unlocked or gate not shown')

  // ---- 4. Reading --------------------------------------------------------
  const course = page.getByRole('button', { name: /Bio-Inspired Design/i }).first()
  if (await seen(course)) {
    await caption(page, 'Opening a course begins with a short placement check.')
    await show(page, course)
    await hold(page, 3000)
    await dismissProductTour(page)
    await hold(page, 1600)
    await dismissProductTour(page)
    await caption(page, 'Reading, practice, and generative support stay beside the concept.')
    await hold(page, 3200)
    await page.mouse.wheel(0, 560); await hold(page, 2600)
    beat('reading')
  } else skip('reading', 'course card not visible')

  // ---- 5. The learner study planner -------------------------------------
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' })
  await dismissProductTour(page)
  await caption(page, 'The learner dashboard turns a goal into a plan you control.')
  await hold(page, 3000)

  const goal = page.getByPlaceholder(/Learning goal/i)
  if (await seen(goal)) {
    await type(page, goal, 'Master directional adhesion before Friday')
    await caption(page, 'BigAL drafts from mastery evidence, your deadline, and your weekly time.')
    await hold(page, 2400)
    await show(page, page.getByRole('button', { name: /Draft plan/i }))
    await hold(page, 4000)
    await caption(page, 'The plan arrives AWAITING APPROVAL. Nothing has started.')
    await hold(page, 3800)
    await page.mouse.wheel(0, 220); await hold(page, 2400)
    await caption(page, 'Editable, pausable, cancellable — and no silent automation.')
    await hold(page, 3400)
    beat('plan-drafted')

    const approve = page.getByRole('button', { name: /Approve plan/i }).first()
    if (await seen(approve)) {
      await caption(page, 'Only the learner can approve it.')
      await show(page, approve)
      await hold(page, 3400)
      await caption(page, 'Now — and only now — the plan is ACTIVE.')
      await hold(page, 3400)
      beat('plan-approved')
    } else skip('plan-approved', 'approve control not visible')
  } else skip('plan-drafted', 'planner form not visible')

  // ---- 6. Instructor intervention queue ---------------------------------
  await page.goto(`${BASE}/instructor`, { waitUntil: 'networkidle' })
  await dismissProductTour(page)
  const queue = page.getByRole('heading', { name: /Instructor intervention queue/i })
  if (await seen(queue)) {
    await caption(page, 'Instructors see cohort evidence before anything changes.')
    await hold(page, 2800)
    await queue.scrollIntoViewIfNeeded().catch(() => {})
    await hold(page, 1400)
    await caption(page, 'Evidence → proposal → human decision. 8 learners, 38% average, correlational.')
    await hold(page, 3800)
    beat('intervention-queue')

    const approveDraft = page.getByRole('button', { name: /Approve draft/i }).first()
    if (await seen(approveDraft)) {
      await caption(page, 'Approval records the decision. It does not send or grade.')
      await hold(page, 2800)
      await show(page, approveDraft)
      await hold(page, 3200)
      beat('intervention-approved')
    } else skip('intervention-approved', 'no pending draft rendered')
  } else skip('intervention-queue', 'instructor surface not reachable')

  // ---- 7. Adaptation controls -------------------------------------------
  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' })
  await dismissProductTour(page)
  const adaptation = tab(page, /^Adaptation$/i)
  if (await seen(adaptation)) {
    await caption(page, 'The control plane keeps every agent decision attributable.')
    await hold(page, 2600)
    await show(page, adaptation)
    await hold(page, 3200)
    await caption(page, 'Adaptive support pauses instantly, without deleting policy history.')
    await hold(page, 3600)
    beat('adaptation')
  } else skip('adaptation', 'admin surface not reachable')

  await caption(page, 'Automation prepares the work. A person keeps release authority.')
  await hold(page, 4400)
  await caption(page, '')
  await hold(page, 900)
  } catch (error) {
    // Still close the context below so the partial take is written to disk and
    // the beat log shows exactly how far the tour got.
    console.log(`\nTOUR ABORTED: ${String(error?.message || error).split('\n')[0]}`)
  } finally {
    await context.close()
    await browser.close()
  }

  const files = (await fs.readdir(OUT)).filter((f) => f.endsWith('.webm'))
  if (captionLog.length) {
    const last = captionLog[captionLog.length - 1]
    last.end = Math.max(last.end, last.at + 4)
    await fs.writeFile(path.join(OUT, 'captions.json'), JSON.stringify(captionLog, null, 2))
    console.log(`captions: ${path.join(OUT, 'captions.json')} (${captionLog.length} lines)`)
  }
  console.log(`\nbeats recorded (${done.length}): ${done.join(', ')}`)
  if (skipped.length) console.log(`beats skipped (${skipped.length}): ${skipped.join(', ')}`)
  console.log(files.length ? `video: ${path.join(OUT, files[0])}` : 'NO VIDEO PRODUCED')
}

await main()
