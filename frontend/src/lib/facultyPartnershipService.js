import { isSupabaseConfigured, supabase } from './supabase'
import { LLM_API_BASE } from './apiConfig'
import { evaluatePilotReadiness } from './pilotReadiness'

const STORAGE_KEY = 'alget_faculty_partnership_v1'

function emptyState() {
    return { pilots: [], briefs: [], reports: [], published: [] }
}

function localFallbackAllowed() {
    return !isSupabaseConfigured || import.meta.env.VITE_E2E_AUTH_BYPASS === 'true'
}

function institutionalStorageError(error) {
    const detail = error?.message || 'Unknown storage error'
    return new Error(`Institutional storage is unavailable. Nothing was saved locally. ${detail}`)
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
        const [pilots, briefs, reports, published] = await Promise.all([
            supabase.from('faculty_pilots').select('*').eq('course_id', courseId).order('updated_at', { ascending: false }).limit(20),
            supabase.from('instructor_evidence_briefs').select('*').eq('course_id', courseId).order('period_end', { ascending: false }).limit(20),
            supabase.from('course_impact_reports').select('*').eq('course_id', courseId).order('created_at', { ascending: false }).limit(20),
            supabase.from('published_course_modules').select('*').eq('course_id', courseId).order('published_at', { ascending: false }).limit(20),
        ])
        const error = pilots.error || briefs.error || reports.error || published.error
        if (error) {
            if (!localFallbackAllowed()) throw institutionalStorageError(error)
        } else {
            return { pilots: pilots.data || [], briefs: briefs.data || [], reports: reports.data || [], published: published.data || [], persistence: 'supabase' }
        }
    }
    if (!localFallbackAllowed()) throw institutionalStorageError()
    const state = readLocalState()
    return {
        pilots: state.pilots.filter((item) => item.course_id === courseId),
        briefs: state.briefs.filter((item) => item.course_id === courseId),
        reports: state.reports.filter((item) => item.course_id === courseId),
        published: state.published.filter((item) => item.course_id === courseId && item.status === 'published'),
        persistence: 'local',
    }
}

export async function loadPilotEventExport(courseId) {
    if (!isSupabaseConfigured) return []
    const { data, error } = await supabase
        .from('research_pilot_event_export')
        .select('id, actor_hash, session_id, course_id, section_id, event_type, event_ts, client_seq, payload')
        .eq('course_id', courseId)
        .order('event_ts', { ascending: true })
        .limit(5000)
    if (error) throw institutionalStorageError(error)
    return data || []
}

