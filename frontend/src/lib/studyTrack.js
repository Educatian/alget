// Fall 2026 study tracks. The server stores the track and Study ID in the
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

export function canOpenCourse(user, courseId) {
    const enrollment = getStudyEnrollment(user)
    return !enrollment || enrollment.courses.includes(courseId)
}

export function canOpenLab(user) {
    const enrollment = getStudyEnrollment(user)
    return !enrollment || enrollment.lab
}

// Redeem a track code for the signed-in user, then refresh the session so the
// new app_metadata reaches the client. Returns the refreshed user.
export async function enrollInStudy(passcode) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error('Please sign in first.')

    const response = await fetch(`${API_BASE}/study/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ passcode }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.detail || 'Unable to check the study code right now.')

    const { data: refreshed, error } = await supabase.auth.refreshSession()
    if (error) throw new Error('Enrolled, but please sign out and back in to continue.')
    return refreshed.user
}
