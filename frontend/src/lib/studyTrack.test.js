import { describe, expect, it, vi } from 'vitest'

vi.mock('./supabase', () => ({ supabase: { auth: {} } }))

const { accountLabel, canOpenCourse, canOpenLab, getStudyEnrollment } = await import('./studyTrack')

const basic = { app_metadata: { study_track: 'basic', study_id: 'id-1' } }
const bio = { app_metadata: { study_track: 'bio', study_id: 'id-2' } }
const regular = { app_metadata: { provider: 'email' } }

describe('studyTrack', () => {
    it('reads the track from app_metadata', () => {
        expect(getStudyEnrollment(basic)).toMatchObject({ track: 'basic', studyId: 'id-1', courses: ['statics', 'dynamics'], lab: false })
        expect(getStudyEnrollment(bio)).toMatchObject({ track: 'bio', courses: ['bio-inspired'], lab: true })
        expect(getStudyEnrollment(regular)).toBeNull()
        expect(getStudyEnrollment({ app_metadata: { study_track: 'other' } })).toBeNull()
        expect(getStudyEnrollment(null)).toBeNull()
    })

    it('limits study participants to their track', () => {
        expect(canOpenCourse(basic, 'statics')).toBe(true)
        expect(canOpenCourse(basic, 'dynamics')).toBe(true)
        expect(canOpenCourse(basic, 'bio-inspired')).toBe(false)
        expect(canOpenCourse(bio, 'bio-inspired')).toBe(true)
        expect(canOpenCourse(bio, 'statics')).toBe(false)
        expect(canOpenLab(basic)).toBe(false)
        expect(canOpenLab(bio)).toBe(true)
    })

    it('shows the Study ID instead of the placeholder email for Study ID sign-ins', () => {
        const participant = { email: 'bio-7k3q-9mzp@participants.alget.example.com', app_metadata: { study_login: 'study_id', study_id: 'BIO-7K3Q-9MZP', study_track: 'bio' } }
        expect(accountLabel(participant)).toBe('Study ID BIO-7K3Q-9MZP')
        expect(accountLabel({ email: 'staff@ua.edu', app_metadata: { study_track: 'bio', study_id: 'BIO-7K3Q-9MZP' } })).toBe('staff@ua.edu')
        expect(accountLabel(null)).toBe('')
    })

    it('leaves non-study users unrestricted', () => {
        expect(canOpenCourse(regular, 'inst-design')).toBe(true)
        expect(canOpenLab(regular)).toBe(true)
    })
})
