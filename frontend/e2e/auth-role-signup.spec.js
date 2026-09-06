import { expect, test } from '@playwright/test'

test.describe('ALGET role-aware onboarding', () => {
    test('exposes the instructor approval path without granting access in the client', async ({ page }) => {
        await page.goto('/', { waitUntil: 'networkidle' })

        await page.getByRole('button', { name: 'Sign out', exact: true }).click()
        await page.getByRole('button', { name: 'Sign in', exact: true }).click()
        // The auth surface opens on the course-learner path. Choose the
        // account path before asserting the sign-in dialog contract.
        await page.getByRole('button', { name: /^ALGET account/ }).click()

        const dialog = page.getByRole('dialog', { name: 'Welcome Back' })
        await expect(dialog).toBeVisible()
        await dialog.getByRole('button', { name: 'Sign Up', exact: true }).click()
        await expect(page.getByRole('dialog', { name: 'Create Your Workspace' })).toBeVisible()

        const accountType = page.getByRole('combobox', { name: 'Account type' })
        await accountType.selectOption('instructor')
        await expect(accountType).toHaveValue('instructor')
        await expect(page.getByLabel('Full name')).toBeVisible()
        await expect(accountType.locator('option[value="instructor"]')).toHaveText('Instructor (requires administrator approval)')
    })
})
