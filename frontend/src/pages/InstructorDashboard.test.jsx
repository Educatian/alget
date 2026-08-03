import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import InstructorDashboard from './InstructorDashboard'

const calls = []
const rows = {
    managed_courses: [{ course_key: 'ail-606', title: 'AI Literacy', status: 'published' }],
    cohort_learners: [{ user_id: 'learner-1', display_name: 'Student A', cohort_label: 'A', course_id: 'ail-606' }],
    mastery: [{ user_id: 'learner-1', concept_id: 'source_evaluation', mastery_score: 0.4 }],
}

function query(table) {
    const builder = {
        select(columns) { calls.push([table, 'select', columns]); return builder },
        eq(column, value) { calls.push([table, 'eq', column, value]); return builder },
        neq(column, value) { calls.push([table, 'neq', column, value]); return builder },
        in(column, value) { calls.push([table, 'in', column, value]); return builder },
        limit(value) { calls.push([table, 'limit', value]); return builder },
        order(column) { calls.push([table, 'order', column]); return builder },
        then(resolve) { return Promise.resolve({ data: rows[table], error: null }).then(resolve) },
    }
    return builder
}

vi.mock('../lib/supabase', () => ({ supabase: { from: vi.fn((table) => query(table)) } }))
vi.mock('../lib/researchService', () => ({ fetchRctSnapshot: vi.fn().mockResolvedValue({ interventionOutcomes: [], evaluationGains: [], telemetryProfile: [] }) }))
vi.mock('../components/FacultyPartnershipWorkspace', () => ({ default: ({ courseId }) => <div>Faculty course {courseId}</div> }))
vi.mock('../components/InstructorInterventionQueue', () => ({ default: ({ courseId }) => <div>Queue course {courseId}</div> }))

describe('InstructorDashboard course scoping', () => {
    afterEach(() => { cleanup(); calls.length = 0 })

    it('loads only an assigned course roster and only mastery for that roster', async () => {
        render(<MemoryRouter><InstructorDashboard user={{ id: 'instructor-1', app_metadata: { role: 'instructor' } }} /></MemoryRouter>)

        expect(await screen.findByText('Faculty course ail-606')).toBeInTheDocument()
        await waitFor(() => expect(calls).toContainEqual(['cohort_learners', 'eq', 'course_id', 'ail-606']))
        expect(calls).toContainEqual(['mastery', 'in', 'user_id', ['learner-1']])
        expect(calls.some(([table, method]) => table === 'mastery' && method === 'select')).toBe(true)
    })
})
