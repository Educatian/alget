import {
    LMS_CLASS_COHORT_ID,
    LMS_CLASS_COURSE_ID,
    LMS_CLASS_PARTICIPANT_COUNT,
    buildLmsParticipantKey,
    buildLmsParticipantRoster,
    getLmsParticipantSlot,
    withLmsParticipantScope,
} from './lmsParticipantRoster'

/**
 * Reviewable contract for the Introduction to LMS class preview. This is
 * intentionally metadata-only: it names the learning moves and export join
 * without embedding participant data or pre-authorizing a study.
 */
export const LMS_CLASS_EXEMPLAR = {
    id: 'intro-lms-exemplar-v1',
    title: 'Introduction to LMS · Agentic reading lab',
    courseId: 'inst-design',
    sectionPath: 'inst-design/02/08',
    audience: '28–30 undergraduate learners · online',
    baseMinutes: 120,
    extensionMinutes: 180,
    objectives: [
        'Match learner-content, learner-instructor, and learner-learner interaction to a learning goal.',
        'Use presence and evidence cues to choose an asynchronous, synchronous, or hybrid activity.',
        'Revise one LMS activity rationale after retrieval feedback and an agent explanation.',
    ],
    task: {
        title: 'Design one week of an LMS activity',
        prompt: 'Name the objective, interaction mode, evidence supporting the choice, and one revision after the embedded check.',
        requiredEvidence: ['objective', 'interaction choice', 'source or observation', 'before/after revision note'],
    },
    timeline: [
        { minutes: 10, label: 'Orient', detail: 'Set a learner goal and inspect the evidence boundary.' },
        { minutes: 20, label: 'Read', detail: 'Read interaction, presence, and mode-selection content.' },
        { minutes: 15, label: 'Retrieve', detail: 'Complete sequence/match and confidence checks.' },
        { minutes: 25, label: 'Decide', detail: 'Choose a constrained LMS design move in a branch/scenario.' },
        { minutes: 25, label: 'Revise', detail: 'Complete the artifact task and make one judgment-led revision.' },
        { minutes: 15, label: 'Explain', detail: 'Ask about derived evidence and accept, modify, or decline the next move.' },
        { minutes: 10, label: 'Reflect', detail: 'Write the claim, evidence, and next revision in an exit ticket.' },
    ],
    extension: [
        'Compare asynchronous, synchronous, and hybrid designs with a second example (20 min).',
        'Run a second artifact revision or peer evidence comparison (20 min).',
        'Create a retention check and instructor debrief note (20 min).',
    ],
    rubric: [
        { id: 'alignment', label: 'Objective–activity alignment', observable: 'The activity samples the stated learner behavior.' },
        { id: 'interaction', label: 'Interaction rationale', observable: 'The selected mode names what learners, instructor, and peers do.' },
        { id: 'evidence', label: 'Evidence connection', observable: 'A source or observation supports the design claim.' },
        { id: 'revision', label: 'Revision judgment', observable: 'Before/after change and accept/modify/reject rationale are explicit.' },
    ],
    reflections: [
        'Which evidence most changed your original LMS design claim?',
        'What did BigAL explain, and where did you disagree or need more evidence?',
        'Did you accept, modify, or decline the suggested next action? Why?',
    ],
    exportJoin: {
        learnerKey: 'user_id',
        participantKey: 'participant_id',
        sessionKey: 'session_id',
        sectionKey: 'section_id',
        artifactKey: 'submission_id',
        qualitativeArtifactKey: 'qualitative_artifact_id',
        scopeKeys: ['course_id', 'cohort_id', 'participant_id', 'participant_key'],
        eventTypes: ['sequence_check', 'branch_choice', 'dynamic_scenario_choice', 'artifact_studio_trace', 'analytics_coach_request', 'analytics_coach_response', 'analytics_coach_decision', 'analytics_coach_follow_up'],
        derivedOnly: true,
        limitation: 'Clicks, presence, and support requests are process proxies; they do not establish ability, emotion, engagement, or causal learning gain.',
    },
}

/**
 * Course configuration with provenance. Email evidence is deliberately
 * paraphrased and date-stamped; raw message bodies, addresses, attachments,
 * and DataSandbox project data are not part of the repository.
 */
