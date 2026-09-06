import { describe, expect, it } from 'vitest'
import { evaluatePilotReadiness } from './pilotReadiness'

const readyPilot = {
    course_id: 'ail-606',
    module_name: 'Evidence evaluation',
    source_revision: 'sha256:abc',
    learning_objectives: ['Evaluate claims with evidence'],
    settings: {
        student_visible: false,
        automatic_publish: false,
        automatic_messaging: false,
        automatic_grading: false,
        instructor_approval_required: true,
    },
    generation_draft: {
        sections: [{ section_id: '01', reading: { content: 'A source-grounded lesson with enough prose to make the generated section reviewable and useful for learners. It explains the central idea, shows the evidence boundary, and prompts a learner to test and revise the interpretation.', }, knowledge_base: { chunks: [{ text: 'evidence' }] }, practice: { problems: [{ id: 'p1' }] } }],
        runtime_package: { generated: ['reading', 'activity', 'simulation', 'tutor', 'analytics', 'social_dynamics'] },
        quality: { warnings: [] },
    },
}

describe('pilot readiness gate', () => {
    it('passes only when the source, objectives, runtime package, and governance policy are complete', () => {
        const result = evaluatePilotReadiness(readyPilot)

        expect(result).toMatchObject({ passed: 8, total: 8, ready: true })
        expect(result.checks.every((check) => check.ok)).toBe(true)
    })

    it('reports the missing checks instead of treating a partial draft as ready', () => {
        const result = evaluatePilotReadiness({
            course_id: 'ail-606',
            module_name: 'Evidence evaluation',
            generation_draft: { sections: [] },
            settings: { student_visible: false },
        })

        expect(result.ready).toBe(false)
        expect(result.checks.filter((check) => !check.ok).map((check) => check.id)).toEqual([
            'source', 'sections', 'objectives', 'runtime', 'learning-assets', 'governance',
        ])
    })

    it('keeps deterministic fallback warnings visible as a release blocker', () => {
        const result = evaluatePilotReadiness({
            ...readyPilot,
            generation_draft: { ...readyPilot.generation_draft, quality: { warnings: ['Review the deterministic fallback.'] } },
        })

        expect(result.ready).toBe(false)
        expect(result.checks.find((check) => check.id === 'quality')).toMatchObject({ ok: false, detail: 'Review the deterministic fallback.' })
    })

    it('allows an instructor to acknowledge review notes without opening student visibility', () => {
        const result = evaluatePilotReadiness({
            ...readyPilot,
            settings: { ...readyPilot.settings, quality_warnings_acknowledged: true },
            generation_draft: { ...readyPilot.generation_draft, quality: { warnings: ['Review the deterministic fallback.'] } },
        })

        expect(result.ready).toBe(true)
        expect(result.warningCount).toBe(1)
        expect(result.warningsAcknowledged).toBe(true)
    })
})
