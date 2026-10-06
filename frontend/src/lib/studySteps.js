// The research study's steps for each track, with the Qualtrics links that carry
// the participant's Study ID (all four surveys read study_id, cohort and wave from
// the URL as embedded data). Completed steps are stored in the participant's own
// user_metadata; Qualtrics remains the record of what was actually submitted.
import { supabase } from './supabase'
import { logEvent } from './loggingService'
import { getStudyEnrollment } from './studyTrack'

export const QUALTRICS_FORM_BASE = 'https://universityofalabama.az1.qualtrics.com/jfe/form/'

const SURVEYS = {
    pre: 'SV_5z5mWwX62DyFRCC',
    // One posttest survey for both tracks: Qualtrics shows the Statics/Dynamics items
    // when cohort = study-basic and the bio-inspired items otherwise.
    posttest: 'SV_8xjjebrtWhJnpKC',
    post: 'SV_a33tQxcRlIVJILI',
    gift: 'SV_0oz7vztCdDCiVr8',
}

// kind: 'survey' opens Qualtrics; 'learn' is the ALGET work itself.
// surveyId null means the survey for that track is not ready yet.
function stepsFor(track) {
    const bio = track === 'bio'
    return [
        {
            id: 'pre', kind: 'survey', surveyId: SURVEYS.pre, wave: 'pre',
            title: 'Pre-survey',
            description: 'Consent, a few background questions, and a short starting quiz. Please do this before you begin.',
        },
        {
            id: 'learn', kind: 'learn',
            title: bio ? 'Learn: Bio-Inspired Design and one Simulation Lab' : 'Learn: Engineering Statics and Dynamics',
            description: bio
                ? 'Work through the Bio-Inspired Design module, try the Generative Bio-Design Lab, and complete one Simulation Lab.'
                : 'Work through the Engineering Statics and Engineering Dynamics materials at your own pace.',
        },
        {
            id: 'posttest', kind: 'survey', surveyId: SURVEYS.posttest, wave: 'post',
            title: 'Knowledge check',
            description: 'A short quiz on what you learned. Take it after you finish the learning step.',
        },
        {
            id: 'post', kind: 'survey', surveyId: SURVEYS.post, wave: 'post',
            title: 'Post-survey',
            description: 'Your experience of using ALGET.',
        },
        {
            id: 'gift', kind: 'survey', surveyId: SURVEYS.gift, wave: 'gift',
            title: 'Gift card form',
            description: 'Tell us where to send your $40 gift card. Your answers here are kept separate from your study data.',
        },
    ]
}

export function getStudySteps(user) {
    const enrollment = getStudyEnrollment(user)
    if (!enrollment) return null
    const done = user?.user_metadata?.study_steps || {}
    let previousDone = true
    return stepsFor(enrollment.track).map((step) => {
        const item = {
            ...step,
            done: Boolean(done[step.id]),
            doneAt: done[step.id] || null,
            unlocked: previousDone,
            url: step.surveyId ? surveyUrl(step, enrollment) : null,
        }
        previousDone = item.done
        return item
    })
}

export function surveyUrl(step, enrollment) {
    const url = new URL(step.surveyId, QUALTRICS_FORM_BASE)
    url.searchParams.set('study_id', enrollment.studyId || '')
    url.searchParams.set('cohort', `study-${enrollment.track}`)
    url.searchParams.set('wave', step.wave)
    return url.toString()
}

export const STEP_IDS = ['pre', 'learn', 'posttest', 'post', 'gift']

// Saves the step as done. The session's user updates through onAuthStateChange.
export async function markStepDone(user, stepId, source = 'button') {
    if (!STEP_IDS.includes(stepId)) return
    const steps = { ...(user?.user_metadata?.study_steps || {}) }
    if (steps[stepId]) return
    steps[stepId] = new Date().toISOString()
    const { error } = await supabase.auth.updateUser({ data: { study_steps: steps } })
    if (error) throw new Error('Could not save this step. Please try again.')
    logEvent('study_step_completed', stepId, { step: stepId, source })
}
