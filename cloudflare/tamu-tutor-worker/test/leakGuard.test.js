import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { findLeak } from '../src/leakGuard.js'

const COURSE = new URL('../../../frontend/content/ai-literacy/', import.meta.url)
const items = readdirSync(COURSE).filter((d) => /^\d\d$/.test(d)).flatMap((ch) =>
    readdirSync(new URL(`${ch}/`, COURSE)).filter((f) => f.endsWith('.practice.json'))
        .flatMap((f) => JSON.parse(readFileSync(join(COURSE.pathname.replace(/^\/([A-Za-z]:)/, '$1'), ch, f), 'utf8')).problems))

test('loads all 36 course items', () => {
    assert.equal(items.length, 36)
})

test('flags every direct way of giving away the answer, for every item', () => {
    for (const p of items) {
        const letter = String.fromCharCode(65 + p.correct_index)
        const position = ['first', 'second', 'third', 'fourth'][p.correct_index]
        const leaks = [
            p.options[p.correct_index],
            `Think about it. ${p.options[p.correct_index]}`,
            `Look closely at option ${letter}.`,
            `${letter}) seems worth a second look.`,
            `I think the ${position} option fits best.`,
            'The correct answer is the one about probabilities.',
            p.explanation,
        ]
        for (const hint of leaks) assert.ok(findLeak(hint, p, []), `${p.id} missed: ${hint}`)
    }
})

test('lets genuine Socratic hints through and allows naming the learner\'s own wrong pick', () => {
    const p = items.find((i) => i.id === 'ail_102_a')
    const wrong = [0, 1, 2, 3].find((i) => i !== p.correct_index)
    const wrongLetter = String.fromCharCode(65 + wrong)
    for (const hint of [
        'When a chatbot writes, is it finding a stored reply somewhere, or producing words one at a time? What would each of those look like?',
        `You picked ${wrongLetter}. What would have to be true about the model for ${wrongLetter} to be right?`,
    ]) assert.equal(findLeak(hint, p, [wrong]), null, hint)
})
