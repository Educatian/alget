import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import ParameterExplorer from './ParameterExplorer'
import { evaluateExpression } from './safeEvaluator'

const CONFIG = JSON.stringify({
    title: 'Test explorer',
    sliders: [
        { name: 'a', label: 'Alpha', min: 0, max: 10, step: 1, unit: 'm', default: 2 },
        { name: 'b', label: 'Beta', min: 0, max: 10, step: 1, unit: 's', default: 3 },
    ],
    outputs: [{ label: 'Product', unit: 'm s', expr: 'a * b' }],
    plot: { x: 'a', output: 0 },
})

afterEach(() => {
    cleanup()
})

describe('evaluateExpression (safe arithmetic)', () => {
    it('handles operators, precedence and power', () => {
        expect(evaluateExpression('2 + 3 * 4')).toBe(14)
        expect(evaluateExpression('2 ^ 3 ^ 2')).toBe(512) // right associative
        expect(evaluateExpression('-(2 + 3)')).toBe(-5)
    })

    it('resolves named variables and functions', () => {
        expect(evaluateExpression('a * b', { a: 4, b: 5 })).toBe(20)
        expect(evaluateExpression('sqrt(16)')).toBe(4)
        expect(evaluateExpression('cos(0)')).toBe(1)
    })

    it('rejects unknown identifiers and unsafe input', () => {
        expect(() => evaluateExpression('window')).toThrow()
        expect(() => evaluateExpression('foo(1)')).toThrow()
        expect(() => evaluateExpression('a.b', { a: 1 })).toThrow()
    })
})

describe('ParameterExplorer widget', () => {
    it('renders sliders, the live output and an SVG plot', () => {
        render(<ParameterExplorer config={CONFIG} />)

        expect(screen.getByRole('slider', { name: /Alpha/i })).toBeInTheDocument()
        expect(screen.getByRole('slider', { name: /Beta/i })).toBeInTheDocument()
        // 2 * 3 = 6 with the default values.
        expect(screen.getByRole('status')).toHaveTextContent('6')
        expect(screen.getByRole('img')).toBeInTheDocument()
    })

    it('recomputes the output live when a slider changes', () => {
        render(<ParameterExplorer config={CONFIG} />)

        const alpha = screen.getByRole('slider', { name: /Alpha/i })
        fireEvent.change(alpha, { target: { value: '5' } })
        // 5 * 3 = 15
        expect(screen.getByRole('status')).toHaveTextContent('15')
        expect(alpha).toHaveAttribute('aria-valuetext', '5 m')
    })

    it('uses wrapping plot-axis buttons instead of a clipping native select', () => {
        render(<ParameterExplorer config={CONFIG} />)

        expect(screen.getByRole('group', { name: /Plot against/i })).toBeInTheDocument()
        expect(screen.queryByRole('combobox')).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: /Beta/i }))

        expect(screen.getByRole('button', { name: /Beta/i })).toHaveAttribute('aria-pressed', 'true')
        expect(screen.getByText(/Product \(m s\) vs Beta \(s\)/i)).toBeInTheDocument()
    })

    it('degrades gracefully with no usable config', () => {
        render(<ParameterExplorer config="not json" />)
        expect(screen.getByRole('note')).toHaveTextContent(/unavailable/i)
    })
})
