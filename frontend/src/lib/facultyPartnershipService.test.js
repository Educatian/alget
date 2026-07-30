import { beforeEach, describe, expect, it } from 'vitest'
import {
    buildEvidenceBrief,
    buildImpactReport,
    impactReportToMarkdown,
    loadFacultyWorkspace,
    saveShadowPilot,
} from './facultyPartnershipService'

describe('facultyPartnershipService', () => {
    beforeEach(() => localStorage.clear())

    it('builds a bounded brief with inspectable evidence and no automated action', () => {
        const brief = buildEvidenceBrief({
            courseId: 'ail-606',
            hotSpots: [{ concept_id: 'source_evaluation', average: 0.42, learnerCount: 7 }],
            strugglers: [{ user_id: 'student-1', displayName: 'Student A', average: 0.38, conceptCount: 4 }],
            interventionOutcomes: [{ total_closed: 4, resolved_positive: 3 }],
        })

        expect(brief.attention.concepts[0].why_now).toMatch(/7 learners/i)
        expect(brief.intervention_summary.positive_rate).toBe(0.75)
        expect(brief.safeguards).toMatchObject({ causal_claim: false, automatic_message: false, automatic_grade: false })
    })

    it('persists a student-invisible shadow pilot in local fallback mode', async () => {
        await saveShadowPilot({
            courseId: 'ail-606',
            title: 'Faculty evidence partnership',
            moduleName: 'Evaluating AI evidence',
            sourceName: 'syllabus.pdf',
            learningObjectives: ['Evaluate a claim'],
        })

        const workspace = await loadFacultyWorkspace('ail-606')
        expect(workspace.pilots).toHaveLength(1)
        expect(workspace.pilots[0]).toMatchObject({ status: 'shadow', settings: { student_visible: false, automatic_grading: false } })
    })

    it('exports an evidence-limited course improvement report', () => {
        const brief = buildEvidenceBrief({ courseId: 'ail-606' })
        const report = buildImpactReport({ courseId: 'ail-606', pilot: null, brief })
        const markdown = impactReportToMarkdown(report)

        expect(markdown).toContain('does not make a causal claim')
        expect(report.safeguards.deidentified_export).toBe(true)
    })
})
