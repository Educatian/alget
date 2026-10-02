// Completion rule for the Unity simulation labs (mirrored in backend/study_lab_progress.py).
//
// A lab is complete when the participant has run the required number of trials
// AND tried at least two different designs. Reaching the design goal and
// submitting a final design are NOT required; extra trials after completion
// never undo it. When the lab's events do not say which settings were used,
// designs are not counted against the participant.

const GOAL_RESULTS = /^(pass|passed|balanced|secure[ _-]?grip|success|safe)$/i

function norm(value) {
    return String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_')
}

/**
 * @param {Array<{type: string, data?: object}>} events  normalized lab events (type like 'unity_trial_completed')
 * @param {number} requiredTrials  the lab's own number of trials
 */
export function computeLabProgress(events = [], requiredTrials = 5) {
    const trials = events.filter((e) => e?.type === 'unity_trial_completed')
    const reportedDone = Math.max(0, ...trials.map((t) => Number(t.data?.opportunities_completed) || 0))
    const reportedAvailable = Math.max(0, ...events.map((e) => Number(e?.data?.opportunities_available) || 0))
    const required = reportedAvailable > 0 ? reportedAvailable : requiredTrials
    const trialsDone = Math.max(trials.length, reportedDone)

    const signatures = trials
        .filter((t) => t.data?.input_name !== undefined || t.data?.input_value !== undefined)
        .map((t) => `${t.data.input_name ?? ''}=${t.data.input_value ?? ''}`)
    const designsKnown = signatures.length > 0
    const distinctDesigns = designsKnown ? new Set(signatures).size : trials.length

    const withBoth = trials.filter((t) => t.data?.prediction && t.data?.result)
    const predictionsMatched = withBoth.filter((t) => norm(t.data.prediction) === norm(t.data.result)).length
    const goalMet = trials.some((t) => GOAL_RESULTS.test(norm(t.data?.result)))

    const enoughTrials = trialsDone >= required
    const variedDesigns = !designsKnown || distinctDesigns >= Math.min(2, required)
    return {
        trialsDone,
        required,
        distinctDesigns,
        designsKnown,
        predictionsCompared: withBoth.length,
        predictionsMatched,
        goalMet,
        finalDesignSubmitted: events.some((e) => e?.type === 'unity_final_design_submitted'),
        complete: enoughTrials && variedDesigns,
        needsVariedDesigns: enoughTrials && !variedDesigns,
    }
}
