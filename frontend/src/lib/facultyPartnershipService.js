import { isSupabaseConfigured, supabase } from './supabase'
import { LLM_API_BASE } from './apiConfig'

const STORAGE_KEY = 'alget_faculty_partnership_v1'

function emptyState() {
    return { pilots: [], briefs: [], reports: [] }
}

function readLocalState() {
    try {
        return { ...emptyState(), ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }
    } catch {
        return emptyState()
    }
}

function writeLocalState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    return state
}

function localId(prefix) {
    return `${prefix}-${crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`
}

export function buildEvidenceBrief({ courseId, hotSpots = [], strugglers = [], interventionOutcomes = [] }) {
    const concepts = [...hotSpots]
        .sort((left, right) => Number(left.average) - Number(right.average))
        .slice(0, 3)
        .map((entry) => ({
            concept_id: entry.concept_id,
            average_mastery: Number(entry.average || 0),
            learner_count: Number(entry.learnerCount || 0),
            why_now: `${entry.learnerCount || 0} learners are below the support threshold; cohort mastery is ${Math.round(Number(entry.average || 0) * 100)}%.`,
            recommended_action: 'Use one compare-and-correct prompt, then collect a low-stakes retrieval response.',
        }))
    const learners = [...strugglers].slice(0, 5).map((entry) => ({
        user_id: entry.user_id,
        display_name: entry.displayName || 'Learner',
        average_mastery: Number(entry.average || 0),
        concept_count: Number(entry.conceptCount || 0),
    }))
    const totalClosed = interventionOutcomes.reduce((sum, row) => sum + Number(row.total_closed || 0), 0)
    const resolvedPositive = interventionOutcomes.reduce((sum, row) => sum + Number(row.resolved_positive || 0), 0)
    const now = new Date()
    const periodEnd = now.toISOString().slice(0, 10)
    const periodStartDate = new Date(now)
    periodStartDate.setDate(now.getDate() - 7)

    return {
        schema_version: 'faculty-evidence-brief-v1',
        course_id: courseId,
        period_start: periodStartDate.toISOString().slice(0, 10),
        period_end: periodEnd,
        generated_at: now.toISOString(),
        attention: {
            concept_count: concepts.length,
            learner_count: learners.length,
            concepts,
            learners,
        },
        intervention_summary: {
            total_closed: totalClosed,
            resolved_positive: resolvedPositive,
            positive_rate: totalClosed ? resolvedPositive / totalClosed : null,
        },
        safeguards: {
            causal_claim: false,
            instructor_review_required: true,
            automatic_message: false,
            automatic_grade: false,
        },
    }
}

export function buildImpactReport({ courseId, pilot, brief, interventionOutcomes = [], evaluationGains = [] }) {
    const totalClosed = interventionOutcomes.reduce((sum, row) => sum + Number(row.total_closed || 0), 0)
    const resolvedPositive = interventionOutcomes.reduce((sum, row) => sum + Number(row.resolved_positive || 0), 0)
    const gains = evaluationGains.map((row) => Number(row.mean_gain || row.avg_gain || 0)).filter(Number.isFinite)
    const meanGain = gains.length ? gains.reduce((sum, value) => sum + value, 0) / gains.length : null
    return {
        schema_version: 'faculty-impact-report-v1',
        course_id: courseId,
        pilot_id: pilot?.id || null,
        generated_at: new Date().toISOString(),
        scope: {
            title: pilot?.title || 'Faculty design partnership',
            module_name: pilot?.module_name || 'Selected course module',
            learning_objectives: pilot?.learning_objectives || [],
            status: pilot?.status || 'shadow',
        },
        outcomes: {
            intervention_count: totalClosed,
            resolved_positive: resolvedPositive,
            positive_rate: totalClosed ? resolvedPositive / totalClosed : null,
            mean_evaluation_gain: meanGain,
            concepts_flagged: brief?.attention?.concept_count || 0,
            learners_flagged: brief?.attention?.learner_count || 0,
        },
        interpretation: totalClosed
            ? 'Observed outcomes summarize this course period. They support course improvement decisions but do not establish causal impact without an appropriate comparison design.'
            : 'This baseline report records the pilot scope and current evidence gaps. Outcome claims should wait until interventions close and post-evidence is available.',
        safeguards: {
            deidentified_export: true,
            causal_claim: false,
            instructor_owned: true,
        },
    }
}

export async function loadFacultyWorkspace(courseId) {
    if (isSupabaseConfigured) {
        const [pilots, briefs, reports] = await Promise.all([
            supabase.from('faculty_pilots').select('*').eq('course_id', courseId).order('updated_at', { ascending: false }).limit(20),
            supabase.from('instructor_evidence_briefs').select('*').eq('course_id', courseId).order('period_end', { ascending: false }).limit(20),
            supabase.from('course_impact_reports').select('*').eq('course_id', courseId).order('created_at', { ascending: false }).limit(20),
        ])
        if (!pilots.error && !briefs.error && !reports.error) {
            return { pilots: pilots.data || [], briefs: briefs.data || [], reports: reports.data || [], persistence: 'supabase' }
        }
    }
    const state = readLocalState()
    return {
        pilots: state.pilots.filter((item) => item.course_id === courseId),
        briefs: state.briefs.filter((item) => item.course_id === courseId),
        reports: state.reports.filter((item) => item.course_id === courseId),
        persistence: 'local',
    }
}

