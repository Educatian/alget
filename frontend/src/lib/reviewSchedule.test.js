import { beforeEach, describe, expect, it } from 'vitest'
import { REVIEW_INTERVALS, dueConcepts, recordReviewOutcome } from './reviewSchedule'

describe('spaced review schedule', () => {
    beforeEach(() => window.localStorage.clear())

    it('expands on unaided correct answers, holds with a hint, resets on a miss', () => {
        const t = 1_000_000
        expect(recordReviewOutcome('c', 'ai/01/01', true, false, t).step).toBe(1)
        expect(recordReviewOutcome('c', 'ai/01/01', true, false, t).step).toBe(2)
        expect(recordReviewOutcome('c', 'ai/01/01', true, true, t).step).toBe(2)
        const miss = recordReviewOutcome('c', 'ai/01/01', false, false, t)
        expect(miss).toMatchObject({ step: 0, due: t + REVIEW_INTERVALS[0] })
    })

    it('lists due concepts for the course, soonest first, excluding the current section', () => {
        const t = 5_000_000
        recordReviewOutcome('late', 'ai/01/01', false, false, t)
        recordReviewOutcome('early', 'ai/01/02', false, false, t - 1000)
        recordReviewOutcome('here', 'ai/02/01', false, false, t - 2000)
        recordReviewOutcome('other', 'bio/01/01', false, false, t - 3000)
        const due = dueConcepts('ai', { excludeSectionId: 'ai/02/01', now: t + REVIEW_INTERVALS[0] })
        expect(due.map((d) => d.conceptId)).toEqual(['early', 'late'])
        expect(dueConcepts('ai', { now: t })).toEqual([])
    })
})