export const LMS_CLASS_CONFIG = {
    course: {
        id: LMS_CLASS_COURSE_ID,
        title: 'LTPS 210: Introduction to Learning Management Systems',
        provenance: 'confirmed-from-email',
        evidenceNote: 'The instructor email thread names LTPS 210 and requests hands-on exploration, interaction, and critical evaluation of LMS-related platforms (2026-07-30; follow-up 2026-08-11).',
    },
    collaborator: {
        displayLabel: '연지정',
        provenance: 'user-stated',
        emailDisplayLabel: 'Jung, Yeonji',
        emailProvenance: 'confirmed-from-email',
        identityMapping: 'Display labels are kept separate; no identity mapping or address is stored in this config.',
    },
    learnerProfile: {
        value: '28–30 undergraduate learners',
        provenance: 'user-stated',
    },
    delivery: {
        value: 'online',
        durationMinutes: { base: 120, extension: 180 },
        provenance: 'user-stated',
    },
    sessionPlan: {
        value: [
            'Session 1 · tour the existing LMS and identify an interaction/evidence question.',
            'Session 2 · evaluate the existing LMS experience and draft one activity rationale.',
            'Session 3 · use ALGET learner analytics, ask the agent to explain derived evidence, choose/modify/decline one next move, then complete a task and reflection.',
        ],
        provenance: 'user-stated',
    },
    platformInterest: {
        value: 'Existing LMS plus ALGET; the email expresses interest in comparing LMS-related platforms.',
        provenance: 'confirmed-from-email',
        boundary: 'The exact required platform list and whether any comparator is mandatory remain unknown. DataSandbox is not imported into this class fixture.',
    },
    learningDesign: {
        value: 'Evidence-grounded reading, retrieval check, constrained LMS activity artifact, agent explanation, learner decision, follow-up, and reflection.',
        provenance: 'proposed',
    },
    evaluation: {
        value: 'Artifact rubric plus derived event join for sequence, branch, artifact, coach response, decision, and follow-up.',
        provenance: 'proposed',
    },
    unknowns: [
        'Exact meeting dates/schedule and synchronous versus asynchronous split.',
        'Instruction language, required comparator platforms, and grading weights.',
        'Research consent/IRB procedure and whether any data leave the local test harness.',
    ],
}

/** Local-only roster contract: 30 available pseudonymous slots, zero active by default. */
export const LMS_CLASS_ROSTER = Object.freeze({
    courseId: LMS_CLASS_COURSE_ID,
    cohortId: LMS_CLASS_COHORT_ID,
    capacity: LMS_CLASS_PARTICIPANT_COUNT,
    activeCount: 0,
    slots: Object.freeze(buildLmsParticipantRoster([])),
    accessBoundary: 'Slot numbers never authenticate a learner. Bind an active slot to an existing authenticated account or invitation token only after approval.',
})

const SYNTHETIC_SECTION = LMS_CLASS_EXEMPLAR.sectionPath

/**
 * Two distinct, explicitly synthetic evidence states for local QA. They use
 * separate participant/session IDs so the full flow can prove isolation.
 */
export const LMS_CLASS_FIXTURES = Object.freeze({
    'intro-lms-weak': Object.freeze({
        key: 'intro-lms-weak',
        label: 'Synthetic learner A · needs interaction-mode review',
        synthetic: true,
        participantId: 'participant-01',
        participantKey: buildLmsParticipantKey('participant-01'),
        courseId: LMS_CLASS_COURSE_ID,
        cohortId: LMS_CLASS_COHORT_ID,
        sessionId: 'synthetic-session-01',
        ownerAuthId: 'synthetic-auth-participant-01',
        evidenceAsOf: '2026-09-04T09:00:00.000Z',
        recentSection: { course: 'inst-design', chapter: '02', section: '08', sectionId: SYNTHETIC_SECTION, title: 'Online & Distance Learning Design' },
        masteryRows: [
            { concept_id: 'interaction_design', p_known: 0.35, mastery_score: 0.35, attempts_count: 4, correct_count: 1, last_practiced_at: '2026-09-04T08:50:00.000Z' },
            { concept_id: 'community_of_inquiry', p_known: 0.52, mastery_score: 0.52, attempts_count: 3, correct_count: 2, last_practiced_at: '2026-09-04T08:55:00.000Z' },
        ],
        exitTickets: [{ sectionId: SYNTHETIC_SECTION, course: 'inst-design', chapter: '02', section: '08', title: 'Synthetic reflection · interaction mode', text: 'Synthetic trace: the learner revised a one-week activity after comparing learner–content and learner–learner evidence.', updatedAt: '2026-09-04T09:00:00.000Z' }],
        reflectionSummary: 'The learner revised a one-week activity after comparing learner–content and learner–learner evidence.',
        dominantMisconceptions: [{ type: 'interaction_blindspot', count: 2 }],
        recommendedAction: 'Review the weakest observed concept',
    }),
    'intro-lms-ready': Object.freeze({
        key: 'intro-lms-ready',
        label: 'Synthetic learner B · ready for a retention check',
        synthetic: true,
        participantId: 'participant-02',
        participantKey: buildLmsParticipantKey('participant-02'),
        courseId: LMS_CLASS_COURSE_ID,
        cohortId: LMS_CLASS_COHORT_ID,
        sessionId: 'synthetic-session-02',
        ownerAuthId: 'synthetic-auth-participant-02',
        evidenceAsOf: '2026-09-04T09:05:00.000Z',
        recentSection: { course: 'inst-design', chapter: '02', section: '08', sectionId: SYNTHETIC_SECTION, title: 'Online & Distance Learning Design' },
        masteryRows: [
            { concept_id: 'interaction_design', p_known: 0.84, mastery_score: 0.84, attempts_count: 6, correct_count: 5, last_practiced_at: '2026-09-04T08:56:00.000Z' },
            { concept_id: 'community_of_inquiry', p_known: 0.91, mastery_score: 0.91, attempts_count: 5, correct_count: 5, last_practiced_at: '2026-09-04T09:00:00.000Z' },
        ],
        exitTickets: [{ sectionId: SYNTHETIC_SECTION, course: 'inst-design', chapter: '02', section: '08', title: 'Synthetic reflection · transfer', text: 'Synthetic trace: the learner compared two modes and recorded a retention question for the next check.', updatedAt: '2026-09-04T09:05:00.000Z' }],
        reflectionSummary: 'The learner compared two modes and recorded a retention question for the next check.',
        dominantMisconceptions: [],
        recommendedAction: 'Run one retention check',
    }),
})

