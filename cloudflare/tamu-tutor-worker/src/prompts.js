/** Prompts for the tutor. Course text is trusted; nothing the learner typed is ever included. */

const letter = (i) => String.fromCharCode(65 + Number(i))

export const HINT_SCHEMA = {
    name: 'socratic_hint',
    strict: true,
    schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
            hint: { type: 'string', description: 'One short guiding question or nudge, at most 60 words.' },
            check_question: { type: 'string', description: 'One quick question the learner can ask themself to test their reasoning.' },
        },
        required: ['hint', 'check_question'],
    },
}

export const EXPLAIN_SCHEMA = {
    name: 'passage_explanation',
    strict: true,
    schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
            explanation: { type: 'string', description: 'At most 120 words, based only on the section text.' },
            check_question: { type: 'string', description: 'One question that checks understanding of the passage.' },
            in_section: { type: 'boolean', description: 'False if the section text does not cover what is needed.' },
        },
        required: ['explanation', 'check_question', 'in_section'],
    },
}

export function hintMessages({ problem, misconception, passage, picks, rung, strict }) {
    const options = problem.options.map((o, i) => `${letter(i)}. ${o}`).join('\n')
    const picked = picks.length ? picks.map((i) => `${letter(i)} ("${problem.options[i]}")`).join(', ') : 'none yet'
    const system = [
        'You are a Socratic tutor for first- to third-year university students in an AI literacy course.',
        'Your job is to help the learner reason their way to the answer, never to give it.',
        'Rules:',
        '- Never state, quote, paraphrase or point to the correct option, by text, letter or position.',
        '- Never say which option is right. You may say why an option the learner already picked is off.',
        '- Ask one guiding question or give one nudge, at most 60 words, in plain friendly English.',
        '- Use only ideas from the course passage below.',
        rung >= 2 ? '- This learner has already had hints; be a little more specific about the key idea, still without revealing the answer.' : '',
        strict ? '- Your previous hint gave away too much. Stay further from the answer: focus on the concept, not on any option.' : '',
        'Return JSON only.',
    ].filter(Boolean).join('\n')
    const user = [
        `Question: ${problem.stem || problem.statement}`,
        `Options:\n${options}`,
        `Correct option (for you only, never reveal): ${letter(problem.correct_index)}`,
        misconception ? `Common misconception this question targets: ${misconception.description} (${misconception.feedback})` : '',
        `Learner's wrong picks so far: ${picked}`,
        passage ? `Course passage:\n"""${passage}"""` : '',
    ].filter(Boolean).join('\n\n')
    return [{ role: 'system', content: system }, { role: 'user', content: user }]
}

const MODES = {
    explain: 'Explain what the passage means and why it matters, in plain words.',
    simpler: 'Explain the passage as simply as possible, as if to someone new to the topic, in short sentences.',
    example: 'Give one concrete everyday example that illustrates the passage, then link it back to the passage.',
    quiz_me: 'Do not explain. Ask one question that checks whether the reader understood the passage, and put a one-sentence hint (not the answer) in the explanation field.',
}

export const EXPLAIN_MODES = Object.keys(MODES)

export function explainMessages({ quote, sectionTitle, sectionText, mode }) {
    const system = [
        'You help university students understand one passage of their AI literacy textbook.',
        'Use only the section text you are given. Do not add facts, numbers, names or sources that are not in it.',
        'If the section text does not cover what is needed, say so briefly and set in_section to false.',
        MODES[mode],
        'Write at most 120 words in plain friendly English. Return JSON only.',
    ].join('\n')
    const user = [
        `Section: ${sectionTitle}`,
        `Section text:\n"""${sectionText}"""`,
        `Passage the student selected:\n"""${quote}"""`,
    ].join('\n\n')
    return [{ role: 'system', content: system }, { role: 'user', content: user }]
}
