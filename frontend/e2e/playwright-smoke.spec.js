import { test, expect } from '@playwright/test'

const ROUTES = [
    { route: '/', expected: /Generative Intelligent Textbook|Pathways Workspace/i },
    { route: '/book/ail606-supplement/01/01', expected: /AIL 606|Work Product Studio|Cognitive Architecture/i },
    { route: '/book/cat531-supplement/01/01', expected: /CAT 531|Work Product Studio/i },
    { route: '/book/cat100-supplement/01/01', expected: /CAT 100|Work Product Studio/i },
    { route: '/book/inst-design/01/01', expected: /Instructional Design|Learning Workspace|Work Product Studio/i },
    { route: '/diagnostic/ail606-supplement?phase=pre', expected: /Diagnostic|AIL 606|pre/i },
    { route: '/analytics', expected: /Research|Analytics|Console/i },
]

function shouldIgnoreConsoleError(text) {
    return (
        text.includes('Failed to load resource: the server responded with a status of 404') ||
        text === 'Permissions policy violation: compute-pressure is not allowed in this document.'
    )
}

test.describe('ALGET browser smoke routes', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            window.localStorage.setItem('alget_onboarding_completed_v1', 'done')
        })
    })

    for (const { route, expected } of ROUTES) {
        test(`renders ${route} without browser errors`, async ({ page }) => {
            const failures = []

            page.on('console', (message) => {
                if (message.type() === 'error' && !shouldIgnoreConsoleError(message.text())) {
                    failures.push(`console error: ${message.text()}`)
                }
            })

            page.on('pageerror', (error) => {
                failures.push(`page error: ${error.message}`)
            })

            page.on('requestfailed', (request) => {
                const url = request.url()
                if (url.includes('127.0.0.1:5173') || url.includes('127.0.0.1:8000')) {
                    failures.push(`request failed: ${url} ${request.failure()?.errorText || ''}`)
                }
            })

            page.on('response', (response) => {
                const url = response.url()
                if (
                    response.status() >= 400 &&
                    (url.includes('127.0.0.1:5173') || url.includes('127.0.0.1:8000')) &&
                    !url.endsWith('/favicon.ico')
                ) {
                    failures.push(`response ${response.status()}: ${url}`)
                }
            })

            const response = await page.goto(route, {
                waitUntil: 'networkidle',
                timeout: 45_000,
            })

            expect(response?.status(), `${route} should return a non-error HTTP status`).toBeLessThan(400)

            const bodyText = await page.locator('body').innerText()
            expect(bodyText).not.toMatch(/Application error|Section Not Found|Failed to load/i)
            expect(bodyText).toMatch(expected)
            expect(failures, failures.join('\n')).toEqual([])
        })
    }
})