export function getLmsClassFixture(key) {
    return key && LMS_CLASS_FIXTURES[key] ? LMS_CLASS_FIXTURES[key] : null
}

/**
 * Derive the coach's single reversible move from the observed records. This
 * intentionally describes estimates and their limits; it never labels a
 * learner as capable, struggling, engaged, or disengaged.
 */
export function deriveLmsCoachRecommendation({ masteryRows = [], recentSection = null, latestExitTicket = null } = {}) {
    const rows = (Array.isArray(masteryRows) ? masteryRows : [])
        .map((row) => ({ ...row, observedScore: Number(row?.mastery_score ?? row?.p_known) }))
        .filter((row) => Number.isFinite(row.observedScore))
        .sort((a, b) => a.observedScore - b.observedScore)
    const weakest = rows.find((row) => row.observedScore < 0.6)
    const sectionId = recentSection?.sectionId || LMS_CLASS_EXEMPLAR.sectionPath
    if (weakest) {
        return {
            id: 'review_weakest_concept',
            label: 'Review the weakest observed concept',
            sectionId,
            rationale: `The lowest observed estimate is ${Math.round(weakest.observedScore * 100)}% for ${String(weakest.concept_id || '').replace(/[_-]/g, ' ')} across ${Number(weakest.attempts_count || 0)} attempts. Review it, then run one check; this estimate does not explain why the score is low.`,
        }
    }
    if (rows.length > 0) {
        const minimum = Math.round(rows[0].observedScore * 100)
        return {
            id: 'retention_check',
            label: 'Run one retention check',
            sectionId,
            rationale: `The ${rows.length} observed concept estimates range from ${minimum}% upward in this snapshot${latestExitTicket ? ', with a saved reflection trace' : ''}. A delayed retrieval check tests durability; it does not prove mastery from these estimates alone.`,
        }
    }
    return {
        id: 'collect_evidence',
        label: 'Complete one evidence check',
        sectionId,
        rationale: 'There are no synced concept estimates yet. Complete one check or save a reflection before asking the agent to compare learning evidence.',
    }
}

