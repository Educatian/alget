import { afterEach, describe, expect, it } from 'vitest'
import {
    EXIT_TICKET_MIN_CHARS,
    getExitTicketCue,
    getExitTicketStorageKey,
    listExitTickets,
    readExitTicket,
    writeExitTicket,
} from './exitTickets'

afterEach(() => {
    window.localStorage.clear()
})

describe('exit ticket persistence', () => {
    it('stores section text and keeps a dashboard index', () => {
        writeExitTicket('cat100-supplement/01/01', 'Claim, evidence, and next move.', {
            course: 'cat100-supplement',
            chapter: '01',
            section: '01',
            title: 'Digital Identity',
        })

        expect(getExitTicketStorageKey('cat100-supplement/01/01')).toBe('alget_exit_ticket_v1_cat100-supplement/01/01')
        expect(readExitTicket('cat100-supplement/01/01')).toBe('Claim, evidence, and next move.')

        const [entry] = listExitTickets()
        expect(entry).toMatchObject({
            sectionId: 'cat100-supplement/01/01',
            course: 'cat100-supplement',
            chapter: '01',
            section: '01',
            title: 'Digital Identity',
            text: 'Claim, evidence, and next move.',
        })
    })

    it('can list older raw ticket keys that predate the index', () => {
        window.localStorage.setItem('alget_exit_ticket_v1_ail606-supplement/02/03', 'Older ticket')

        expect(listExitTickets()).toEqual([
            expect.objectContaining({
                sectionId: 'ail606-supplement/02/03',
                course: 'ail606-supplement',
                chapter: '02',
                section: '03',
                text: 'Older ticket',
            }),
        ])
    })

    it('names the next useful learner action for a trace', () => {
        expect(getExitTicketCue('Short reflection').label).toBe('Strengthen trace')

        const longWithoutEvidence = 'I understand the main claim and I know what I need to revise next. '.repeat(3)
        expect(longWithoutEvidence.length).toBeGreaterThan(EXIT_TICKET_MIN_CHARS)
        expect(getExitTicketCue(longWithoutEvidence).label).toBe('Add evidence')

        const reusable = 'The claim is clearer because the annotation evidence shows where my explanation needs more specificity. Next I will revise the artifact and compare it with the rubric before submitting.'
        expect(getExitTicketCue(reusable)).toMatchObject({
            label: 'Reuse insight'
        })
    })
})
