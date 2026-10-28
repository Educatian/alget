import { describe, expect, it } from 'vitest'
import { bestParagraph, buildHintLadder } from './hintLadder'

const mdx = `# How models write

<lesson-video src="/media/x.mp4" />

A language model gives each possible next token a probability, then samples one. That is why the same question can get different replies.

Citations can be invented too, so check every source yourself before you rely on it in your work.`

const problem = {
    type: 'multiple_choice',
    stem: 'Why can the same question get different replies?',
    options: ['It searches the web each time.', 'It samples the next token from probabilities.', 'It forgets the question.'],
    correct_index: 1,
    concept_id: 'next_token_prediction',
}

describe('hint ladder', () => {
    it('points to the best-matching paragraph, skipping MDX tags and headings', () => {
        expect(bestParagraph(problem, mdx)).toMatch(/^A language model gives each possible next token/)
    })

    it('goes reread, then mix-up, then rules out a wrong option, never the right one', () => {
        const rungs = buildHintLadder(problem, { description: 'Believing the model retrieves stored answers.' }, mdx)
        expect(rungs.map((r) => r.kind)).toEqual(['reread', 'mixup', 'eliminate'])
        expect(rungs[2].eliminate).not.toBe(problem.correct_index)
        for (const r of rungs) expect(r.text).not.toContain(problem.options[problem.correct_index])
        // Options already struck out are not offered again; with one wrong option left there is no elimination.
        expect(buildHintLadder(problem, null, mdx, [0]).map((r) => r.kind)).toEqual(['reread'])
    })
})
