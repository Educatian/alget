import { expect, test } from '@playwright/test'

const READER_ROUTE = '/book/ail606-supplement/01/01'

const VIEWPORTS = [
    { width: 375, height: 812 },
    { width: 720, height: 900 },
    { width: 721, height: 900 },
    { width: 768, height: 900 },
    { width: 1280, height: 900 },
]

const PREFERENCES = [
    { name: 'Compact', lineHeight: 'compact', multiplier: 1.42 },
    { name: 'Standard', lineHeight: 'standard', multiplier: 1.58 },
    { name: 'Relaxed', lineHeight: 'relaxed', multiplier: 1.75 },
]

async function openReader(page, viewport, prefs) {
    await page.setViewportSize(viewport)
    await page.addInitScript((readingPrefs) => {
        window.localStorage.setItem('alget_onboarding_completed_v1', 'done')
        window.localStorage.setItem('alget_reading_prefs', JSON.stringify(readingPrefs))
    }, prefs)

    await page.goto(READER_ROUTE, { waitUntil: 'networkidle' })
    await page.locator('.reading-narrative p').first().waitFor()
    await page.locator('.reading-narrative li').first().waitFor()
}

async function readTypography(page) {
    return page.evaluate(() => {
        const root = document.documentElement
        const narrative = document.querySelector('.reading-narrative')
        const paragraph = narrative?.querySelector('p')
        const listItem = narrative?.querySelector('li')

        if (!(narrative instanceof HTMLElement) ||
            !(paragraph instanceof HTMLElement) ||
            !(listItem instanceof HTMLElement)) {
            throw new Error('Reader paragraph and list fixtures must be present')
        }

        const rootStyle = getComputedStyle(root)
        const narrativeStyle = getComputedStyle(narrative)
        const paragraphStyle = getComputedStyle(paragraph)
        const listStyle = getComputedStyle(listItem)

        return {
            rootLineHeight: Number(rootStyle.getPropertyValue('--reading-line-height')),
            rootFontScale: Number(rootStyle.getPropertyValue('--reading-font-scale')),
            rootReadingWidth: rootStyle.getPropertyValue('--reading-width').trim(),
            paragraphFontSize: Number.parseFloat(paragraphStyle.fontSize),
            paragraphLineHeight: Number.parseFloat(paragraphStyle.lineHeight),
            paragraphMarginTop: Number.parseFloat(paragraphStyle.marginTop),
            listFontSize: Number.parseFloat(listStyle.fontSize),
            listLineHeight: Number.parseFloat(listStyle.lineHeight),
            narrativeMaxWidth: narrativeStyle.maxWidth,
            documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        }
    })
}

test.describe('reader typography preferences', () => {
    test('characterizes the preserved desktop reader contract', async ({ page }) => {
        await openReader(page, { width: 1280, height: 900 }, {
            fontScale: 1,
            lineHeight: 'standard',
            paragraphSpacing: 'standard',
            readingWidth: 'standard',
            dyslexiaFont: 'off',
        })

        const typography = await readTypography(page)
        expect(typography.paragraphFontSize).toBeCloseTo(17, 3)
        expect(typography.listFontSize).toBeCloseTo(17, 3)
        expect(typography.paragraphLineHeight).toBeCloseTo(26.86, 2)
        expect(typography.listLineHeight).toBeCloseTo(26.86, 2)
        expect(typography.rootReadingWidth).toBe('68ch')
        expect(typography.paragraphMarginTop).toBeCloseTo(14.45, 2)
    })

    for (const viewport of VIEWPORTS) {
        for (const preference of PREFERENCES) {
            for (const fontScale of [1, 1.5]) {
                test(`${viewport.width}px ${preference.name} at ${fontScale * 100}%`, async ({ page }) => {
                    await openReader(page, viewport, {
                        fontScale,
                        lineHeight: preference.lineHeight,
                        paragraphSpacing: 'standard',
                        readingWidth: 'standard',
                        dyslexiaFont: 'off',
                    })

                    const typography = await readTypography(page)
                    const baseFontSize = viewport.width <= 720 ? 16 : 17
                    const expectedFontSize = baseFontSize * fontScale
                    const expectedLineHeight = expectedFontSize * preference.multiplier

                    expect(typography.rootFontScale).toBe(fontScale)
                    expect(typography.rootLineHeight).toBe(preference.multiplier)
                    expect(typography.paragraphFontSize).toBeCloseTo(expectedFontSize, 3)
                    expect(typography.listFontSize).toBeCloseTo(expectedFontSize, 3)
                    expect(typography.paragraphLineHeight).toBeCloseTo(expectedLineHeight, 2)
                    expect(typography.listLineHeight).toBeCloseTo(expectedLineHeight, 2)
                    expect(typography.paragraphFontSize).toBeCloseTo(typography.listFontSize, 3)
                    expect(typography.paragraphLineHeight).toBeCloseTo(typography.listLineHeight, 2)
                    expect(typography.rootReadingWidth).toBe('68ch')
                    expect(typography.paragraphMarginTop).toBeCloseTo(expectedFontSize * 0.85, 2)
                    expect(typography.documentOverflow).toBeLessThanOrEqual(0)
                })
            }
        }
    }

    test('invalid persisted scalar preferences fall back to Standard at 100%', async ({ page }) => {
        await openReader(page, { width: 375, height: 812 }, {
            fontScale: 9,
            lineHeight: 'invalid',
            paragraphSpacing: 'invalid',
            readingWidth: 'invalid',
            dyslexiaFont: 'off',
        })

        const typography = await readTypography(page)
        expect(typography.rootFontScale).toBe(1)
        expect(typography.rootLineHeight).toBe(1.58)
        expect(typography.rootReadingWidth).toBe('68ch')
        expect(typography.paragraphFontSize).toBeCloseTo(16, 3)
        expect(typography.paragraphLineHeight).toBeCloseTo(25.28, 2)
    })

    test('WCAG text-spacing overrides reflow without clipping or horizontal overflow', async ({ page }) => {
        await openReader(page, { width: 375, height: 812 }, {
            fontScale: 1.5,
            lineHeight: 'relaxed',
            paragraphSpacing: 'standard',
            readingWidth: 'standard',
            dyslexiaFont: 'off',
        })

        await page.addStyleTag({ content: `
            .reading-narrative,
            .reading-narrative p,
            .reading-narrative li {
                line-height: 1.5 !important;
                letter-spacing: 0.12em !important;
                word-spacing: 0.16em !important;
            }
            .reading-narrative p { margin-bottom: 2em !important; }
        ` })

        const reflow = await page.evaluate(() => {
            const paragraph = document.querySelector('.reading-narrative p')
            if (!(paragraph instanceof HTMLElement)) {
                throw new Error('Reader paragraph fixture must be present')
            }
            const style = getComputedStyle(paragraph)
            return {
                documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
                paragraphOverflow: paragraph.scrollWidth - paragraph.clientWidth,
                paragraphHeight: paragraph.getBoundingClientRect().height,
                lineHeight: Number.parseFloat(style.lineHeight),
            }
        })

        expect(reflow.documentOverflow).toBeLessThanOrEqual(0)
        expect(reflow.paragraphOverflow).toBeLessThanOrEqual(0)
        expect(reflow.paragraphHeight).toBeGreaterThanOrEqual(reflow.lineHeight)
    })
})
