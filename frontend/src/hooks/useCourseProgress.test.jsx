import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCourseProgress } from './useCourseProgress'

const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockUpsert = vi.fn()

vi.mock('../lib/supabase', () => ({
    supabase: {
        from: vi.fn(() => ({
            select: mockSelect,
            upsert: mockUpsert
        }))
    }
}))

describe('useCourseProgress', () => {
    beforeEach(() => {
        window.localStorage.clear()
        vi.clearAllMocks()

        mockSelect.mockReturnValue({ eq: mockEq })
        mockEq.mockResolvedValue({
            data: [{ section_id: 'bio-inspired/06/01' }],
            error: null
        })
        mockUpsert.mockResolvedValue({ error: null })
    })

    it('merges guest, local, and cloud progress for signed-in users', async () => {
        window.localStorage.setItem('alget_progress_guest', JSON.stringify(['dynamics/01/01']))
        window.localStorage.setItem('alget_progress_user-1', JSON.stringify(['inst-design/01/03']))

        const { result } = renderHook(() => useCourseProgress({ id: 'user-1' }))

        await waitFor(() => {
            expect(result.current.completedSections).toEqual(
                expect.arrayContaining(['dynamics/01/01', 'inst-design/01/03', 'bio-inspired/06/01'])
            )
        })
    })

    it('does not duplicate completed sections and tracks sync status', async () => {
        const { result } = renderHook(() => useCourseProgress({ id: 'user-1' }))

        await waitFor(() => {
            expect(result.current.progressStats.syncStatus).toBe('synced')
        })

        act(() => {
            result.current.markCompleted('dynamics', '01', '01')
            result.current.markCompleted('dynamics', '01', '01')
        })

        expect(result.current.completedSections.filter((item) => item === 'dynamics/01/01')).toHaveLength(1)
    })
})
