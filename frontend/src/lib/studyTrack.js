// Research study tracks. The server stores the track and Study ID in the
// user's Supabase app_metadata (learners cannot edit it); see
// backend/study_enrollment.py. Users without a study track are unaffected.
import API_BASE from './apiConfig'
import { supabase } from './supabase'

export const STUDY_TRACKS = {
    basic: { label: 'Basic track', courses: ['statics', 'dynamics'], lab: false },
    bio: { label: 'Bio-inspired track', courses: ['bio-inspired'], lab: true },
}

export function getStudyEnrollment(user) {
    const meta = user?.app_metadata || {}
    const track = STUDY_TRACKS[meta.study_track] ? meta.study_track : null
    if (!track) return null
    return { track, studyId: meta.study_id || null, ...STUDY_TRACKS[track] }
}

// What to show as the account name: Study ID sign-ins have a placeholder email.
export function accountLabel(user) {
    const meta = user?.app_metadata || {}
    if (meta.study_login === 'study_id' && meta.study_id) return `Study ID ${meta.study_id}`
    return user?.email || ''
}

export function canOpenCourse(user, courseId) {
    const enrollment = getStudyEnrollment(user)
    return !enrollment || enrollment.courses.includes(courseId)
}

export function canOpenLab(user) {
    const enrollment = getStudyEnrollment(user)
    return !enrollment || enrollment.lab
}

// Sign in with the personal Study ID alone (the account is created on first use).
// The server returns session tokens; setSession fires onAuthStateChange, which
// updates the app's user before this resolves.
export async function loginWithStudyId(studyId) {
    const response = await fetch(`${API_BASE}/study/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ study_id: studyId }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.detail || 'Unable to check the Study ID right now.')

    const { data: session, error } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
    })
    if (error || !session?.user) throw new Error('Signed in, but the session could not start. Please try again.')
    return session.user
}

// Redeem the personal Study ID from the invitation email for the signed-in user,
// then refresh the session so the new app_metadata reaches the client.
export async function enrollInStudy(studyId) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error('Please sign in first.')

    const response = await fetch(`${API_BASE}/study/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ study_id: studyId }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.detail || 'Unable to check the Study ID right now.')

    const { data: refreshed, error } = await supabase.auth.refreshSession()
    if (error) throw new Error('Enrolled, but please sign out and back in to continue.')
    return refreshed.user
}
