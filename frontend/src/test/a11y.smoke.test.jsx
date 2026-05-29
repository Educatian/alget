import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import axe from 'axe-core'
import MainApp from '../pages/MainApp'

// Lightweight axe-core smoke test for the landing / pathway-access surface.
// Asserts the rendered DOM has no `critical`-impact accessibility violations.
// This guards WCAG 2.x regressions (labels, roles, contrast-of-structure,
// duplicate ids, etc.) without the weight of a full e2e a11y sweep.

vi.mock('../components/SettingsModal', () => ({
    default: () => null
}))

vi.mock('../components/CourseIllustrations', () => ({
    StaticsIllustration: () => <div>Statics Illustration</div>,
    BioInspiredIllustration: () => <div>Bio Illustration</div>,
    InstDesignIllustration: () => <div>Inst Illustration</div>
}))

beforeEach(() => {
    globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ valid: true })
    })
})

afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
})

async function runAxe(container) {
    const results = await axe.run(container, {
        // Color-contrast cannot be evaluated reliably in jsdom (no layout /
        // computed paint), so disable that single rule for this unit-level
        // smoke test. Contrast is covered separately by the Playwright a11y
        // sweep against a real browser.
        rules: { 'color-contrast': { enabled: false } }
    })
    return results.violations
}

describe('a11y smoke', () => {
    it('landing / access surface has no critical axe violations', async () => {
        const { container } = render(
            <MemoryRouter>
                <MainApp user={{ email: 'test@example.com' }} onLogout={vi.fn()} />
            </MemoryRouter>
        )

        const violations = await runAxe(container)
        const critical = violations.filter((violation) => violation.impact === 'critical')

        expect(
            critical,
            `Critical a11y violations:\n${critical.map((v) => `- ${v.id}: ${v.help}`).join('\n')}`
        ).toHaveLength(0)
    })

    it('exposes a keyboard skip-to-content bypass link targeting <main>', () => {
        const { container } = render(
            <MemoryRouter>
                <MainApp user={{ email: 'test@example.com' }} onLogout={vi.fn()} />
            </MemoryRouter>
        )

        const skipLink = container.querySelector('a.skip-to-content-link')
        expect(skipLink).not.toBeNull()
        expect(skipLink.getAttribute('href')).toBe('#main-content')

        const main = container.querySelector('main#main-content')
        expect(main).not.toBeNull()
        expect(main.getAttribute('tabindex')).toBe('-1')

        // The skip link must be the first focusable element in the shell.
        const focusable = container.querySelector('a[href], button, input, select, textarea')
        expect(focusable).toBe(skipLink)
    })
})
