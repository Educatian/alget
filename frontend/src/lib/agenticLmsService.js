import { LLM_API_BASE } from './apiConfig'
import { isSupabaseConfigured, supabase } from './supabase'

const STORAGE_KEY = 'alget_agentic_lms_v1'

const FALLBACK_TOOLS = [
    { id: 'course.read', label: 'Read course content', risk: 'low', approval: 'none' },
    { id: 'mastery.read_own', label: 'Read own mastery evidence', risk: 'low', approval: 'none' },
    { id: 'study_plan.write_own', label: 'Draft or revise own study plan', risk: 'low', approval: 'learner' },
    { id: 'cohort.aggregate.read', label: 'Read cohort learning signals', risk: 'medium', approval: 'none' },
    { id: 'intervention.draft', label: 'Draft a cohort intervention', risk: 'medium', approval: 'instructor' },
    { id: 'learner.message', label: 'Send learner communication', risk: 'high', approval: 'instructor', executable: false },
    { id: 'grade.finalize', label: 'Finalize a grade', risk: 'high', approval: 'instructor', executable: false },
    { id: 'content.publish', label: 'Publish course content', risk: 'high', approval: 'course_admin', executable: false },
]

function emptyStore() {
    return { goals: [], workflows: [], studyPlans: [], interventions: [], events: [] }
}

function readStore() {
    try {
        return { ...emptyStore(), ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }
    } catch {
        return emptyStore()
    }
}

function writeStore(store) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
    return store
}

function localId(prefix) {
    return `${prefix}-${crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`
}

