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
