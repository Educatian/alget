import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const logEvent = vi.fn()
vi.mock('../lib/loggingService', () => ({ logEvent }))

const { default: ChapterCheckIn, MIN_CHECKIN_WORDS } = await import('./ChapterCheckIn')

afterEach(() => {
    cleanup()
    logEvent.mockClear()
})

describe('ChapterCheckIn', () => {
    it('needs a short explanation, then logs it and sends it to BigAL', () => {
        const onDone = vi.fn()
        const opened = vi.fn()
        window.addEventListener('open-chat', opened)
        render(<ChapterCheckIn course="statics" chapter="02" chapterTitle="Forces" sectionId="statics/02/03" done={false} onDone={onDone} />)

        const send = screen.getByRole('button', { name: /send to bigal/i })
        fireEvent.change(screen.getByLabelText(/your explanation/i), { target: { value: 'too short' } })
        expect(send).toBeDisabled()

        const text = Array.from({ length: MIN_CHECKIN_WORDS }, (_, i) => `word${i}`).join(' ')
        fireEvent.change(screen.getByLabelText(/your explanation/i), { target: { value: text } })
        fireEvent.click(send)

        expect(logEvent).toHaveBeenCalledWith('chapter_checkin', 'statics/02',
            expect.objectContaining({ explanation: text, word_count: MIN_CHECKIN_WORDS }), 'statics/02/03')
        expect(opened.mock.calls[0][0].detail).toMatchObject({ autoSend: true, message: expect.stringContaining('Chapter 2: Forces') })
        expect(onDone).toHaveBeenCalled()
        window.removeEventListener('open-chat', opened)
    })
})
