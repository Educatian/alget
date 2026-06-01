import { expect, test } from '@playwright/test'

const PERSONA_JOURNEYS = [
    {
        course: 'cat531-supplement',
        chapter: '01',
        section: '01',
        persona: 'CAT 531 in-service teacher',
        expected: /CAT 531|Technology and Teaching|Work Product Studio/i,
        trace: 'As a CAT 531 in-service teacher, the claim is clearer because the section evidence shows how a classroom technology choice needs a value, constraint, and learner impact. Next I will revise my teaching technology plan and compare the decision against equity and feasibility before using it in class.',
    },
    {
        course: 'cat100-supplement',
        chapter: '01',
        section: '01',
        persona: 'CAT 100 first-year learner',
        expected: /CAT 100|Computer Concepts|Work Product Studio/i,
        trace: 'As a CAT 100 first-year learner, the claim is clearer because my annotation evidence shows that a resume or portfolio artifact needs a specific tool, audience, and outcome. Next I will revise the artifact and compare it against the digital identity rubric before submitting.',
    },
]

test.describe('CAT supplement learner journeys', () => {
    test.use({
        viewport: { width: 390, height: 844 },
    })

    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            window.localStorage.setItem('alget_onboarding_completed_v1', 'done')
        })
    })

    for (const journey of PERSONA_JOURNEYS) {
        test(`${journey.persona} can read and complete ${journey.course}`, async ({ page }) => {
            const failures = []

            page.on('console', (message) => {
                if (message.type() === 'error' && !message.text().includes('Failed to load resource: the server responded with a status of 404')) {
                    failures.push(`console error: ${message.text()}`)
                }
            })

            page.on('pageerror', (error) => failures.push(`page error: ${error.message}`))

            await page.goto(`/book/${journey.course}/${journey.chapter}/${journey.section}`, { waitUntil: 'networkidle' })
            await expect(page.locator('body')).toContainText(journey.expected)

            await page.getByRole('button', { name: 'Jump to Finish' }).click()
            await page.getByLabel('State the claim').check()
            await page.getByLabel('Use evidence').check()
            await page.getByLabel('Name the next move').check()
            await page.getByLabel('Exit ticket').fill(journey.trace)

            await expect(page.getByText('120/120 evidence trace')).toBeVisible()
            await page.getByRole('button', { name: 'Complete Section' }).click()
            await expect(page.getByRole('button', { name: 'Section Completed' })).toBeVisible()

            await page.goto('/dashboard', { waitUntil: 'networkidle' })
            await expect(page.getByText('Recent learning traces')).toBeVisible()
            const traceRow = page.locator('li').filter({ hasText: journey.trace.slice(0, 72) })
            await expect(traceRow).toBeVisible()
            await expect(traceRow.getByText('Reuse insight')).toBeVisible()

            expect(failures, failures.join('\n')).toEqual([])
        })
    }
})
