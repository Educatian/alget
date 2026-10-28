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
        picks.length ? '' : '- The learner has not picked a wrong option yet. Never say or imply that they picked one; point them to where in the passage to look.',
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

export const FEEDBACK_SCHEMA = {
    name: 'written_feedback',
    strict: true,
    schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
            criteria: {
                type: 'array',
                items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        id: { type: 'string' },
                        status: { type: 'string', enum: ['met', 'partly', 'not_yet'] },
                        comment: { type: 'string', description: 'One short sentence about this criterion in the learner\'s text.' },
                    },
                    required: ['id', 'status', 'comment'],
                },
            },
            marks: {
                type: 'array',
                description: 'At most 4 pen marks on the learner\'s own words.',
                items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        quote: { type: 'string', description: 'An exact, short span copied from the learner\'s text.' },
                        kind: { type: 'string', enum: ['strength', 'issue', 'question'] },
                        note: { type: 'string', description: 'At most 20 words.' },
                    },
                    required: ['quote', 'kind', 'note'],
                },
            },
            next_step: { type: 'string', description: 'One concrete revision step, as a hint, at most 40 words.' },
            ready: { type: 'boolean', description: 'True when every criterion is met.' },
        },
        required: ['criteria', 'marks', 'next_step', 'ready'],
    },
}

/** Feedback on a learner's written activity, like a teacher marking with coloured pens. */
export function feedbackMessages({ activity, text, revision, previous, sectionText, strict }) {
    const system = [
        'You give formative feedback on a short written activity in a university AI literacy course.',
        'Mark the learner\'s work like a teacher with coloured pens: tick what is good, mark the first real problem where it happens, and ask about anything unclear.',
        'Rules:',
        '- Judge each criterion as met, partly or not_yet, with one short comment.',
        '- Marks quote the learner\'s own words exactly (copy a short span of 3 to 15 words). Never quote anything else.',
        '- Give hints, not answers: never write the answer for them, never supply the missing content, never quote or paraphrase the reference.',
        '- next_step is one concrete thing to revise, phrased as a nudge or question.',
        '- Use only ideas from the course section. Be warm, specific and brief.',
        '- Do not judge spelling or grammar unless it changes the meaning.',
        revision > 1 ? '- This is a revision. Say what improved in your comments, and judge it against the same criteria.' : '',
        strict ? '- Your previous feedback gave away too much of the reference. Point to what is missing without stating it.' : '',
        'Return JSON only.',
    ].filter(Boolean).join('\n')
    const user = [
        `Activity: ${activity.prompt}`,
        `Criteria:\n${activity.criteria.map((c) => `- ${c.id}: ${c.label} (look for: ${c.look_for})`).join('\n')}`,
        `Reference answer (for you only, never reveal or paraphrase):\n"""${activity.reference}"""`,
        previous ? `Your previous judgement: ${previous.map((c) => `${c.id}=${c.status}`).join(', ')}` : '',
        `Course section (excerpt):\n"""${sectionText.slice(0, 3000)}"""`,
        `Learner's text (revision ${revision}):\n"""${text}"""`,
    ].filter(Boolean).join('\n\n')
    return [{ role: 'system', content: system }, { role: 'user', content: user }]
}

export const ANNOTATE_SCHEMA = {
    name: 'tutor_annotations',
    strict: true,
    schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
            notes: {
                type: 'array',
                description: '2 or 3 margin notes on the section text.',
                items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        quote: { type: 'string', description: 'An exact span of 3 to 15 words copied from the section text.' },
                        kind: { type: 'string', enum: ['key_idea', 'watch_out', 'connect'] },
                        note: { type: 'string', description: 'At most 25 words, addressed to the learner.' },
                    },
                    required: ['quote', 'kind', 'note'],
                },
            },
        },
        required: ['notes'],
    },
}

/** Tutor annotations on the passage, aimed at what this learner is stuck on. */
export function annotateMessages({ sectionTitle, sectionText, focus }) {
    const system = [
        'You are a tutor annotating a textbook section for one university student, the way a teacher writes in the margin.',
        'Pick 2 or 3 short spans of the section text that matter most for what the student is stuck on, and write a margin note for each.',
        'kind: key_idea for the idea to hold on to, watch_out for the mix-up to avoid, connect for a link to something they already know.',
        'Rules: quote the section text exactly; notes guide attention and ask the student to think, they do not answer any practice question; use only the section text; at most 25 words per note.',
        'Return JSON only.',
    ].join('\n')
    const user = [
        `Section: ${sectionTitle}`,
        `What the student is stuck on: ${focus || 'the main ideas of this section'}`,
        `Section text:\n"""${sectionText.slice(0, 6000)}"""`,
    ].join('\n\n')
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
