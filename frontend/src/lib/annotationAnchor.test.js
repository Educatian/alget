import { describe, expect, it } from 'vitest'
import { captureAnchor, locateInText, wrapAnchor } from './annotationAnchor'

const mount = (html) => {
    const el = document.createElement('div')
    el.innerHTML = html
    document.body.appendChild(el)
    return el
}

describe('annotation anchoring', () => {
    it('picks the occurrence whose context matches, not the first one', () => {
        const text = 'Check the source. Later, always check the source before you cite it.'
        const second = text.lastIndexOf('the source')
        const hit = locateInText(text, { exact: 'the source', prefix: 'Later, always check ', suffix: ' before you cite' })
        expect(hit).toEqual({ start: second, end: second + 'the source'.length })
        expect(locateInText(text, { exact: 'not there' })).toBeNull()
    })

    it('captures a selection across inline markup and wraps each text node', () => {
        const el = mount('<p>Fluent text is <strong>not the same</strong> as true text.</p>')
        const strong = el.querySelector('strong')
        const range = document.createRange()
        range.setStart(el.querySelector('p').firstChild, 'Fluent '.length)
        range.setEnd(strong.firstChild, 'not the'.length)
        const anchor = captureAnchor(range, el)
        expect(anchor.exact).toBe('text is not the')
        const marks = wrapAnchor(el, anchor, () => document.createElement('mark'))
        expect(marks).toHaveLength(2)
        expect(marks.map((m) => m.textContent).join('')).toBe('text is not the')
        expect(el.textContent).toBe('Fluent text is not the same as true text.')
        el.remove()
    })
})
