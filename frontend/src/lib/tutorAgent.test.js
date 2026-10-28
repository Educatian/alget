import { describe, expect, it } from 'vitest'
import { recommendNextStep } from '../lib/tutorAgent'
import { parseVttTimes } from '../lib/vtt'

describe('tutor agent adaptation', () => {
    const concepts = ['tokens', 'sampling']
    const rec = (mastery, extra = {}) => recommendNextStep({ mastery, conceptIds: concepts, activityDone: false, activityStarted: false, ...extra }).id

    it('follows the weakest concept of the section', () => {
        expect(rec({ tokens: 0.9, sampling: 0.3 })).toBe('review')
        expect(rec({ tokens: 0.9, sampling: 0.6 })).toBe('practice')
        expect(rec({})).toBe('start') // no answers yet: no evidence, not "weak"
        expect(rec({ sampling: 0.3 })).toBe('review') // only answered concepts count
    })

    it('sends a learner who has mastered the ideas to the written activity, then onward', () => {
        expect(rec({ tokens: 0.9, sampling: 0.85 })).toBe('apply')
        expect(rec({ tokens: 0.9, sampling: 0.85 }, { activityDone: true })).toBe('next')
    })
})

describe('lesson video check-ins', () => {
    it('reads cue times from WebVTT', () => {
        const vtt = 'WEBVTT\n\n1\n00:00:00.000 --> 00:00:06.850\nOne\n\n2\n00:00:07.300 --> 00:01:14.150\nTwo\n'
        expect(parseVttTimes(vtt)).toEqual([{ start: 0, end: 6.85 }, { start: 7.3, end: 74.15 }])
    })
})
