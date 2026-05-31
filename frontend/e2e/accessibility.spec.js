import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const ACCESSIBILITY_ROUTES = [
    { route: '/', label: 'landing' },
    { route: '/book/ail606-supplement/01/01', label: 'book work product flow' },
    { route: '/diagnostic/ail606-supplement?phase=pre', label: 'diagnostic assessment' },
    { route: '/analytics', label: 'research analytics' },
]

test.describe('ALGET accessibility gate', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            window.localStorage.setItem('alget_onboarding_completed_v1', 'done')
        })
    })

    for (const { route, label } of ACCESSIBILITY_ROUTES) {
        test(`${label} has no serious or critical axe violations`, async ({ page }) => {
            await page.goto(route, { waitUntil: 'networkidle' })

            const results = await new AxeBuilder({ page })
                .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
                .exclude('iframe[src*="youtube-nocookie.com"]')
                .analyze()

            const blockingViolations = results.violations.filter((violation) =>
                ['serious', 'critical'].includes(violation.impact || '')
            )

            expect(
                blockingViolations,
                blockingViolations.map((violation) => {
                    const nodes = violation.nodes.map((node) => node.target.join(' ')).join(', ')
                    return `${violation.id} (${violation.impact}): ${violation.help}; nodes=${nodes}`
                }).join('\n')
            ).toEqual([])
        })
    }
})
