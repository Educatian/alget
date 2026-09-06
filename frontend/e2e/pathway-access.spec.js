import { expect, test } from '@playwright/test'

test.describe('ALGET local demo pathway', () => {
    test('unlocks the displayed demo code and reaches the first learning module', async ({ page }) => {
        await page.goto('/learn', { waitUntil: 'networkidle' })

        await expect(page.getByRole('heading', { name: /Open your cohort track/i })).toBeVisible()
        await expect(page.getByText(/Local demo: eng123/i)).toBeVisible()

        await page.getByLabel(/^Access code$/i).fill('eng123')
        await page.getByRole('button', { name: /^Unlock$/i }).click()

        await expect(page.getByText('Engineering Statics')).toBeVisible()
        await expect(page.getByText(/3 available/i)).toBeVisible()

        await page.getByRole('button', { name: /Engineering Statics/i }).click()
        await expect(page).toHaveURL(/\/diagnostic\/statics$/)
        await expect(page.getByRole('heading', { name: /Quick placement check/i })).toBeVisible()

        await page.getByRole('button', { name: /Skip for now/i }).click()
        await expect(page).toHaveURL(/\/book\/statics\/01\/01$/)
        await expect(page.getByRole('heading', { name: /Engineering Statics/i })).toBeVisible()
    })
})
