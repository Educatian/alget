import { LLM_API_BASE } from './apiConfig'
import { isSupabaseConfigured, supabase } from './supabase'

const STORAGE_KEY = 'alget_admin_control_v1'

export const DEFAULT_ADAPTATION_POLICY = {
    mastery_support_threshold: 0.58,
    friction_support_threshold: 0.35,
    calibration_support_threshold: 0.25,
    forgetting_risk_threshold: 0.55,
    cooldown_minutes: 8,
    max_interventions_per_session: 4,
    fade_mastery_threshold: 0.8,
    fade_stability_threshold: 0.7,
    show_why_now: true,
    require_human_approval: true,
}

export const AGENT_MANIFEST = [
    { id: 'extraction', name: 'Document Extraction', stage: 'Ingestion', approval: 'automatic' },
    { id: 'curriculum', name: 'Curriculum', stage: 'Structure', approval: 'required' },
    { id: 'alignment', name: 'Outcome Alignment', stage: 'Curriculum', approval: 'required' },
    { id: 'assessment', name: 'Assessment', stage: 'Assessment', approval: 'required' },
    { id: 'accessibility', name: 'Accessibility', stage: 'Quality', approval: 'automatic' },
    { id: 'validation', name: 'Validation', stage: 'Quality', approval: 'required' },
    { id: 'release', name: 'Release', stage: 'Release', approval: 'required', canPublish: true },
]

const EMPTY_STATE = {
    instructors: [],
    courses: [],
    ingestionJobs: [],
    agentRuns: [],
    workflows: [],
    auditEvents: [],
    adaptationPolicies: [],
    adaptationControls: {},
}

function readLocalState() {
    try {
        return { ...EMPTY_STATE, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }
    } catch {
        return { ...EMPTY_STATE }
    }
}

function writeLocalState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    return state
}

function localId(prefix) {
    return `${prefix}-${crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`
}

async function getAccessToken() {
    const { data } = await supabase.auth.getSession()
    return data?.session?.access_token || ''
}

async function getCurrentUserId() {
    const { data } = await supabase.auth.getUser()
    return data?.user?.id || null
}

