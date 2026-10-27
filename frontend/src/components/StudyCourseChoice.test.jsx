import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const chooseStudyCourse = vi.fn(async () => {})
vi.mock('../lib/studyTrack', () => ({ chooseStudyCourse }))

const { default: StudyCourseChoice } = await import('./StudyCourseChoice')

const courses = [
    { id: 'statics', title: 'Engineering Statics', chapters: 6, sections: 14, description: 'Statics' },
    { id: 'dynamics', title: 'Engineering Dynamics', chapters: 3, sections: 11, description: 'Dynamics' },
]

afterEach(() => {
    cleanup()
    chooseStudyCourse.mockClear()
})

describe('StudyCourseChoice', () => {
    it('saves the course only after the participant confirms it', () => {
        const user = { id: 'u1' }
        render(<StudyCourseChoice user={user} courses={courses} />)
        fireEvent.click(screen.getByRole('button', { name: /engineering dynamics/i }))
        expect(chooseStudyCourse).not.toHaveBeenCalled()
        expect(screen.getByText(/all 11 sections/i)).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: /start engineering dynamics/i }))
        expect(chooseStudyCourse).toHaveBeenCalledWith(user, 'dynamics')
    })
})
