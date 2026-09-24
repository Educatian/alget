import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import ProcessSequenceMiningPanel from './ProcessSequenceMiningPanel'

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }))

vi.mock('../lib/supabase', () => ({ supabase: { rpc: rpcMock } }))

describe('ProcessSequenceMiningPanel', () => {
    beforeEach(() => {
        rpcMock.mockReset()
        rpcMock.mockImplementation((name) => {
            if (name === 'list_process_mining_runs') return Promise.resolve({ data: [], error: null })
            if (name === 'analyze_learning_sequences') return Promise.resolve({
                data: {
                    runId: 'run-1',
                    dataQuality: { suppressed: false, learnerCount: 8, sessions: 12, scopedEvents: 34, missingSectionPercent: 20 },
                    directlyFollows: [{ source: 'page_view', target: 'problem_attempt', transitions: 10, learners: 8, medianSeconds: 12 }],
                    sequences: [{ events: ['page_view', 'problem_attempt'], learners: 8, occurrences: 10 }],
                    variants: [{ events: ['page_view', 'problem_attempt'], learners: 8, cases: 9 }],
                }, error: null,
            })
            return Promise.resolve({ data: { runId: 'run-1', status: 'approved' }, error: null })
        })
    })

    it('shows process and sequence aggregates, then saves an independent review checklist', async () => {
        render(<ProcessSequenceMiningPanel />)
        fireEvent.click(screen.getByRole('button', { name: /분석 실행/ }))

        expect((await screen.findAllByText(/page view → problem attempt/)).length).toBeGreaterThan(1)
        expect(screen.getByText('20%')).toBeTruthy()

        fireEvent.click(screen.getByLabelText(/모듈 연결률과 기간 범위를 확인했다/))
        fireEvent.click(screen.getByLabelText(/최소 인원 기준과 익명 집계를 확인했다/))
        fireEvent.click(screen.getByLabelText(/흐름을 인과관계로 과장하지 않고 해석했다/))
        fireEvent.click(screen.getByRole('button', { name: '검수 결과 저장' }))

        await waitFor(() => expect(rpcMock).toHaveBeenCalledWith('review_process_mining_run', expect.objectContaining({
            p_run_id: 'run-1', p_status: 'approved',
            p_checklist: { coverage: true, privacy: true, interpretation: true },
        })))
    })
})