async function loadRemoteState() {
    const tables = [
        ['instructors', 'instructor_profiles'],
        ['courses', 'managed_courses'],
        ['ingestionJobs', 'content_ingestion_jobs'],
        ['agentRuns', 'agent_control_runs'],
        ['workflows', 'agent_workflows'],
        ['auditEvents', 'admin_audit_events'],
    ]
    const responses = await Promise.all(tables.map(([, table]) => supabase.from(table).select('*').order('created_at', { ascending: false }).limit(100)))
    if (responses.some((response) => response.error)) {
        throw new Error(responses.find((response) => response.error)?.error?.message || 'Admin tables unavailable')
    }
    const state = Object.fromEntries(tables.map(([key], index) => [key, responses[index].data || []]))
    const token = await getAccessToken()
    const policyResponse = await fetch(`${LLM_API_BASE}/admin/adaptation/policies`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    const policyPayload = policyResponse.ok ? await policyResponse.json() : {}
    state.adaptationPolicies = policyPayload.policies || []
    state.adaptationControls = policyPayload.controls || {}
    return state
}

async function adaptationRequest(path, payload) {
    const token = await getAccessToken()
    const response = await fetch(`${LLM_API_BASE}${path}`, {
        method: payload ? 'POST' : 'GET',
        headers: {
            ...(payload ? { 'Content-Type': 'application/json' } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(payload ? { body: JSON.stringify(payload) } : {}),
    })
    if (!response.ok) {
        const detail = await response.json().catch(() => ({}))
        throw new Error(detail.detail || `Adaptation policy request failed (${response.status})`)
    }
    return response.json()
}

export async function saveAdaptationPolicy(course, payload, persistence = 'local') {
    if (persistence === 'supabase') {
        const result = await adaptationRequest('/admin/adaptation/policies', {
            course_id: course.course_key,
            name: payload.name,
            notes: payload.notes,
            policy: payload.policy,
        })
        await appendRemoteAudit('adaptation_policy.drafted', 'adaptation_policy', result.policy.id, { course_id: course.id, version: result.policy.version })
        return result.policy
    }
    const state = readLocalState()
    const coursePolicies = state.adaptationPolicies.filter((item) => item.course_id === course.course_key)
    const record = {
        id: localId('policy'), course_id: course.course_key,
        version: Math.max(0, ...coursePolicies.map((item) => Number(item.version) || 0)) + 1,
        name: payload.name.trim(), notes: payload.notes.trim(), policy: payload.policy,
        status: 'draft', created_at: new Date().toISOString(),
    }
    state.adaptationPolicies.unshift(record)
    state.auditEvents.unshift({ id: localId('audit'), action: 'adaptation_policy.drafted', entity_type: 'adaptation_policy', entity_id: record.id, created_at: record.created_at })
    writeLocalState(state)
    return record
}

export async function activateAdaptationPolicy(record, persistence = 'local') {
    if (persistence === 'supabase') {
        const result = await adaptationRequest(`/admin/adaptation/policies/${record.id}/activate`, { course_id: record.course_id })
        await appendRemoteAudit('adaptation_policy.activated', 'adaptation_policy', record.id, { course_id: record.course_id, version: record.version })
        return result.policy
    }
    const state = readLocalState()
    state.adaptationPolicies = state.adaptationPolicies.map((item) => item.course_id !== record.course_id ? item : item.id === record.id
        ? { ...item, status: 'active', activated_at: new Date().toISOString() }
        : item.status === 'active' ? { ...item, status: 'retired' } : item)
    state.auditEvents.unshift({ id: localId('audit'), action: 'adaptation_policy.activated', entity_type: 'adaptation_policy', entity_id: record.id, created_at: new Date().toISOString() })
    writeLocalState(state)
    return state.adaptationPolicies.find((item) => item.id === record.id)
}

export async function rollbackAdaptationPolicy(record, persistence = 'local') {
    if (persistence === 'supabase') {
        const result = await adaptationRequest(`/admin/adaptation/policies/${record.id}/rollback`, { course_id: record.course_id })
        await appendRemoteAudit('adaptation_policy.rollback_drafted', 'adaptation_policy', result.policy.id, { rollback_of: record.id, version: result.policy.version })
        return result.policy
    }
    return saveAdaptationPolicy({ course_key: record.course_id }, {
        name: `${record.name} rollback`, notes: `Rollback draft from v${record.version}`, policy: record.policy,
    }, 'local')
}

export async function setAdaptationEmergencyPause(course, paused, persistence = 'local') {
    const reason = paused ? 'Emergency pause by course administrator' : ''
    if (persistence === 'supabase') {
        const action = paused ? 'pause' : 'resume'
        const result = await adaptationRequest(`/admin/adaptation/courses/${course.course_key}/${action}`, { reason })
        await appendRemoteAudit(
            paused ? 'adaptation_policy.emergency_paused' : 'adaptation_policy.emergency_resumed',
            'adaptation_policy_control',
            course.course_key,
            { course_id: course.id, reason },
        )
        return result.control
    }

    const state = readLocalState()
    const control = {
        course_id: course.course_key,
        enabled: !paused,
        reason,
        updated_at: new Date().toISOString(),
        updated_by: 'local-operator',
    }
    state.adaptationControls = { ...(state.adaptationControls || {}), [course.course_key]: control }
    state.auditEvents.unshift({
        id: localId('audit'),
        action: paused ? 'adaptation_policy.emergency_paused' : 'adaptation_policy.emergency_resumed',
        entity_type: 'adaptation_policy_control',
        entity_id: course.course_key,
        created_at: control.updated_at,
    })
    writeLocalState(state)
    return control
}

export async function loadAdminState() {
    if (!isSupabaseConfigured) return { state: readLocalState(), persistence: 'local' }
    try {
        return { state: await loadRemoteState(), persistence: 'supabase' }
    } catch (error) {
        console.warn('[AdminControl] using local fallback:', error)
        return { state: readLocalState(), persistence: 'local' }
    }
}

async function appendRemoteAudit(action, entityType, entityId, detail = {}) {
    const { data } = await supabase.auth.getUser()
    return supabase.from('admin_audit_events').insert({
        actor_id: data?.user?.id,
        action,
        entity_type: entityType,
        entity_id: entityId,
        detail,
    })
}

export async function registerInstructor(payload, persistence = 'local') {
    if (persistence === 'supabase') {
        const accessToken = await getAccessToken()
        const inviteResponse = await fetch(`${LLM_API_BASE}/admin/instructors/invite`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
                email: payload.email.trim().toLowerCase(),
                display_name: payload.displayName.trim(),
                redirect_url: `${window.location.origin}/`,
            }),
        })
        if (!inviteResponse.ok) {
            const detail = await inviteResponse.json().catch(() => ({}))
            throw new Error(detail.detail || 'Instructor invitation failed')
        }
        const invitation = await inviteResponse.json()
        const operatorId = await getCurrentUserId()
        const { data, error } = await supabase.from('instructor_profiles').insert({
            user_id: invitation.id || null,
            display_name: payload.displayName.trim(),
            email: payload.email.trim().toLowerCase(),
            status: 'invited',
            invited_by: operatorId,
        }).select().single()
        if (error) throw error
        await appendRemoteAudit('instructor.invited', 'instructor', data.id, { email: data.email })
        return data
    }
    const state = readLocalState()
    const record = { id: localId('instructor'), display_name: payload.displayName.trim(), email: payload.email.trim().toLowerCase(), status: 'invited', created_at: new Date().toISOString() }
    state.instructors.unshift(record)
    state.auditEvents.unshift({ id: localId('audit'), action: 'instructor.invited', entity_type: 'instructor', entity_id: record.id, created_at: record.created_at })
    writeLocalState(state)
    return record
}

