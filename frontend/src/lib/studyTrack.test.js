import { describe, expect, it, vi } from 'vitest'

vi.mock('./supabase', () => ({ supabase: { auth: {} } }))

const { canOpenCourse, canOpenLab, getStudyEnrollment } = await import('./studyTrack')

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

    it('leaves non-study users unrestricted', () => {
        expect(canOpenCourse(regular, 'inst-design')).toBe(true)
        expect(canOpenLab(regular)).toBe(true)
    })
})
