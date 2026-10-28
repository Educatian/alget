import { describe, expect, it } from 'vitest'
import { STATIC_DEMO, applyMasteryToGraph, bktUpdate, gradeMultipleChoice } from './staticDemo'

const problem = { options: ['A', 'B', 'C'], correct_index: 1, explanation: 'Because B.' }

describe('static demo', () => {
    it('is off unless VITE_STATIC_DEMO is set', () => {
        expect(STATIC_DEMO).toBe(false)
    })

    it('grades multiple choice like the backend', () => {
        expect(gradeMultipleChoice(problem, 1)).toMatchObject({ is_correct: true, expected: 'B', user_answer: 'B', explanation: 'Because B.' })
        expect(gradeMultipleChoice(problem, 0)).toMatchObject({ is_correct: false, expected: 'B', user_answer: 'A', correct_index: 1 })
        expect(gradeMultipleChoice({ options: ['A'] }, 0).is_correct).toBe(false)
    })

    it('updates mastery with the backend BKT model', () => {
        // Values from backend/knowledge_tracing.py with the default guess 0.2, slip 0.1, transit 0.1.
        const right = bktUpdate({ a: 0.1 }, { a: 1 }, true)
        expect(right.a).toBeCloseTo(0.4, 6)
        const wrong = bktUpdate({ a: 0.5 }, { a: 1 }, false)
        expect(wrong.a).toBeCloseTo(0.2, 6)
        expect(bktUpdate({ a: 0.1 }, { a: 0.5 }, true).a).toBeCloseTo(0.25, 6)
    })

    it('applies mastery and the current section to an exported chapter graph', () => {
        const graph = { nodes: [{ id: 'x', section_id: 'c/01/01' }, { id: 'y', section_id: 'c/01/02' }, { id: 'z', section_id: 'c/01/03' }], links: [{ source: 'x', target: 'y' }] }
        const out = applyMasteryToGraph(graph, { x: 0.85, y: 0.6 }, 'c/01/02')
        expect(out.nodes.map((n) => n.status)).toEqual(['mastered', 'emerging', 'novice'])
        expect(out.nodes.map((n) => n.is_current)).toEqual([false, true, false])
        expect(out.links).toHaveLength(1)
    })
})