export async function reviewInstructorApplication(profile, decision, note = '', persistence = 'local') {
    if (persistence === 'supabase') {
        const accessToken = await getAccessToken()
        const response = await fetch(`${LLM_API_BASE}/admin/instructors/review`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
            body: JSON.stringify({ profile_id: profile.id, decision, note }),
        })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload.detail || 'Instructor review failed')
        return { ...profile, status: payload.status }
    }
    const state = readLocalState()
    const status = decision === 'approve' ? 'active' : 'rejected'
    state.instructors = state.instructors.map((item) => item.id === profile.id ? { ...item, status } : item)
    state.auditEvents.unshift({ id: localId('audit'), action: `instructor.${decision}d`, entity_type: 'instructor', entity_id: profile.id, created_at: new Date().toISOString() })
    writeLocalState(state)
    return state.instructors.find((item) => item.id === profile.id)
}

export async function createManagedCourse(payload, persistence = 'local') {
    const row = {
        course_key: payload.courseKey.trim().toLowerCase(),
        title: payload.title.trim(),
        domain: payload.domain.trim() || 'general',
        owner_instructor_id: payload.instructorId || null,
        status: 'draft',
    }
    if (persistence === 'supabase') {
        const { data, error } = await supabase.from('managed_courses').insert({ ...row, created_by: await getCurrentUserId() }).select().single()
        if (error) throw error
        await appendRemoteAudit('course.created', 'course', data.id, { course_key: data.course_key })
        return data
    }
    const state = readLocalState()
    const record = { ...row, id: localId('course'), created_at: new Date().toISOString() }
    state.courses.unshift(record)
    state.auditEvents.unshift({ id: localId('audit'), action: 'course.created', entity_type: 'course', entity_id: record.id, created_at: record.created_at })
    writeLocalState(state)
    return record
}

