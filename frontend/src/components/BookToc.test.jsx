import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import BookToc from './BookToc'

const toc = {
    title: 'Engineering Dynamics',
    chapters: [
        {
            id: '01',
            title: 'Foundations',
            sections: [
                { id: '01', title: 'Introduction to Dynamics' },
                { id: '02', title: 'Position, Velocity, and Acceleration' }
            ]
        }
    ]
}

describe('BookToc', () => {
    it('shows completed sections and filters the list by search', () => {
        const onNavigate = vi.fn()

        render(
            <BookToc
                toc={toc}
                currentCourse="dynamics"
                currentChapter="01"
                currentSection="01"
                onNavigate={onNavigate}
                completedSections={['dynamics/01/02']}
            />
        )

        expect(screen.getByText('Done')).toBeInTheDocument()

        fireEvent.change(screen.getByPlaceholderText('Search chapters or sections'), {
            target: { value: 'Velocity' }
        })

        expect(screen.getByText(/Position, Velocity, and Acceleration/)).toBeInTheDocument()
        expect(screen.queryByText(/Introduction to Dynamics/)).not.toBeInTheDocument()
    })
})
