/**
 * Deterministic pre-release checks for an instructor shadow pilot.
 *
 * The checklist is deliberately derived from the saved draft and its policy
 * metadata. It is not an AI judgment: every item is inspectable, testable, and
 * must pass before a pilot can move from shadow to ready/published.
 */
const REQUIRED_RUNTIME = ['reading', 'activity', 'simulation', 'tutor', 'analytics', 'social_dynamics']

export function evaluatePilotReadiness(pilot, draftOverride = null) {
    const draft = draftOverride || pilot?.generation_draft || {}
    const sections = Array.isArray(draft.sections) ? draft.sections : []
    const objectives = Array.isArray(pilot?.learning_objectives) && pilot.learning_objectives.length > 0
        ? pilot.learning_objectives
        : (Array.isArray(draft.learning_objectives) ? draft.learning_objectives : [])
    const generated = Array.isArray(draft.runtime_package?.generated) ? draft.runtime_package.generated : []
    const warnings = Array.isArray(draft.quality?.warnings) ? draft.quality.warnings.filter(Boolean) : []
    const warningsAcknowledged = draft.quality?.warnings_acknowledged === true || pilot?.settings?.quality_warnings_acknowledged === true
    const settings = pilot?.settings || {}

    const checks = [
        {
            id: 'course',
            label: 'Course and module are assigned',
            detail: 'A stable course ID and module name identify the release.',
            ok: Boolean(String(pilot?.course_id || '').trim() && String(pilot?.module_name || '').trim()),
        },
        {
            id: 'source',
            label: 'Source checksum is recorded',
            detail: 'The instructor can trace the draft back to an immutable source revision.',
            ok: Boolean(draft.source?.sha256 || pilot?.source_revision),
        },
        {
            id: 'sections',
            label: 'At least one reading section is generated',
            detail: 'The learner-facing module cannot be empty.',
            ok: sections.length > 0,
        },
        {
            id: 'objectives',
            label: 'Learning objectives are present',
            detail: 'The instructor can review what each generated section is meant to teach.',
            ok: objectives.some((objective) => String(objective || '').trim().length > 0),
        },
        {
            id: 'runtime',
            label: 'Reading, activity, simulation, tutor, analytics, and social package is present',
            detail: 'All generated learner-facing surfaces are represented in the runtime package.',
            ok: REQUIRED_RUNTIME.every((name) => generated.includes(name)),
        },
        {
            id: 'quality',
            label: 'Generation review notes are acknowledged',
            detail: warnings.length > 0 ? (warningsAcknowledged ? `${warnings.length} review note(s) acknowledged by the instructor.` : warnings[0]) : 'The draft has no blocking quality warnings.',
            ok: warnings.length === 0 || warningsAcknowledged,
        },
        {
            id: 'governance',
            label: 'Student visibility and automation remain gated',
            detail: 'Learner visibility is off, automatic actions are off, and instructor approval is required.',
            ok: settings.student_visible === false && settings.automatic_publish === false && settings.automatic_messaging === false && settings.automatic_grading === false && settings.instructor_approval_required === true,
        },
    ]

    return {
        checks,
        passed: checks.filter((check) => check.ok).length,
        total: checks.length,
        ready: checks.every((check) => check.ok),
        warningCount: warnings.length,
        warningsAcknowledged,
    }
}