/** Construct derived-only synthetic events for export-join tests. */
export function buildLmsFixtureEvents(fixtureKey, decision = null, reasonLength = null, qualitativeArtifactId = null) {
    const fixture = getLmsClassFixture(fixtureKey)
    if (!fixture) return []
    const nextAction = decision === 'decline'
        ? 'no_action'
        : deriveLmsCoachRecommendation({ masteryRows: fixture.masteryRows, recentSection: fixture.recentSection, latestExitTicket: fixture.exitTickets[0] }).id
    const base = {
        user_id: `synthetic-user-${fixture.participantId}`,
        session_id: fixture.sessionId,
        section_id: SYNTHETIC_SECTION,
    }
    const events = [
        withLmsParticipantScope({ ...base, event_type: 'sequence_check', event_data: { client_seq: 1 } }, fixture.participantId),
        withLmsParticipantScope({ ...base, event_type: 'analytics_coach_request', event_data: { client_seq: 2, question_length: 26 } }, fixture.participantId),
        withLmsParticipantScope({ ...base, event_type: 'analytics_coach_response', event_data: { client_seq: 3, response_length: fixture === LMS_CLASS_FIXTURES['intro-lms-weak'] ? 212 : 198, used_synced_evidence: true } }, fixture.participantId),
    ]
    if (decision) {
        events.push(withLmsParticipantScope({ ...base, event_type: 'analytics_coach_decision', event_data: { client_seq: 4, decision, reason_length: Number(reasonLength) || 0, next_action: nextAction, qualitative_artifact_id: qualitativeArtifactId || null } }, fixture.participantId))
        events.push(withLmsParticipantScope({ ...base, event_type: 'analytics_coach_follow_up', event_data: { client_seq: 5, result: nextAction === 'no_action' ? 'declined' : 'opened', next_action: nextAction, qualitative_artifact_id: qualitativeArtifactId || null } }, fixture.participantId))
    }
    return events
}

/**
 * Build a privacy-safe analysis join for the exemplar export. This deliberately
 * drops event_data prose/answers and retains only stable keys plus derived
 * artifact quality. It is a pure function so a release check can exercise the
 * exact export contract without touching Supabase or participant data.
 */
export function buildLmsClassExportJoin(events = [], artifactScores = []) {
    const allowedTypes = new Set(LMS_CLASS_EXEMPLAR.exportJoin.eventTypes)
    const scoresBySubmission = new Map()

    for (const artifact of Array.isArray(artifactScores) ? artifactScores : []) {
        const submissionId = artifact?.submission_id || artifact?.submissionId || artifact?.artifact_key
        if (!submissionId) continue
        const score = Number(artifact?.artifact_score ?? artifact?.score ?? artifact?.quality)
        scoresBySubmission.set(String(submissionId), Number.isFinite(score) ? score : null)
    }

    return (Array.isArray(events) ? events : [])
        .filter((event) => allowedTypes.has(event?.event_type))
        .map((event) => {
            // A participant number is meaningful only inside this exact
            // course/cohort. Reject malformed or cross-course scoped rows
            // before they can enter a local export join.
            if (event?.participant_id) {
                const participantId = String(event.participant_id)
                const expectedKey = buildLmsParticipantKey(participantId, {
                    courseId: event?.course_id,
                    cohortId: event?.cohort_id,
                })
                if (!getLmsParticipantSlot(participantId) || event?.course_id !== LMS_CLASS_COURSE_ID || event?.cohort_id !== LMS_CLASS_COHORT_ID || event?.participant_key !== expectedKey) return null
            }
            const submissionId = event?.event_data?.submission_id || event?.submission_id || null
            const row = {
                user_id: event?.user_id || null,
                session_id: event?.session_id || null,
                section_id: event?.section_id || null,
                event_type: event.event_type,
                client_seq: Number.isFinite(Number(event?.event_data?.client_seq)) ? Number(event.event_data.client_seq) : null,
                submission_id: submissionId,
                artifact_score: submissionId ? (scoresBySubmission.get(String(submissionId)) ?? null) : null,
            }
            // Existing exports retain their original shape. Scoped class
            // fixtures additionally carry course/cohort/participant keys so
            // participant-01 in one class cannot join participant-01 elsewhere.
            if (event?.participant_id) row.participant_id = event.participant_id
            if (event?.participant_key) row.participant_key = event.participant_key
            if (event?.course_id) row.course_id = event.course_id
            if (event?.cohort_id) row.cohort_id = event.cohort_id
            // Decision and follow-up fields are bounded enums/metrics, not
            // learner prose. Keeping them lets an export consumer reconstruct
            // the agentic loop without opening raw event_data.
            if (['accept', 'modify', 'decline'].includes(event?.event_data?.decision)) row.decision = event.event_data.decision
            if (Number.isFinite(Number(event?.event_data?.reason_length))) row.reason_length = Number(event.event_data.reason_length)
            if (typeof event?.event_data?.next_action === 'string') row.next_action = event.event_data.next_action
            if (typeof event?.event_data?.result === 'string') row.result = event.event_data.result
            if (typeof event?.event_data?.qualitative_artifact_id === 'string' && event.event_data.qualitative_artifact_id) row.qualitative_artifact_id = event.event_data.qualitative_artifact_id
            return row
        })
        .filter(Boolean)
}
