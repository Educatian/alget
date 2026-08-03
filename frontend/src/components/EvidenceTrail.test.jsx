import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import EvidenceTrail from './EvidenceTrail'

describe('EvidenceTrail', () => {
    afterEach(() => cleanup())

    it('stays quiet until provenance is available', () => {
        render(<EvidenceTrail />)
        expect(screen.queryByTestId('evidence-trail')).not.toBeInTheDocument()
    })

    it('lets learners inspect canonical sources and reports context honestly', () => {
        render(<EvidenceTrail
            sourceTitle="Evidence evaluation"
            sourceStatus="context_attached"
            references={[{
                title: 'Conditions for Static Equilibrium',
                book_title: 'University Physics, Volume 1',
                url: 'https://openstax.org/books/university-physics-volume-1/pages/12-1-conditions-for-static-equilibrium',
                license_url: 'https://creativecommons.org/licenses/by/4.0/',
            }]}
        />)

        expect(screen.getByText(/Evidence trail/)).toBeInTheDocument()
        fireEvent.click(screen.getByText(/Evidence trail/))
        expect(screen.getByRole('link', { name: /Conditions for Static Equilibrium/ })).toHaveAttribute('target', '_blank')
        expect(screen.getByText(/Context attached; inspect sources/i)).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'licence' })).toHaveAttribute('href', 'https://creativecommons.org/licenses/by/4.0/')
    })

    it('rejects non-https source links instead of rendering them', () => {
        render(<EvidenceTrail references={[{ title: 'Unsafe', url: 'javascript:alert(1)' }]} sourceStatus="context_attached" />)
        fireEvent.click(screen.getByText(/Evidence trail/))
        expect(screen.queryByRole('link', { name: /Unsafe/ })).not.toBeInTheDocument()
        expect(screen.getByText(/Context attached; inspect sources/i)).toBeInTheDocument()
    })
})