export async function convertCoursePdf(file, course, persistence = 'local') {
    const looksLikePdf = file && (file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf'))
    if (!looksLikePdf) throw new Error('Choose a PDF file')
    if (file.size > 25 * 1024 * 1024) throw new Error('PDF exceeds the 25MB limit')

    const form = new FormData()
    form.append('file', file)
    form.append('course_id', course.course_key)
    const token = await getAccessToken()
    const response = await fetch(`${LLM_API_BASE}/admin/pdf/convert`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
    })
    if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.detail || `PDF conversion failed (${response.status})`)
    }
    const result = await response.json()
    const row = {
        course_id: course.id,
        source_type: 'pdf',
        source_name: result.filename,
        source_sha256: result.sha256,
        page_count: result.page_count,
        status: result.status,
        quality_report: { ...(result.quality || {}), runtime_package: result.runtime_draft || null },
        warnings: result.warnings,
    }
    if (persistence === 'supabase') {
        const { data, error } = await supabase.from('content_ingestion_jobs').insert({ ...row, created_by: await getCurrentUserId() }).select().single()
        if (error) throw error
        await appendRemoteAudit('pdf.converted', 'ingestion_job', data.id, { course_id: course.id, pages: result.page_count })
        return { ...data, conversion: result }
    }
    const state = readLocalState()
    const record = { ...row, id: localId('ingestion'), created_at: new Date().toISOString() }
    state.ingestionJobs.unshift(record)
    state.auditEvents.unshift({ id: localId('audit'), action: 'pdf.converted', entity_type: 'ingestion_job', entity_id: record.id, created_at: record.created_at })
    writeLocalState(state)
    return { ...record, conversion: result }
}

export async function createGovernedAgentRun(course, source, persistence = 'local') {
    const token = await getAccessToken()
    const response = await fetch(`${LLM_API_BASE}/admin/course-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ course_id: course.course_key, source_id: source.id }),
    })
    if (!response.ok) throw new Error('Could not create the governed agent plan')
    const plan = await response.json()
    const row = { course_id: course.id, ingestion_job_id: source.id, status: 'awaiting_approval', current_stage: 'planned', plan }
    if (persistence === 'supabase') {
        const { data, error } = await supabase.from('agent_control_runs').insert({ ...row, created_by: await getCurrentUserId() }).select().single()
        if (error) throw error
        await appendRemoteAudit('agent_run.planned', 'agent_run', data.id, { course_id: course.id })
        return data
    }
    const state = readLocalState()
    const record = { ...row, id: localId('run'), created_at: new Date().toISOString() }
    state.agentRuns.unshift(record)
    state.auditEvents.unshift({ id: localId('audit'), action: 'agent_run.planned', entity_type: 'agent_run', entity_id: record.id, created_at: record.created_at })
    writeLocalState(state)
    return record
}

export async function approveAgentRun(run, persistence = 'local') {
    if (persistence === 'supabase') {
        const { data: auth } = await supabase.auth.getUser()
        const { data, error } = await supabase.from('agent_control_runs').update({
            status: 'approved',
            approved_by: auth?.user?.id,
            approval: { approved_at: new Date().toISOString(), release_still_requires_review: true },
        }).eq('id', run.id).select().single()
        if (error) throw error
        await appendRemoteAudit('agent_run.approved', 'agent_run', run.id)
        return data
    }
    const state = readLocalState()
    const target = state.agentRuns.find((item) => item.id === run.id)
    if (!target) throw new Error('Agent run not found')
    target.status = 'approved'
    target.approval = { approved_at: new Date().toISOString(), release_still_requires_review: true }
    state.auditEvents.unshift({ id: localId('audit'), action: 'agent_run.approved', entity_type: 'agent_run', entity_id: run.id, created_at: new Date().toISOString() })
    writeLocalState(state)
    return target
}
