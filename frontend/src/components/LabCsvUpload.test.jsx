import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const upload = vi.fn(async () => ({ error: null }))
const logEvent = vi.fn()
vi.mock('../lib/supabase', () => ({
    supabase: {
        auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
        storage: { from: () => ({ upload }) },
    },
}))
vi.mock('../lib/loggingService', () => ({ logEvent }))

const { default: LabCsvUpload } = await import('./LabCsvUpload')
const { checkLabCsv } = await import('../lib/labExports')

const lab = { id: 'geckogrip', sectionId: '01-01' }

afterEach(() => {
    cleanup()
    upload.mockClear()
    logEvent.mockClear()
})

describe('LabCsvUpload', () => {
    it('only accepts a non-empty .csv file', () => {
        expect(checkLabCsv(null)).toMatch(/choose/i)
        expect(checkLabCsv(new File(['x'], 'trials.xlsx'))).toMatch(/not a \.csv/i)
        expect(checkLabCsv(new File([''], 'trials.csv'))).toMatch(/empty/i)
        expect(checkLabCsv(new File(['a,b\n1,2'], 'trials.csv'))).toBeNull()
    })

    it("uploads the file into the learner's own folder and logs it", async () => {
        const onDone = vi.fn()
        const { container } = render(<LabCsvUpload lab={lab} done={false} onDone={onDone} />)
        const file = new File(['trial,safety_factor\n1,1.4\n2,2.1'], 'geckogrip_trials.csv', { type: 'text/csv' })
        fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [file] } })
        fireEvent.click(screen.getByRole('button', { name: /^upload$/i }))
        await waitFor(() => expect(onDone).toHaveBeenCalledWith('uploaded'))
        expect(upload.mock.calls[0][0]).toMatch(/^user-1\/geckogrip-.*\.csv$/)
        expect(logEvent).toHaveBeenCalledWith('sim_lab_csv_uploaded', 'geckogrip',
            expect.objectContaining({ rows: 2, header: 'trial,safety_factor' }), '01-01')
    })

    it('lets the learner continue with a reason when the download does not work', () => {
        const onDone = vi.fn()
        render(<LabCsvUpload lab={lab} done={false} onDone={onDone} />)
        fireEvent.click(screen.getByRole('button', { name: /download does not work/i }))
        const cont = screen.getByRole('button', { name: /continue without the file/i })
        expect(cont).toBeDisabled()
        fireEvent.change(screen.getByLabelText(/what happened/i), { target: { value: 'Nothing downloaded' } })
        fireEvent.click(cont)
        expect(logEvent).toHaveBeenCalledWith('sim_lab_csv_skipped', 'geckogrip', { lab: 'geckogrip', reason: 'Nothing downloaded' }, '01-01')
        expect(onDone).toHaveBeenCalledWith('skipped')
    })
})