export function pilotEventsToCsv(events = []) {
    const columns = ['id', 'actor_hash', 'session_id', 'course_id', 'section_id', 'event_type', 'event_ts', 'client_seq', 'payload']
    const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`
    return [columns.join(','), ...events.map((event) => columns.map((column) => escape(column === 'payload' ? JSON.stringify(event[column] || {}) : event[column])).join(','))].join('\n')
}

export function clearFacultyPartnershipCache() {
    try {
        localStorage.removeItem(STORAGE_KEY)
    } catch {
        // Storage may be unavailable in hardened browser contexts.
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
            automatic_publish: false,
            automatic_messaging: false,
            automatic_grading: false,
            instructor_approval_required: true,
            quality_warnings_acknowledged: payload.generationDraft?.quality?.warnings_acknowledged === true,
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

export async function importPdfCourseDraft({ courseId, file }) {
    const looksLikePdf = file && (file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf'))
    if (!looksLikePdf) throw new Error('Choose a PDF file')
    const { data } = await supabase.auth.getSession()
    const token = data?.session?.access_token || ''
    const form = new FormData()
    form.append('file', file)
    form.append('course_id', courseId)
    const response = await fetch(`${LLM_API_BASE}/faculty/pdf/import`, {
        method: 'POST',
        // FormData supplies its own multipart boundary; setting Content-Type breaks it.
        headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: form,
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(body.detail || `PDF import failed (${response.status})`)
    return body.draft
}

export async function loadAssignedIngestionSources(courseId) {
    if (!isSupabaseConfigured) {
        const { loadAdminState } = await import('./adminControlService')
        const { state } = await loadAdminState()
        const course = (state.courses || []).find((item) => item.course_key === courseId)
        return (state.ingestionJobs || []).filter((job) => job.course_id === course?.id && job.quality_report?.runtime_package?.sections?.length)
    }

    const { data: course, error: courseError } = await supabase
        .from('managed_courses')
        .select('id')
        .eq('course_key', courseId)
        .maybeSingle()
    if (courseError) throw courseError
    if (!course?.id) return []

    const { data, error } = await supabase
        .from('content_ingestion_jobs')
        .select('*')
        .eq('course_id', course.id)
        .order('created_at', { ascending: false })
        .limit(20)
    if (error) throw error
    return (data || []).filter((job) => job.quality_report?.runtime_package?.sections?.length)
}

export async function inviteLearnerToCourse({ courseId, email, displayName, cohortId = '', cohortLabel = '' }) {
    const { data } = await supabase.auth.getSession()
    const token = data?.session?.access_token || ''
    const response = await fetch(`${LLM_API_BASE}/faculty/learners/invite`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
            course_id: courseId,
            email: email.trim().toLowerCase(),
            display_name: displayName.trim(),
            cohort_id: cohortId.trim() || `${courseId}-instructor`,
            cohort_label: cohortLabel.trim() || 'Instructor roster',
            redirect_url: `${window.location.origin}/`,
        }),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(body.detail || `Learner invitation failed (${response.status})`)
    return body
}

export async function setPilotStatus(pilot, status, persistence = 'local') {
    if (!['shadow', 'ready', 'active', 'completed'].includes(status)) throw new Error('Invalid pilot status')
    if (['ready', 'active'].includes(status)) assertPilotReady(pilot)
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

export async function acknowledgePilotWarnings(pilot, generationDraft, persistence = 'local') {
    if (!pilot?.id || !generationDraft) throw new Error('A saved pilot draft is required before acknowledging review notes.')
    const nextDraft = {
        ...generationDraft,
        quality: { ...(generationDraft.quality || {}), warnings_acknowledged: true },
    }
    const nextSettings = { ...(pilot.settings || {}), quality_warnings_acknowledged: true }
    if (persistence === 'supabase') {
        const { data, error } = await supabase
            .from('faculty_pilots')
            .update({ generation_draft: nextDraft, settings: nextSettings })
            .eq('id', pilot.id)
            .select()
            .single()
        if (error) throw error
        return data
    }
    const state = readLocalState()
    const target = state.pilots.find((item) => item.id === pilot.id)
    if (!target) throw new Error('Pilot not found')
    target.generation_draft = nextDraft
    target.settings = nextSettings
    target.updated_at = new Date().toISOString()
    writeLocalState(state)
    return target
}

export async function saveEvidenceBrief(brief, persistence = 'local') {
    const record = { course_id: brief.course_id, period_start: brief.period_start, period_end: brief.period_end, status: 'draft', summary: brief }
    if (persistence === 'supabase') {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
        if (sessionError || !sessionData?.session?.user?.id) throw institutionalStorageError(sessionError || new Error('Instructor session is missing.'))
        record.created_by = sessionData.session.user.id
        const { data, error } = await supabase.from('instructor_evidence_briefs').upsert(record, { onConflict: 'course_id,created_by,period_start,period_end' }).select().single()
        if (error) throw error
        return data
    }
    const state = readLocalState()
    // Local/demo persistence keeps only cohort aggregates. Learner identifiers
    // and display names never enter browser storage.
    record.summary = {
        ...brief,
        attention: {
            ...brief.attention,
            learners: [],
        },
    }
    const previous = state.briefs.find((item) => item.course_id === brief.course_id && item.period_start === brief.period_start && item.period_end === brief.period_end)
    const localRecord = { ...record, id: previous?.id || localId('brief'), created_at: previous?.created_at || new Date().toISOString() }
    state.briefs = [localRecord, ...state.briefs.filter((item) => item.id !== previous?.id)]
    writeLocalState(state)
    return localRecord
}

export async function publishFacultyPilot(pilot, persistence = 'local') {
    assertPilotReady(pilot)
    const sections = pilot?.generation_draft?.sections
    if (!pilot?.id || !pilot?.course_id || !Array.isArray(sections) || sections.length === 0) {
        throw new Error('Review and save at least one generated section before publishing.')
    }
    const record = {
        course_id: pilot.course_id,
        pilot_id: pilot.id,
        title: pilot.title,
        module_name: pilot.module_name,
        generation_draft: pilot.generation_draft,
        status: 'published',
        published_at: new Date().toISOString(),
    }
    if (persistence === 'supabase') {
        const { data: published, error } = await supabase.from('published_course_modules').upsert(record, { onConflict: 'pilot_id' }).select().single()
        if (error) throw error
        const updatedPilot = await setPilotStatus(pilot, 'active', persistence)
        return { published, pilot: updatedPilot }
    }
    const state = readLocalState()
    const previous = state.published.find((item) => item.pilot_id === pilot.id)
    const published = { ...record, id: previous?.id || localId('published'), updated_at: new Date().toISOString() }
    state.published = [published, ...state.published.filter((item) => item.pilot_id !== pilot.id)]
    const target = state.pilots.find((item) => item.id === pilot.id)
    if (!target) throw new Error('Pilot not found')
    target.status = 'active'
    target.updated_at = new Date().toISOString()
    writeLocalState(state)
    return { published, pilot: target }
}

function assertPilotReady(pilot) {
    const readiness = evaluatePilotReadiness(pilot)
    if (readiness.ready) return
    const missing = readiness.checks.filter((check) => !check.ok).map((check) => check.label).join('; ')
    throw new Error(`Pilot is not release-ready. Resolve: ${missing}`)
}

export async function listPublishedCourseModules(courseId) {
    if (isSupabaseConfigured) {
        const { data, error } = await supabase
            .from('published_course_modules')
            .select('id, course_id, title, module_name, generation_draft, published_at')
            .eq('course_id', courseId)
            .eq('status', 'published')
            .order('published_at', { ascending: true })
        if (error) throw institutionalStorageError(error)
        return data || []
    }
    return readLocalState().published.filter((item) => item.course_id === courseId && item.status === 'published')
}

export function publishedSectionRoute(moduleId, sectionIndex) {
    return `${moduleId}-${sectionIndex + 1}`
}

export function mergePublishedModulesIntoToc(toc, modules = []) {
    const sections = modules.flatMap((module) => (module.generation_draft?.sections || []).map((entry, index) => ({
        id: publishedSectionRoute(module.id, index),
        title: entry.title || `${module.module_name} ${index + 1}`,
    })))
    if (sections.length === 0) return toc
    const chapters = (toc?.chapters || []).filter((item) => item.id !== 'published')
    return { ...toc, chapters: [...chapters, { id: 'published', title: 'Instructor-published modules', sections }] }
}

/**
 * Render retrieved open-textbook citations under a generated section.
 *
 * The licence of each cited passage is shown with it: OpenStax books are not
 * uniformly licensed, and a reader following the link should know what they may
 * reuse. Only the citation travels here, never the passage's full text.
 */
function appendOpenStaxReferences(body, references) {
    if (!Array.isArray(references) || references.length === 0) return body
    const lines = references.slice(0, 6).map((reference) => {
        const book = reference.book ? ` — ${reference.book}` : ''
        const licence = reference.license_url ? ` ([licence](${reference.license_url}))` : ''
        return `- [${reference.title}](${reference.url})${book}${licence}`
    })
    return `${body}\n\n## Related open textbook reading\n\n${lines.join('\n')}\n`
}

