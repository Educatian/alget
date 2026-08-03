import { supabase, isSupabaseConfigured } from './supabase'
import { safeLocalStorageGet, safeLocalStorageRemove, safeLocalStorageSet } from './browserStorage'

export const COHORT_LEARNER_KEY = 'alget_cohort_learner_v1'

export const CURRENT_STUDENT_COHORTS = [
    {
        id: 'cat531-summer2026',
        label: 'CAT 531',
        courseId: 'cat531-supplement',
        track: 'education',
    },
    {
        id: 'cat100-summer1-2026',
        label: 'CAT 100 Summer I',
        courseId: 'cat100-supplement',
        track: 'education',
    },
    {
        id: 'cat100-summer2-2026',
        label: 'CAT 100 Summer II',
        courseId: 'cat100-supplement',
        track: 'education',
    },
]

function hashString(value = '') {
    let hash = 2166136261
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index)
        hash = Math.imul(hash, 16777619)
    }
    return (hash >>> 0).toString(36)
}

function normalizeName(value = '') {
    return value.trim().replace(/\s+/g, ' ')
}

function findCohort(cohortId) {
    return CURRENT_STUDENT_COHORTS.find((cohort) => cohort.id === cohortId) || CURRENT_STUDENT_COHORTS[0]
}

export function readCohortLearner() {
    const raw = safeLocalStorageGet(COHORT_LEARNER_KEY)
    if (!raw) return null

    try {
        const parsed = JSON.parse(raw)
        if (!parsed?.cohortId || !parsed?.fullName) return null
        const cohort = findCohort(parsed.cohortId)
        return {
            ...parsed,
            cohortLabel: cohort.label,
            courseId: cohort.courseId,
            track: cohort.track,
        }
    } catch {
        return null
    }
}

export function clearCohortLearner() {
    safeLocalStorageRemove(COHORT_LEARNER_KEY)
}

export function buildCohortLearnerProfile({ cohortId, fullName }) {
    const cohort = findCohort(cohortId)
    const cleanName = normalizeName(fullName)
    const keySeed = `${cohort.id}:${cleanName.toLocaleLowerCase()}`
    const learnerHash = hashString(keySeed)

    return {
        cohortId: cohort.id,
        cohortLabel: cohort.label,
        courseId: cohort.courseId,
        track: cohort.track,
        fullName: cleanName,
        learnerHash,
        enteredAt: new Date().toISOString(),
    }
}

export function persistCohortLearner(profile) {
    safeLocalStorageSet(COHORT_LEARNER_KEY, JSON.stringify(profile))
    safeLocalStorageSet('alget_social_alias', profile.fullName)
}

export function getCohortGuestCredentials(profile = readCohortLearner()) {
    if (!profile?.cohortId || !profile?.learnerHash) return null

    return {
        guestEmail: `student-${profile.cohortId}-${profile.learnerHash}@alget.test`,
        guestPassword: `Alget-${profile.cohortId}-${profile.learnerHash}-2026!`,
    }
}

export function formatUserLabel(user) {
    const stored = readCohortLearner()
    const metadata = user?.user_metadata || {}
    const name = user?.displayName || metadata.full_name || stored?.fullName
    const cohort = user?.cohortLabel || metadata.cohort_label || stored?.cohortLabel
    if (name && cohort) return `${name} · ${cohort}`
    if (name) return name
    return user?.email || 'Learner'
}

async function persistCohortRosterRow(authUser, profile) {
    if (!authUser?.id || !isSupabaseConfigured) return

    const { error } = await supabase
        .from('cohort_learners')
        .upsert({
            user_id: authUser.id,
            display_name: profile.fullName,
            cohort_id: profile.cohortId,
            cohort_label: profile.cohortLabel,
            course_id: profile.courseId,
            learner_hash: profile.learnerHash,
            last_seen_at: new Date().toISOString(),
            profile: {
                source: 'current-student-entry',
                entered_at: profile.enteredAt,
            },
        }, { onConflict: 'user_id' })

    if (error) {
        console.warn('[CohortLearner] Could not persist roster row:', error)
    }
}

export async function markInvitedLearnerActive(authUser) {
    if (!authUser?.id || !isSupabaseConfigured) return
    const metadata = authUser.user_metadata || {}
    if (!metadata.course_id || !metadata.cohort_id || !metadata.learner_hash) return
    const { error } = await supabase
        .from('cohort_learners')
        .update({
            status: 'active',
            accepted_at: new Date().toISOString(),
            last_seen_at: new Date().toISOString(),
        })
        .eq('user_id', authUser.id)
    if (error) console.warn('[CohortLearner] Could not activate invited learner:', error)
}

function buildDisplayUser(authUser, profile) {
    return {
        ...(authUser || {}),
        id: authUser?.id || `cohort-${profile.cohortId}-${profile.learnerHash}`,
        email: authUser?.email || `${profile.fullName} · ${profile.cohortLabel}`,
        displayName: profile.fullName,
        cohortId: profile.cohortId,
        cohortLabel: profile.cohortLabel,
        courseId: profile.courseId,
        track: profile.track,
        isCohortLearner: true,
        user_metadata: {
            ...(authUser?.user_metadata || {}),
            full_name: profile.fullName,
            cohort_id: profile.cohortId,
            cohort_label: profile.cohortLabel,
            course_id: profile.courseId,
            learner_hash: profile.learnerHash,
        },
    }
}

export async function signInCohortLearner({ cohortId, fullName }) {
    const profile = buildCohortLearnerProfile({ cohortId, fullName })
    if (!profile.fullName || profile.fullName.length < 2) {
        throw new Error('Enter your name before opening the course.')
    }

    persistCohortLearner(profile)

    if (!isSupabaseConfigured) {
        return buildDisplayUser(null, profile)
    }

    const { guestEmail, guestPassword } = getCohortGuestCredentials(profile)
    const userMetadata = {
        full_name: profile.fullName,
        cohort_id: profile.cohortId,
        cohort_label: profile.cohortLabel,
        course_id: profile.courseId,
        learner_hash: profile.learnerHash,
    }

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: guestEmail,
        password: guestPassword,
        options: {
            data: userMetadata,
        },
    })

    if (signUpError && !/already registered|already exists|User already/i.test(signUpError.message || '')) {
        throw signUpError
    }

    let authUser = signUpData?.user || null
    if (!signUpData?.session || signUpError) {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: guestEmail,
            password: guestPassword,
        })
        if (signInError) throw signInError
        authUser = signInData?.user || authUser
    }

    if (authUser) {
        await supabase.auth.updateUser({ data: userMetadata }).catch(() => {})
        await persistCohortRosterRow(authUser, profile)
    }

    return buildDisplayUser(authUser, profile)
}
