import { describe, expect, it } from 'vitest'
import { STATIC_DEMO, gradeMultipleChoice } from './staticDemo'

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
})