export async function loadPublishedCourseSection(courseId, routeSectionId) {
    const match = String(routeSectionId).match(/^([0-9a-f-]{36}|published-[^-]+(?:-[^-]+)*)-(\d+)$/i)
    if (!match) throw new Error('Published section address is invalid.')
    const moduleId = match[1]
    const sectionIndex = Number(match[2]) - 1
    const modules = await listPublishedCourseModules(courseId)
    const module = modules.find((item) => item.id === moduleId)
    const generated = module?.generation_draft?.sections?.[sectionIndex]
    if (!module || !generated) throw new Error('Published section is unavailable for this course.')
    const objectives = generated.learning_objectives || module.generation_draft?.learning_objectives || []
    const reading = generated.reading || {}
    const body = reading.content || reading.markdown || generated.source_excerpt || ''
    const content = appendOpenStaxReferences(body, generated.references || module.generation_draft?.references)
    return {
        meta: {
            course: courseId,
            chapter: 'published',
            section: routeSectionId,
            title: generated.title || module.module_name,
            description: generated.description || `Instructor-published module: ${module.module_name}`,
            learning_objectives: objectives,
            references: generated.references || module.generation_draft?.references || [],
            source_status: generated.source_status || module.generation_draft?.source_status || (generated.references?.length ? 'context_attached' : ''),
            source_title: module.generation_draft?.source?.title || module.title || null,
            concept_ids: generated.concept_ids || [],
            estimated_time_minutes: reading.estimated_minutes || 8,
        },
        title: generated.title || module.module_name,
        content,
        raw: content,
        activity: generated.activity || null,
        simulation: generated.simulation || null,
        tutor: generated.tutor || module.generation_draft?.tutor || null,
        analytics: generated.analytics || module.generation_draft?.analytics || null,
        social_dynamics: generated.social_dynamics || module.generation_draft?.social_dynamics || null,
        runtime_package: module.generation_draft?.runtime_package || null,
        practice: generated.practice || module.generation_draft?.practice || null,
        knowledge_base: generated.knowledge_base || module.generation_draft?.knowledge_base || null,
        content_version: module.published_at || module.updated_at || null,
    }
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
