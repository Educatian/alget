/**
 * Answer-leak guard for AI hints. The model is told the correct option so it can aim the hint,
 * so every hint is checked before it reaches the learner. A hint leaks when it
 *   - says outright what the answer is ("the correct answer is ..."),
 *   - names the correct option by letter or position ("option B", "B)", "the second choice"),
 *   - reuses most of the correct option's content words, or
 *   - closely paraphrases the item's explanation.
 * Letters of options the learner already picked (wrong ones) may be mentioned.
 */

const STOP = new Set(('a an and are as at be by can could do does for from has have how i if in into is it its '
    + 'itself just more most not of on one or so than that the their them then there these they this those to '
    + 'up was what when where which who why will with would you your about each also only very').split(' '))

const POSITIONS = ['first', 'second', 'third', 'fourth', 'fifth']

export function contentWords(text) {
    return [...new Set(String(text || '').toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/)
        .map((w) => w.replace(/^-+|-+$/g, ''))
        .filter((w) => w.length > 2 && !STOP.has(w)))]
}

function share(source, target) {
    const words = contentWords(source)
    if (words.length < 2) return 0
    const have = new Set(contentWords(target))
    return words.filter((w) => have.has(w)).length / words.length
}

/** Returns null when the hint is safe, otherwise a short reason code. */
export function findLeak(hintText, problem, picks = []) {
    const text = String(hintText || '')
    const lower = text.toLowerCase()
    const correct = Number(problem?.correct_index)
    const options = Array.isArray(problem?.options) ? problem.options : []
    if (!text.trim()) return 'empty'

    if (/\b(correct|right|best)\s+(answer|option|choice)\s+(is|would be|=)/i.test(text)
        || /\bthe answer is\b/i.test(text)) return 'states_answer'

    if (Number.isInteger(correct) && correct >= 0) {
        const letter = String.fromCharCode(65 + correct)
        const pickedLetters = new Set(picks.map((i) => String.fromCharCode(65 + Number(i))))
        if (!pickedLetters.has(letter)) {
            const byLetter = new RegExp(`\\b(option|answer|choice)\\s*\\(?${letter}\\)?(?![a-z])|(^|[\\s(])${letter}[).:](\\s|$)`, 'i')
            if (byLetter.test(text)) return 'names_letter'
        }
        const position = POSITIONS[correct]
        if (position && new RegExp(`\\b${position}\\s+(option|answer|choice)`, 'i').test(lower)) return 'names_position'
        if (options[correct] && share(options[correct], text) >= 0.6) return 'reuses_option'
        // Very short answers ("You.") can't be matched by word overlap; catch them said on their own.
        const bare = String(options[correct] || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').trim()
        if (bare && contentWords(bare).length < 2) {
            const standalone = new RegExp(`(^|[.!?;:"]\\s*)${bare.replace(/\s+/g, '\\s+')}\\s*([.!?;:"]|$)`, 'i')
            if (standalone.test(text.trim())) return 'reuses_option'
        }
    }

    if (problem?.explanation && share(problem.explanation, text) >= 0.7) return 'paraphrases_explanation'
    return null
}