async function postAgentic(path, payload) {
    const response = await fetch(`${LLM_API_BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    })
    if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.detail || `Agentic request failed (${response.status})`)
    }
    return response.json()
}

function fallbackLearnerPlan(payload) {
    const target = Number(payload.target_mastery || 0.8)
    const mastery = (payload.mastery || [])
        .map((row) => ({
            concept_id: row.concept_id,
            mastery: Number(row.mastery_score ?? row.p_known ?? 0),
            attempts: Number(row.attempts_count || 0),
        }))
        .filter((row) => row.concept_id)
        .sort((left, right) => left.mastery - right.mastery)
    const focus = mastery.filter((row) => row.mastery < target)
    const concepts = focus.length ? focus : mastery.length ? mastery.slice(0, 3) : [{ concept_id: 'course-foundations', mastery: 0, attempts: 0 }]
    const count = Math.max(3, Math.min(7, Math.round(Number(payload.weekly_minutes || 180) / 35)))
    const minutes = Math.max(20, Math.min(50, Math.floor(Number(payload.weekly_minutes || 180) / count)))
    const start = new Date()
    start.setHours(12, 0, 0, 0)
    const sessions = Array.from({ length: count }, (_, index) => {
        const concept = concepts[index % concepts.length]
        const scheduled = new Date(start)
        scheduled.setDate(start.getDate() + index)
        return {
            id: `session-${index + 1}`,
            scheduled_for: scheduled.toISOString().slice(0, 10),
            minutes,
            concept_id: concept.concept_id,
            mode: ['explain', 'worked-example', 'retrieval-practice', 'teach-back'][index % 4],
            actions: ['Review one canonical example', 'Complete the learning activity', 'Record confidence before feedback', 'Finish with one retrieval question'],
            why_now: `Current mastery evidence is ${Math.round(concept.mastery * 100)}%, below the ${Math.round(target * 100)}% goal.`,
        }
    })
    return {
        schema_version: 'agentic-study-plan-v1',
        course_id: payload.course_id,
        goal: payload.goal_title,
        target_date: payload.target_date,
        target_mastery: target,
        weekly_minutes: Number(payload.weekly_minutes),
        generated_at: new Date().toISOString(),
        focus_concepts: concepts,
        sessions,
        evidence: { source: 'learner_mastery_snapshot', concept_count: mastery.length, weak_concept_count: focus.length, causal_claim: false },
        learner_control: { requires_approval: true, can_edit: true, can_pause: true, can_cancel: true, memory_scope: 'learner-owned' },
    }
}

function fallbackIntervention(payload) {
    const average = Number(payload.average_mastery)
    return {
        schema_version: 'agentic-intervention-v1',
        course_id: payload.course_id,
        concept_id: payload.concept_id,
        title: `Re-teach ${String(payload.concept_id).replace(/[_-]/g, ' ')}`,
        summary: `Prepare a short compare-and-correct activity for ${payload.learner_count} learner(s); do not send or grade automatically.`,
        recommended_actions: ['Open with one diagnostic contrast example', 'Ask learners to explain before feedback', 'Assign one low-stakes retrieval check', 'Review the next evidence snapshot'],
        evidence: { learner_count: payload.learner_count, average_mastery: average, threshold: 0.6, urgency: average < 0.4 ? 'urgent' : 'monitor', causal_claim: false },
        target_user_ids: payload.target_user_ids || [],
        risk_level: 'medium',
        delivery: { executed: false, requires_instructor_approval: true },
        generated_at: new Date().toISOString(),
    }
}

export async function loadAgentToolRegistry() {
    try {
        const response = await fetch(`${LLM_API_BASE}/agentic/tools`)
        if (!response.ok) throw new Error('Tool registry unavailable')
        const body = await response.json()
        return body.tools || FALLBACK_TOOLS
    } catch {
        return FALLBACK_TOOLS
    }
}

export async function loadLearnerPlans(userId) {
    if (isSupabaseConfigured && userId) {
        const { data, error } = await supabase
            .from('learner_study_plans')
            .select('*, learner_goals(*), agent_workflows(*)')
            .eq('user_id', userId)
            .order('updated_at', { ascending: false })
            .limit(10)
        if (!error) return data || []
    }
    const store = readStore()
    return store.studyPlans
        .filter((plan) => plan.user_id === userId)
        .sort((left, right) => Date.parse(right.updated_at) - Date.parse(left.updated_at))
}

export async function draftLearnerPlan({ userId, courseId, title, targetDate, targetMastery, weeklyMinutes, mastery }) {
    const request = {
        course_id: courseId,
        goal_title: title,
        target_date: targetDate,
        target_mastery: Number(targetMastery),
        weekly_minutes: Number(weeklyMinutes),
        mastery: mastery || [],
    }
    let plan
    try {
        plan = await postAgentic('/agentic/learner-plan', request)
    } catch {
        plan = fallbackLearnerPlan(request)
    }

    if (isSupabaseConfigured) {
        const { data, error } = await supabase.rpc('create_learner_plan_workflow', {
            p_course_id: courseId,
            p_title: title,
            p_target_date: targetDate,
            p_target_mastery: Number(targetMastery),
            p_weekly_minutes: Number(weeklyMinutes),
            p_plan: plan,
        })
        if (error) throw error
        return data.study_plan
    }

    const store = readStore()
    const now = new Date().toISOString()
    const goal = { id: localId('goal'), user_id: userId, course_id: courseId, title, target_date: targetDate, target_mastery: Number(targetMastery), weekly_minutes: Number(weeklyMinutes), status: 'active', created_at: now }
    const workflow = { id: localId('workflow'), owner_id: userId, course_id: courseId, workflow_type: 'learner_plan', status: 'awaiting_approval', risk_level: 'low', goal: title, plan, tool_scopes: ['course.read', 'mastery.read_own', 'study_plan.write_own'], created_at: now, updated_at: now }
    const studyPlan = { id: localId('plan'), goal_id: goal.id, workflow_id: workflow.id, user_id: userId, version: 1, status: 'awaiting_approval', plan, evidence: plan.evidence, learner_goals: goal, agent_workflows: workflow, created_at: now, updated_at: now }
    store.goals.unshift(goal)
    store.workflows.unshift(workflow)
    store.studyPlans.unshift(studyPlan)
    store.events.unshift({ id: localId('event'), workflow_id: workflow.id, actor_id: userId, event_type: 'plan_drafted', to_status: 'awaiting_approval', created_at: now })
    writeStore(store)
    return studyPlan
}

export async function reviewLearnerPlan(planId, decision, userId) {
    if (isSupabaseConfigured) {
        const { data, error } = await supabase.rpc('review_learner_plan', { p_plan_id: planId, p_decision: decision })
        if (error) throw error
        return data.study_plan
    }
    const store = readStore()
    const plan = store.studyPlans.find((item) => item.id === planId && item.user_id === userId)
    if (!plan || plan.status !== 'awaiting_approval') throw new Error('Study plan is no longer awaiting review')
    const workflow = store.workflows.find((item) => item.id === plan.workflow_id)
    const next = decision === 'approve' ? 'active' : 'cancelled'
    plan.status = next
    plan.approved_at = decision === 'approve' ? new Date().toISOString() : null
    plan.updated_at = new Date().toISOString()
    if (workflow) {
        workflow.status = next
        workflow.approval = { approved: decision === 'approve', actor_id: userId, reviewed_at: plan.updated_at }
        workflow.updated_at = plan.updated_at
        plan.agent_workflows = workflow
    }
    store.events.unshift({ id: localId('event'), workflow_id: plan.workflow_id, actor_id: userId, event_type: 'learner_plan_reviewed', from_status: 'awaiting_approval', to_status: next, created_at: plan.updated_at })
    writeStore(store)
    return plan
}

export async function loadInterventions() {
    if (isSupabaseConfigured) {
        const { data, error } = await supabase
            .from('instructor_intervention_queue')
            .select('*, agent_workflows(*)')
            .order('created_at', { ascending: false })
            .limit(30)
        if (!error) return data || []
    }
    return readStore().interventions.sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))
}

export async function draftIntervention({ userId, courseId, conceptId, learnerCount, averageMastery, targetUserIds = [] }) {
    const request = { course_id: courseId, concept_id: conceptId, learner_count: learnerCount, average_mastery: averageMastery, target_user_ids: targetUserIds }
    let proposal
    try {
        proposal = await postAgentic('/agentic/interventions/propose', request)
    } catch {
        proposal = fallbackIntervention(request)
    }
    if (isSupabaseConfigured) {
        const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        const { data, error } = await supabase.rpc('create_instructor_intervention_workflow', {
            p_course_id: courseId,
            p_concept_id: conceptId,
            p_title: proposal.title,
            p_proposal: proposal,
            p_target_user_ids: targetUserIds.filter((id) => uuidPattern.test(id)),
        })
        if (error) throw error
        return data.intervention
    }
    const store = readStore()
    const now = new Date().toISOString()
    const workflow = { id: localId('workflow'), owner_id: userId, course_id: courseId, workflow_type: 'instructor_intervention', status: 'awaiting_approval', risk_level: 'medium', goal: proposal.title, plan: proposal, tool_scopes: ['cohort.aggregate.read', 'intervention.draft'], created_at: now, updated_at: now }
    const intervention = { id: localId('intervention'), workflow_id: workflow.id, course_id: courseId, concept_id: conceptId, title: proposal.title, proposal, evidence: proposal.evidence, target_user_ids: targetUserIds, risk_level: 'medium', status: 'awaiting_approval', created_by: userId, agent_workflows: workflow, created_at: now, updated_at: now }
    store.workflows.unshift(workflow)
    store.interventions.unshift(intervention)
    store.events.unshift({ id: localId('event'), workflow_id: workflow.id, actor_id: userId, event_type: 'intervention_drafted', to_status: 'awaiting_approval', created_at: now })
    writeStore(store)
    return intervention
}

export async function reviewIntervention(interventionId, decision, note, userId) {
    if (isSupabaseConfigured) {
        const { data, error } = await supabase.rpc('review_instructor_intervention', { p_intervention_id: interventionId, p_decision: decision, p_note: note || null })
        if (error) throw error
        return data.intervention
    }
    const store = readStore()
    const item = store.interventions.find((entry) => entry.id === interventionId)
    if (!item || item.status !== 'awaiting_approval') throw new Error('Intervention is no longer awaiting review')
    item.status = decision === 'approve' ? 'approved' : 'rejected'
    item.reviewed_by = userId
    item.review_note = note || null
    item.reviewed_at = new Date().toISOString()
    item.updated_at = item.reviewed_at
    const workflow = store.workflows.find((entry) => entry.id === item.workflow_id)
    if (workflow) {
        workflow.status = decision === 'approve' ? 'active' : 'cancelled'
        workflow.approval = { approved: decision === 'approve', actor_id: userId, reviewed_at: item.reviewed_at, note }
        workflow.updated_at = item.reviewed_at
        item.agent_workflows = workflow
    }
    store.events.unshift({ id: localId('event'), workflow_id: item.workflow_id, actor_id: userId, event_type: 'intervention_reviewed', from_status: 'awaiting_approval', to_status: workflow?.status, detail: { decision, delivery_executed: false }, created_at: item.reviewed_at })
    writeStore(store)
    return item
}
