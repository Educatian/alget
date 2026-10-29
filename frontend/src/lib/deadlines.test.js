import { describe, expect, it } from 'vitest'
import { chapterDue, pacing } from './deadlines'

const DUE = { '01': '2026-11-08T23:59:00-06:00', '02': '2026-11-11T23:59:00-06:00' }
const at = (iso) => Date.parse(iso)

describe('chapter due dates', () => {
    it('labels the state of a chapter against its due date', () => {
        expect(chapterDue('01', 0, 3, at('2026-11-01T12:00:00Z'), DUE)).toMatchObject({ label: 'Sun, Nov 8', state: 'upcoming' })
        expect(chapterDue('01', 1, 3, at('2026-11-08T12:00:00Z'), DUE).state).toBe('due_soon')
        expect(chapterDue('01', 2, 3, at('2026-11-09T12:00:00Z'), DUE).state).toBe('past_due')
        expect(chapterDue('01', 3, 3, at('2026-11-09T12:00:00Z'), DUE).state).toBe('done')
        expect(chapterDue('03', 0, 3, at('2026-11-01T12:00:00Z'), DUE)).toBeNull()
    })

    it('finds chapters past due and not done, and the next due date', () => {
        const ids = ['c/01/01', 'c/01/02', 'c/01/03', 'c/02/01', 'c/02/02', 'c/02/03']
        const done = ['done', 'done', 'done', 'working', 'not_started', 'not_started']
        expect(pacing(ids, done, at('2026-11-10T12:00:00Z'), DUE)).toEqual({ behind: [], next: { chapter: '02', iso: DUE['02'] } })
        expect(pacing(ids, done, at('2026-11-12T12:00:00Z'), DUE)).toEqual({ behind: ['02'], next: null })
        expect(pacing(ids, ['working', ...done.slice(1)], at('2026-11-10T12:00:00Z'), DUE).behind).toEqual(['01'])
    })
})
