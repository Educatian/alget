import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./supabase', () => ({
    isSupabaseConfigured: false,
    supabase: { auth: { getSession: vi.fn() } },
}))
import {
    buildEvidenceBrief,
    buildImpactReport,
    impactReportToMarkdown,
    loadFacultyWorkspace,
    loadPublishedCourseSection,
    acknowledgePilotWarnings,
    publishFacultyPilot,
    saveEvidenceBrief,
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
        expect(workspace.pilots[0]).toMatchObject({ status: 'shadow', settings: { student_visible: false, automatic_publish: false, automatic_grading: false } })
    })

    it('publishes an approved generated draft into the learner reader format', async () => {
        const pilot = await saveShadowPilot({
            courseId: 'ail-606',
            title: 'Faculty evidence partnership',
            moduleName: 'Evaluating AI evidence',
            sourceName: 'course.doc',
            learningObjectives: ['Evaluate a claim'],
            generationDraft: {
                source: { title: 'Course source', sha256: 'sha256:course-source' },
                references: [{ title: 'Canonical source', url: 'https://example.edu/source', license_url: 'https://example.edu/license' }],
                sections: [{ title: 'Evidence evaluation', reading: { content: 'Inspect the source. Identify a bounded claim, and explain which source detail supports or revises that interpretation before you move to the activity.', estimated_minutes: 6 }, references: [{ title: 'Canonical source', url: 'https://example.edu/source' }], knowledge_base: { chunks: [{ text: 'source' }] }, practice: { problems: [{ id: 'p1' }] } }],
                runtime_package: { generated: ['reading', 'activity', 'simulation', 'tutor', 'analytics', 'social_dynamics'] },
                quality: { warnings: [] },
            },
        })
        const result = await publishFacultyPilot(pilot, 'local')
        const route = `${result.published.id}-1`
        const section = await loadPublishedCourseSection('ail-606', route)

        expect(result.pilot.status).toBe('active')
        expect(section.meta).toMatchObject({ chapter: 'published', title: 'Evidence evaluation' })
        expect(section.meta.references).toHaveLength(1)
        expect(section.meta.source_status).toBe('context_attached')
        expect(section.content).toContain('Inspect the source.')
        expect(section.content).toContain('Related open textbook reading')
        expect(section.practice.problems).toHaveLength(1)
        expect(section.knowledge_base.chunks[0].text).toBe('source')
    })

    it('persists instructor acknowledgement of generation review notes', async () => {
        const pilot = await saveShadowPilot({
            courseId: 'ail-606',
            title: 'Faculty evidence partnership',
            moduleName: 'Review notes',
            learningObjectives: ['Inspect warnings'],
            generationDraft: {
                source: { sha256: 'sha256:review-notes' },
                sections: [{ title: 'Review notes' }],
                runtime_package: { generated: ['reading', 'activity', 'simulation', 'tutor', 'analytics', 'social_dynamics'] },
                quality: { warnings: ['Review this deterministic fallback.'] },
            },
        })
        const updated = await acknowledgePilotWarnings(pilot, pilot.generation_draft, 'local')
        expect(updated.settings.quality_warnings_acknowledged).toBe(true)
        expect(updated.generation_draft.quality.warnings_acknowledged).toBe(true)
        const workspace = await loadFacultyWorkspace('ail-606')
        expect(workspace.pilots[0].generation_draft.quality.warnings_acknowledged).toBe(true)
    })

    it('rejects publishing a draft that has not passed the release gate', async () => {
        await expect(publishFacultyPilot({
            id: 'pilot-incomplete',
            course_id: 'ail-606',
            module_name: 'Incomplete module',
            generation_draft: { sections: [{ title: 'Draft section' }] },
            learning_objectives: [],
            settings: { student_visible: false, automatic_publish: false, automatic_messaging: false, automatic_grading: false, instructor_approval_required: true },
        }, 'local')).rejects.toThrow(/not release-ready/i)
    })

    it('exports an evidence-limited course improvement report', () => {
        const brief = buildEvidenceBrief({ courseId: 'ail-606' })
        const report = buildImpactReport({ courseId: 'ail-606', pilot: null, brief })
        const markdown = impactReportToMarkdown(report)

        expect(markdown).toContain('does not make a causal claim')
        expect(report.safeguards.deidentified_export).toBe(true)
    })

    it('never writes learner identifiers or names to browser fallback storage', async () => {
        const brief = buildEvidenceBrief({
            courseId: 'ail-606',
            strugglers: [{ user_id: 'student-1', displayName: 'Student A', average: 0.2, conceptCount: 4 }],
        })
        await saveEvidenceBrief(brief, 'local')

        expect(localStorage.getItem('alget_faculty_partnership_v1')).not.toContain('student-1')
        expect(localStorage.getItem('alget_faculty_partnership_v1')).not.toContain('Student A')
    })
})
