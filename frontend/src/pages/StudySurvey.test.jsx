import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import {
    buildEngineeringStudySurveyUrl,
    getEngineeringStudySurveyConfig,
    isEngineeringStudySurveyUser,
} from '../lib/engineeringStudySurvey'
import StudySurvey from './StudySurvey'

const researchUser = {
    cohortId: 'bio-inspired-intervention-2026',
    courseId: 'bio-inspired',
    user_metadata: {
        cohort_id: 'bio-inspired-intervention-2026',
        course_id: 'bio-inspired',
        learner_hash: '123e4567-e89b-42d3-a456-426614174000',
    },
}

function renderRoute(user = researchUser, phase = 'pre') {
    return render(
        <MemoryRouter initialEntries={[`/study-survey/${phase}`]}>
            <Routes>
                <Route path="/study-survey/:phase" element={<StudySurvey user={user} />} />
            </Routes>
        </MemoryRouter>,
    )
}

afterEach(() => {
    cleanup()
    vi.unstubAllEnvs()
})

describe('ALGET engineering survey portal', () => {
    it('recognizes only invitation-bound Bio-Inspired research users', () => {
        expect(isEngineeringStudySurveyUser(researchUser)).toBe(true)
        expect(isEngineeringStudySurveyUser({ ...researchUser, courseId: 'statics' })).toBe(false)
        expect(isEngineeringStudySurveyUser({ ...researchUser, user_metadata: { ...researchUser.user_metadata, learner_hash: 'name@example.com' } })).toBe(false)
    })

    it('fails closed while the survey portal is disabled', () => {
        vi.stubEnv('VITE_ENGINEERING_STUDY_SURVEYS_ENABLED', 'false')
        vi.stubEnv('VITE_ENGINEERING_STUDY_PRE_SID', 'SV_TEST')
        renderRoute()
        expect(screen.getByRole('status')).toHaveTextContent('This study form is not enabled')
        expect(screen.queryByTitle('Engineering study pre-survey')).not.toBeInTheDocument()
    })

    it('embeds the configured survey for an authorized study account', () => {
        vi.stubEnv('VITE_ENGINEERING_STUDY_SURVEYS_ENABLED', 'true')
        vi.stubEnv('VITE_ENGINEERING_STUDY_QUALTRICS_DC', 'az1')
        vi.stubEnv('VITE_ENGINEERING_STUDY_PRE_SID', 'SV_TEST123')
        renderRoute()
        const frame = screen.getByTitle('Engineering study pre-survey')
        expect(frame).toHaveAttribute('src', expect.stringContaining('https://az1.qualtrics.com/jfe/form/SV_TEST123'))
        expect(frame).toHaveAttribute('src', expect.stringContaining('study_id=123e4567-e89b-42d3-a456-426614174000'))
        expect(frame).toHaveAttribute('sandbox', 'allow-forms allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox')
        expect(frame).toHaveAttribute('referrerpolicy', 'strict-origin-when-cross-origin')
    })

    it('embeds every configured intervention data-collection phase', () => {
        vi.stubEnv('VITE_ENGINEERING_STUDY_SURVEYS_ENABLED', 'true')
        vi.stubEnv('VITE_ENGINEERING_STUDY_QUALTRICS_DC', 'az1')
        const phases = {
            pre: ['VITE_ENGINEERING_STUDY_PRE_SID', 'SV_PRE'],
            post: ['VITE_ENGINEERING_STUDY_POST_SURVEY_SID', 'SV_POST'],
            posttest: ['VITE_ENGINEERING_STUDY_POSTTEST_SID', 'SV_POSTTEST'],
            'gift-card': ['VITE_ENGINEERING_STUDY_GIFT_CARD_SID', 'SV_GIFTCARD'],
            retention: ['VITE_ENGINEERING_STUDY_RETENTION_SID', 'SV_RETENTION'],
        }

        for (const [phase, [envKey, surveyId]] of Object.entries(phases)) {
            vi.stubEnv(envKey, surveyId)
            const view = renderRoute(researchUser, phase)
            const frame = screen.getByTitle(/.+/)
            expect(frame).toHaveAttribute('src', expect.stringContaining(`/form/${surveyId}`))
            expect(frame).toHaveAttribute('src', expect.stringContaining(`wave=${phase}`))
            view.unmount()
        }
    })

    it('rejects malformed survey ids and preserves an explicit disabled default', () => {
        const config = getEngineeringStudySurveyConfig({ VITE_ENGINEERING_STUDY_SURVEYS_ENABLED: 'false' })
        expect(config.enabled).toBe(false)
        expect(buildEngineeringStudySurveyUrl({ datacenter: 'az1', surveyId: 'javascript:alert(1)', studyId: 'S1', phase: 'pre' })).toBeNull()
        expect(buildEngineeringStudySurveyUrl({ datacenter: 'evil', surveyId: 'SV_TEST123', studyId: 'S1', phase: 'pre' })).toBeNull()
    })
})
