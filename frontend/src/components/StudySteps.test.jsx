import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const updateUser = vi.fn(async () => ({ error: null }))
vi.mock('../lib/supabase', () => ({ isSupabaseConfigured: false, supabase: { auth: { updateUser } } }))
vi.mock('../lib/loggingService', () => ({ logEvent: vi.fn() }))

const { default: StudySteps } = await import('./StudySteps')

const participant = { app_metadata: { study_track: 'basic', study_id: 'BAS-2345-6789' }, user_metadata: {} }

afterEach(() => {
    cleanup()
    updateUser.mockClear()
    window.history.replaceState(null, '', '/')
})

describe('StudySteps return from Qualtrics', () => {
    it('ticks the step when the survey was completed', async () => {
        window.history.replaceState(null, '', '/learn?survey_done=pre')
        render(<StudySteps user={participant} needsLab={false} />)
        await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ data: { study_steps: { pre: expect.any(String) } } }))
        expect(window.location.search).toBe('')
    })

    it('does not tick the step when the survey ended early, and explains how to retry', () => {
        window.history.replaceState(null, '', '/learn?survey_done=pre&screened=1')
        render(<StudySteps user={participant} needsLab={false} />)
        expect(screen.getByRole('alert')).toHaveTextContent(/ended early/i)
        expect(updateUser).not.toHaveBeenCalled()
        expect(screen.getByRole('link', { name: /open pre-survey/i })).toBeInTheDocument()
    })
})

describe('StudySteps guidance', () => {
    it('points to the courses and says practice questions are optional during the learning step', () => {
        const user = { ...participant, user_metadata: { study_steps: { pre: '2026-10-15T10:00:00Z' } } }
        render(<StudySteps user={user} needsLab={false} />)
        expect(screen.getByRole('button', { name: /go to my courses/i })).toBeInTheDocument()
        expect(screen.getByText(/practice questions are optional/i)).toBeInTheDocument()
    })

    it('keeps the learning step open until every section is complete', () => {
        const user = { ...participant, user_metadata: { study_steps: { pre: '2026-10-15T10:00:00Z' } } }
        render(<StudySteps user={user} needsLab={false} sectionsRemaining={3} />)
        expect(screen.getByRole('button', { name: /finished the learning materials/i })).toBeDisabled()
        expect(screen.getByText(/3 sections left/i)).toBeInTheDocument()
    })

    it('tells the participant they are done and whom to contact', () => {
        const all = { pre: 'x', learn: 'x', posttest: 'x', post: 'x', gift: 'x' }
        render(<StudySteps user={{ ...participant, user_metadata: { study_steps: all } }} needsLab={false} />)
        expect(screen.getByText(/finished every step of the study/i)).toBeInTheDocument()
        expect(screen.getAllByText(/Stephen Abu/).length).toBeGreaterThan(0)
    })
})