export async function saveShadowPilot(payload, persistence = 'local') {
    const record = {
        course_id: payload.courseId,
        title: payload.title.trim(),
        module_name: payload.moduleName.trim(),
        source_name: payload.sourceName?.trim() || null,
        source_url: payload.sourceUrl?.trim() || null,
        source_revision: payload.generationDraft?.source?.sha256 || null,
        generation_draft: payload.generationDraft || {},
        learning_objectives: payload.learningObjectives.map((value) => value.trim()).filter(Boolean),
        status: 'shadow',
        settings: {
            student_visible: false,
            automatic_messaging: false,
            automatic_grading: false,
            instructor_approval_required: true,
        },
    }
    if (persistence === 'supabase') {
        const { data, error } = await supabase.from('faculty_pilots').insert(record).select().single()
        if (error) throw error
        return data
    }
    const state = readLocalState()
    const now = new Date().toISOString()
    const localRecord = { ...record, id: localId('pilot'), created_at: now, updated_at: now }
    state.pilots.unshift(localRecord)
    writeLocalState(state)
    return localRecord
}

export async function importGoogleDocCourseDraft({ courseId, documentUrl }) {
    const { data } = await supabase.auth.getSession()
    const token = data?.session?.access_token || ''
    const response = await fetch(`${LLM_API_BASE}/faculty/google-docs/import`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ course_id: courseId, document_url: documentUrl.trim() }),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(body.detail || `Google Docs import failed (${response.status})`)
    return body.draft
}

export async function setPilotStatus(pilot, status, persistence = 'local') {
    if (!['shadow', 'ready', 'active', 'completed'].includes(status)) throw new Error('Invalid pilot status')
    if (persistence === 'supabase') {
        const { data, error } = await supabase.from('faculty_pilots').update({ status }).eq('id', pilot.id).select().single()
        if (error) throw error
        return data
    }
    const state = readLocalState()
    const target = state.pilots.find((item) => item.id === pilot.id)
    if (!target) throw new Error('Pilot not found')
    target.status = status
    target.updated_at = new Date().toISOString()
    writeLocalState(state)
    return target
}

export async function saveEvidenceBrief(brief, persistence = 'local') {
    const record = { course_id: brief.course_id, period_start: brief.period_start, period_end: brief.period_end, status: 'draft', summary: brief }
    if (persistence === 'supabase') {
        const { data, error } = await supabase.from('instructor_evidence_briefs').upsert(record, { onConflict: 'course_id,period_start,period_end' }).select().single()
        if (error) throw error
        return data
    }
    const state = readLocalState()
    const previous = state.briefs.find((item) => item.course_id === brief.course_id && item.period_start === brief.period_start && item.period_end === brief.period_end)
    const localRecord = { ...record, id: previous?.id || localId('brief'), created_at: previous?.created_at || new Date().toISOString() }
    state.briefs = [localRecord, ...state.briefs.filter((item) => item.id !== previous?.id)]
    writeLocalState(state)
    return localRecord
}

export async function saveImpactReport(report, persistence = 'local') {
    const record = { course_id: report.course_id, pilot_id: report.pilot_id, status: 'draft', report }
    if (persistence === 'supabase') {
        const { data, error } = await supabase.from('course_impact_reports').insert(record).select().single()
        if (error) throw error
        return data
    }
    const state = readLocalState()
    const localRecord = { ...record, id: localId('report'), created_at: new Date().toISOString() }
    state.reports.unshift(localRecord)
    writeLocalState(state)
    return localRecord
}

export function impactReportToMarkdown(report) {
    const percent = report.outcomes.positive_rate == null ? 'Not yet available' : `${Math.round(report.outcomes.positive_rate * 100)}%`
    const gain = report.outcomes.mean_evaluation_gain == null ? 'Not yet available' : report.outcomes.mean_evaluation_gain.toFixed(2)
    return `# ${report.scope.title}\n\n## Pilot scope\n\n- Course: ${report.course_id}\n- Module: ${report.scope.module_name}\n- Status: ${report.scope.status}\n- Learning objectives: ${report.scope.learning_objectives.join('; ') || 'To be confirmed'}\n\n## Evidence summary\n\n- Closed interventions: ${report.outcomes.intervention_count}\n- Positive resolution rate: ${percent}\n- Mean evaluation gain: ${gain}\n- Concepts flagged in the latest brief: ${report.outcomes.concepts_flagged}\n- Learners flagged in the latest brief: ${report.outcomes.learners_flagged}\n\n## Interpretation\n\n${report.interpretation}\n\n## Governance\n\nThis export is de-identified, instructor-owned, and does not make a causal claim.\n`
}
