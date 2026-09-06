import { isSupabaseConfigured, supabase } from './supabase'

export const ENGINEERING_STUDY_EXPERIMENT = 'alget-bio-inspired-agentic-rct-v1'
export const ENGINEERING_STUDY_COHORT = 'bio-inspired-intervention-2026'
export const ENGINEERING_STUDY_COURSE = 'bio-inspired'
export const TREATMENT_ARM = 'treatment_annotation_adaptive'
export const COMPARISON_ARM = 'comparison_practice_only'

const VALID_ARMS = new Set([TREATMENT_ARM, COMPARISON_ARM])

export function isEngineeringStudyLearner(user, courseId) {
    const cohortId = user?.cohortId || user?.user_metadata?.cohort_id
    const userCourse = user?.courseId || user?.user_metadata?.course_id
    return cohortId === ENGINEERING_STUDY_COHORT
        && userCourse === ENGINEERING_STUDY_COURSE
        && courseId === ENGINEERING_STUDY_COURSE
}

export function initialStudyCondition(user, courseId) {
    if (!isEngineeringStudyLearner(user, courseId)) {
        return { status: 'ready', mode: 'standard', assignmentArm: null, experimentKey: null }
    }
    return { status: 'loading', mode: 'research', assignmentArm: null, experimentKey: ENGINEERING_STUDY_EXPERIMENT }
}

export async function loadStudyCondition(user, courseId) {
    if (!isEngineeringStudyLearner(user, courseId)) {
        return initialStudyCondition(user, courseId)
    }
    if (!isSupabaseConfigured || !user?.id) {
        return {
            status: 'blocked',
            mode: 'research',
            assignmentArm: null,
            experimentKey: ENGINEERING_STUDY_EXPERIMENT,
            reason: 'Study assignment service is unavailable. Contact the research team before continuing.',
        }
    }

    const { data, error } = await supabase.rpc('claim_engineering_study_assignment')
    const row = Array.isArray(data) ? data[0] : data
    if (error || !row || !VALID_ARMS.has(row.assignment_arm)) {
        return {
            status: 'blocked',
            mode: 'research',
            assignmentArm: null,
            experimentKey: ENGINEERING_STUDY_EXPERIMENT,
            reason: 'Your concealed study assignment is not provisioned. Contact the research team; do not create another account.',
            diagnosticCode: error?.code || 'assignment_missing',
        }
    }

    return {
        status: 'ready',
        mode: 'research',
        experimentKey: row.experiment_key,
        assignmentArm: row.assignment_arm,
        stratumKey: row.stratum_key,
        allocationBlock: row.allocation_block,
        assignmentHash: row.assignment_hash,
    }
}

export function canUseAdaptiveSupport(condition) {
    return condition?.status === 'ready' && condition?.assignmentArm !== COMPARISON_ARM
}
