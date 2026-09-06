import { ENGINEERING_STUDY_COHORT, ENGINEERING_STUDY_COURSE } from './studyCondition'

export const ENGINEERING_STUDY_SURVEY_PHASES = {
    pre: { title: 'Engineering study pre-survey', envKey: 'VITE_ENGINEERING_STUDY_PRE_SID' },
    post: { title: 'Engineering study post-survey', envKey: 'VITE_ENGINEERING_STUDY_POST_SURVEY_SID' },
    posttest: { title: 'Bio-Inspired Design post-test', envKey: 'VITE_ENGINEERING_STUDY_POSTTEST_SID' },
    'gift-card': { title: 'Gift-card contact form', envKey: 'VITE_ENGINEERING_STUDY_GIFT_CARD_SID' },
    retention: { title: 'Bio-Inspired Design retention test', envKey: 'VITE_ENGINEERING_STUDY_RETENTION_SID' },
}

export function isEngineeringStudySurveyUser(user) {
    const metadata = user?.user_metadata || {}
    const cohortId = user?.cohortId || metadata.cohort_id
    const courseId = user?.courseId || metadata.course_id
    const studyId = String(metadata.learner_hash || '').trim().toLowerCase()
    return cohortId === ENGINEERING_STUDY_COHORT
        && courseId === ENGINEERING_STUDY_COURSE
        && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(studyId)
}

export function getEngineeringStudySurveyConfig(env = import.meta.env) {
    return {
        enabled: env.VITE_ENGINEERING_STUDY_SURVEYS_ENABLED === 'true',
        datacenter: env.VITE_ENGINEERING_STUDY_QUALTRICS_DC || 'az1',
        surveyIds: Object.fromEntries(
            Object.entries(ENGINEERING_STUDY_SURVEY_PHASES).map(([phase, entry]) => [phase, String(env[entry.envKey] || '').trim()]),
        ),
    }
}

export function buildEngineeringStudySurveyUrl({ datacenter, surveyId, studyId, phase }) {
    if (!/^SV_[A-Za-z0-9]+$/.test(surveyId || '')) return null
    // Keep the browser destination aligned with the exact CSP allowlist.
    if (datacenter !== 'az1') return null
    const url = new URL(`https://${datacenter}.qualtrics.com/jfe/form/${surveyId}`)
    url.searchParams.set('study_id', studyId)
    url.searchParams.set('wave', phase)
    url.searchParams.set('cohort', ENGINEERING_STUDY_COHORT)
    return url.toString()
}

export function isEngineeringStudySurveyPortalEnabled(env = import.meta.env) {
    const config = getEngineeringStudySurveyConfig(env)
    return config.enabled && Object.values(config.surveyIds).some(Boolean)
}
