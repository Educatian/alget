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

export const JUDGE_SCHEMA = {
    name: 'leak_judge',
    strict: true,
    schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
            reveals_answer: { type: 'boolean', description: 'True if the text states, paraphrases or strongly implies the correct option.' },
            reason: { type: 'string', description: 'One short sentence.' },
        },
        required: ['reveals_answer', 'reason'],
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
        '- Never ask an either-or question that sets the correct idea against a wrong one ("Is it X, or Y?"): naming the correct idea gives it away. Bad: "Does it look answers up, or pick tokens by probability?" Good: "You picked looking answers up. Where does the passage say what the model does before each word?"',
        '- Work from the learner\'s own pick: ask what the passage would need to say for that pick to be right, or tell them which part of the passage to reread by its topic, not its conclusion.',
        '- The check question is one the learner can ask about their own pick. It must not contain the key idea of the correct option.',
        '- At most 60 words, in plain friendly English.',
        '- Use only ideas from the course passage below.',
        rung >= 2 ? '- This learner has already had hints; be a little more specific about where in the passage to look, still without revealing the answer.' : '',
        strict ? '- Your previous hint gave away too much. Stay further from the answer: talk only about the learner\'s pick and where to look.' : '',
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

/** Second check after the lexical guard: catches answers given away in other words. */
export function judgeMessages({ problem, text }) {
    const system = [
        'You check tutoring hints for a multiple-choice question. A hint must help the learner think without giving the answer away.',
        'Say reveals_answer = true if the hint or its check question states, paraphrases or strongly implies the correct option,',
        'including by naming its key idea in an either-or question. Mentioning the topic of the question is fine.',
        // A stricter judge (key idea first, worked example) blocked 21 of 36 hints in the 2026-10-28 sweep.
        'Return JSON only.',
    ].join('\n')
    const user = [
        `Question: ${problem.stem || problem.statement}`,
        `Correct option: ${problem.options[problem.correct_index]}`,
        `Hint and check question:\n"""${text}"""`,
    ].join('\n\n')
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
