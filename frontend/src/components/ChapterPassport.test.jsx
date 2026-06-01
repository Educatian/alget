import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ChapterPassport from './ChapterPassport'

const toc = {
    chapters: [
        {
            id: '01',
            title: 'Foundations',
            sections: [
                { id: '01', title: 'Start' },
                { id: '02', title: 'Continue' },
            ],
        },
        {
            id: '02',
            title: 'Transfer',
            sections: [
                { id: '01', title: 'Apply' },
                { id: '02', title: 'Reflect' },
            ],
        },
    ],
}

describe('ChapterPassport', () => {
    it('shows chapter stamps and current chapter progress from completed sections', () => {
        render(
            <ChapterPassport
                toc={toc}
                currentCourse="cat100-supplement"
                currentChapter="02"
                completedSections={[
                    'cat100-supplement/01/01',
                    'cat100-supplement/01/02',
                    'cat100-supplement/02/01',
                ]}
            />
        )

        expect(screen.getByText('Chapter Passport')).toBeInTheDocument()
        expect(screen.getByText('Collect chapter stamps')).toBeInTheDocument()
        expect(screen.getByText('3 sections completed')).toBeInTheDocument()
        expect(screen.getByText('1/2 stamps')).toBeInTheDocument()
        expect(screen.getAllByText('1/2').length).toBeGreaterThan(0)
    })
})
