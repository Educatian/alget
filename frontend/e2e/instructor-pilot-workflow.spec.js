import { expect, test } from '@playwright/test'

test.describe('ALGET instructor pilot workflow', () => {
    test('opens the course-scoped workspace and exposes privacy-safe pilot export', async ({ page }) => {
        await page.goto('/instructor', { waitUntil: 'networkidle' })

        await expect(page.getByRole('heading', { name: 'See the course before changing it' })).toBeVisible()

        const reportTab = page.getByRole('button', { name: 'Impact report' })
        expect(await reportTab.count()).toBe(1)
        await reportTab.click()

        const exportButton = page.getByRole('button', { name: 'Export pilot CSV' })
        expect(await exportButton.count()).toBe(1)
        await exportButton.click()
        await expect(page.getByRole('status')).toContainText('privacy-safe pilot events')
    })
})
