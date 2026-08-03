import { expect, test } from '@playwright/test'

test.describe('ALGET admin control plane', () => {
    test('covers local preview registry, course creation, and governed views', async ({ page }) => {
        await page.goto('/admin', { waitUntil: 'networkidle' })

        await expect(page.getByRole('heading', { name: 'Course operations' })).toBeVisible()
        await expect(page.getByText('Local preview')).toBeVisible()

        const instructorsNav = page.getByRole('button', { name: 'Instructors', exact: true })
        await instructorsNav.click()
        await expect(page.getByRole('heading', { name: 'Instructor registry' })).toBeVisible()
        await page.getByRole('textbox', { name: 'Instructor full name' }).fill('Test Instructor')
        await page.getByRole('textbox', { name: 'Instructor email' }).fill('test.instructor@example.edu')
        await page.getByRole('button', { name: 'Invite instructor', exact: true }).click()
        await expect(page.getByRole('status')).toContainText('Instructor invitation recorded.')

        const approveButtons = page.getByRole('button', { name: 'Approve', exact: true })
        expect(await approveButtons.count()).toBe(1)
        await approveButtons.click()
        await expect(page.getByRole('status')).toContainText('Instructor approved.')

        await page.getByRole('button', { name: 'Courses', exact: true }).click()
        await expect(page.getByRole('heading', { name: 'Managed courses' })).toBeVisible()
        await page.getByRole('textbox', { name: 'Course key' }).fill('e2e-course')
        await page.getByRole('textbox', { name: 'Course title' }).fill('E2E Course')
        await page.getByRole('textbox', { name: 'Course domain' }).fill('Learning science')
        await page.getByRole('combobox', { name: 'Course instructor' }).selectOption({ label: 'Test Instructor' })
        await page.getByRole('button', { name: 'Create', exact: true }).click()
        await expect(page.getByRole('status')).toContainText('Course shell created.')
        await expect(page.getByText('E2E Course')).toBeVisible()

        const viewExpectations = [
            ['PDF ingestion', 'PDF to governed source'],
            ['Agent control', 'Agent control'],
            ['Adaptation', 'Policy Studio'],
            ['Roadmap governance', 'Evidence, agency, and institutional readiness'],
            ['Cohort', 'Cohort analytics'],
            ['Overview', 'One accountable course pipeline'],
        ]
        for (const [view, heading] of viewExpectations) {
            await page.getByRole('button', { name: view, exact: true }).click()
            await expect(page.getByRole('heading', { name: heading })).toBeVisible()
        }
    })
})
