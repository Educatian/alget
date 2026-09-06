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
    {
        id: 'bio-inspired-intervention-2026',
        label: 'Bio-Inspired Design Study',
        courseId: 'bio-inspired',
        track: 'research',
        requiresStudyId: true,
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

function normalizeStudyId(value = '') {
    return value.trim().toLowerCase()
}

function isValidStudyId(value = '') {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value)
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

export function buildCohortLearnerProfile({ cohortId, fullName, studyId = '' }) {
    const cohort = findCohort(cohortId)
    const cleanStudyId = normalizeStudyId(studyId)
    if (cohort.requiresStudyId && !isValidStudyId(cleanStudyId)) {
        throw new Error('Enter the UUID study ID provided by the research team.')
    }
    const cleanName = cohort.requiresStudyId
        ? 'Study Learner'
        : normalizeName(fullName)
    const keySeed = `${cohort.id}:${cleanName.toLocaleLowerCase()}`
    const learnerHash = cohort.requiresStudyId ? cleanStudyId : hashString(keySeed)

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

export function toPrivacySafeLearnerProfile(profile) {
    if (!profile) return null
    const safe = {
        cohortId: profile.cohortId,
        cohortLabel: profile.cohortLabel,
        courseId: profile.courseId,
    }
    if (profile.track !== 'research') safe.learnerHash = profile.learnerHash
    return safe
}

export function persistCohortLearner(profile) {
    safeLocalStorageSet(COHORT_LEARNER_KEY, JSON.stringify(profile))
    const socialAlias = profile.track === 'research'
        ? profile.fullName
        : profile.fullName
    safeLocalStorageSet('alget_social_alias', socialAlias)
}

export function getCohortGuestCredentials(profile = readCohortLearner()) {
    if (!profile?.cohortId || !profile?.learnerHash) return null
    if (profile.track === 'research') return null

    return {
        guestEmail: `student-${profile.cohortId}-${profile.learnerHash}@alget.test`,
        guestPassword: `Alget-${profile.cohortId}-${profile.learnerHash}-2026!`,
    }
}

export function buildInvitedCohortProfile(authUser) {
    const metadata = authUser?.user_metadata || {}
    const cohort = CURRENT_STUDENT_COHORTS.find((candidate) => candidate.id === metadata.cohort_id)
    if (!cohort || metadata.course_id !== cohort.courseId) return null
    const learnerHash = cohort.requiresStudyId
        ? normalizeStudyId(metadata.learner_hash)
        : String(metadata.learner_hash || '').trim()
    if (!learnerHash || (cohort.requiresStudyId && !isValidStudyId(learnerHash))) return null
    const invitedName = normalizeName(metadata.display_name || metadata.full_name || '')
    if (!cohort.requiresStudyId && invitedName.length < 2) return null
    return {
        cohortId: cohort.id,
        cohortLabel: cohort.label,
        courseId: cohort.courseId,
        track: cohort.track,
        fullName: cohort.requiresStudyId
            ? (/^Study Learner [A-Z0-9]{4,10}$/.test(invitedName) ? invitedName : 'Study Learner')
            : invitedName,
        learnerHash,
        enteredAt: new Date().toISOString(),
        invitationBound: true,
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
            display_name: profile.track === 'research'
                ? profile.fullName
                : profile.fullName,
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
    const safeMetadata = {
        ...(authUser?.user_metadata || {}),
        cohort_id: profile.cohortId,
        cohort_label: profile.cohortLabel,
        course_id: profile.courseId,
        learner_hash: profile.learnerHash,
    }
    if (profile.track !== 'research') safeMetadata.full_name = profile.fullName
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
        user_metadata: safeMetadata,
    }
}

export async function signInCohortLearner({ cohortId, fullName, studyId = '' }) {
    const profile = buildCohortLearnerProfile({ cohortId, fullName, studyId })
    if (!profile.fullName || profile.fullName.length < 2) {
        throw new Error('Enter your name before opening the course.')
    }

    if (profile.track === 'research') {
        throw new Error('Research access is invitation-only. Sign in below with the email account invited by the research coordinator; the Study ID is verified from the locked roster.')
    }

    persistCohortLearner(profile)

    if (!isSupabaseConfigured) {
        return buildDisplayUser(null, profile)
    }

    const { guestEmail, guestPassword } = getCohortGuestCredentials(profile)
    const userMetadata = {
        cohort_id: profile.cohortId,
        cohort_label: profile.cohortLabel,
        course_id: profile.courseId,
        learner_hash: profile.learnerHash,
    }
    if (profile.track !== 'research') userMetadata.full_name = profile.fullName

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
