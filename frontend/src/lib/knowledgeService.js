import { LLM_API_BASE } from './apiConfig';
import { supabase } from './supabase';
import { buildLearnerProfileSnapshot, startInterventionTrace } from './researchService';

const ADAPTIVE_SIGNAL_KEY = 'alget_adaptive_signals_v1';
const LOCAL_MASTERY_KEY = 'alget_local_mastery_v1';
const ADAPTIVE_SIGNAL_WINDOW_MS = 1000 * 60 * 90;
const MAX_ADAPTIVE_SIGNALS = 250;

// Local mastery priors + adaptive signals are unscoped caches; clear them on
// identity change so a different user on the same browser can't inherit the
// previous user's mastery/signals (they rebuild from the cloud on next use).
export function clearLocalLearnerCaches() {
    try {
        if (typeof window === 'undefined') return;
        window.localStorage.removeItem(LOCAL_MASTERY_KEY);
        window.sessionStorage.removeItem(ADAPTIVE_SIGNAL_KEY);
    } catch {
        // ignore storage errors
    }
}

const emptyTelemetrySummary = () => ({
    hint_requests: 0,
    stuck_events: 0,
    consecutive_wrong: 0,
    idle_events: 0,
    practice_attempts: 0,
    correct_attempts: 0,
    chat_turns: 0,
    affect_confused: 0,
    affect_insight: 0,
    affect_engaged: 0,
    affect_disengaged: 0,
    representation_requests: 0,
    explain_requests: 0,
    confidence_samples: 0,
    confidence_total: 0,
    confidence_average: 0,
    misconception_counts: {},
    intervention_accepts: 0,
    intervention_declines: 0,
    annotation_questions: 0,
    annotation_confusions: 0,
    annotation_insights: 0,
    annotation_connections: 0,
    annotation_helpful_reactions: 0,
    artifact_trace_count: 0,
    artifact_quality_total: 0,
    artifact_quality_average: 0,
    artifact_trace_completeness_total: 0,
    artifact_trace_completeness: 0
});

function readAdaptiveSignals() {
    if (typeof window === 'undefined') return [];

    try {
        const raw = window.sessionStorage.getItem(ADAPTIVE_SIGNAL_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.warn('Could not read adaptive signals:', error);
        return [];
    }
}

function writeAdaptiveSignals(signals) {
    if (typeof window === 'undefined') return;

    try {
        window.sessionStorage.setItem(ADAPTIVE_SIGNAL_KEY, JSON.stringify(signals.slice(-MAX_ADAPTIVE_SIGNALS)));
    } catch (error) {
        console.warn('Could not persist adaptive signals:', error);
    }
}

function readLocalMasteryRecords() {
    if (typeof window === 'undefined') return {};

    try {
        const raw = window.localStorage.getItem(LOCAL_MASTERY_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (error) {
        console.warn('Could not read local mastery:', error);
        return {};
    }
}

function writeLocalMasteryRecords(records) {
    if (typeof window === 'undefined') return;

    try {
        window.localStorage.setItem(LOCAL_MASTERY_KEY, JSON.stringify(records));
    } catch (error) {
        console.warn('Could not persist local mastery:', error);
    }
}

export function getLocalMasteryMap(conceptIds = null) {
    const records = readLocalMasteryRecords();
    const allowed = Array.isArray(conceptIds) && conceptIds.length > 0 ? new Set(conceptIds) : null;

    return Object.fromEntries(
        Object.entries(records)
            .filter(([conceptId]) => !allowed || allowed.has(conceptId))
            .map(([conceptId, record]) => [
                conceptId,
                Number(record?.p_known ?? record?.mastery_score ?? 0.1)
            ])
    );
}

export function persistLocalMasteryStates(conceptUpdates, options = {}) {
    const updates = Object.entries(conceptUpdates || {})
        .filter(([conceptId, pKnown]) => conceptId && Number.isFinite(Number(pKnown)));

    if (updates.length === 0) return {};

    const now = new Date().toISOString();
    const records = readLocalMasteryRecords();

    updates.forEach(([conceptId, pKnown]) => {
        const previous = records[conceptId] || {};
        const normalizedPKnown = Math.max(0, Math.min(1, Number(pKnown)));
        records[conceptId] = {
            ...previous,
            concept_id: conceptId,
            p_known: normalizedPKnown,
            mastery_score: normalizedPKnown,
            course_id: options.courseId || previous.course_id || options.sectionId?.split('/')?.[0] || null,
            section_id: options.sectionId || previous.section_id || null,
            source: options.source || previous.source || 'mastery_update',
            updated_at: now
        };
    });

    writeLocalMasteryRecords(records);
    return getLocalMasteryMap(updates.map(([conceptId]) => conceptId));
}

export async function recordCalibrationMastery(conceptUpdates, options = {}) {
    persistLocalMasteryStates(conceptUpdates, {
        ...options,
        source: options.source || 'diagnostic_calibration'
    });

    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) return conceptUpdates;

        const recordsToUpsert = Object.entries(conceptUpdates || {}).map(([conceptId, p_known]) => ({
            user_id: session.user.id,
            concept_id: conceptId,
            p_known,
            mastery_score: p_known,
            updated_at: new Date().toISOString()
        }));

        if (recordsToUpsert.length === 0) return conceptUpdates;

        const { error } = await supabase
            .from('mastery')
            .upsert(recordsToUpsert, { onConflict: 'user_id,concept_id' });

        if (error) {
            console.warn('[Mastery] Diagnostic Supabase update failed; local mastery was kept:', error);
        }
    } catch (error) {
        console.warn('[Mastery] Diagnostic calibration saved locally only:', error);
    }

    return conceptUpdates;
}

export function recordAdaptiveSignal(sectionId, type, payload = {}) {
    if (!sectionId || !type) return;

    const nextSignals = [
        ...readAdaptiveSignals(),
        {
            sectionId,
            type,
            payload,
            timestamp: new Date().toISOString()
        }
    ];

    writeAdaptiveSignals(nextSignals);
}

export function summarizeAdaptiveSignals(sectionId) {
    const summary = emptyTelemetrySummary();
    const cutoff = Date.now() - ADAPTIVE_SIGNAL_WINDOW_MS;
    const signals = readAdaptiveSignals()
        .filter((signal) => signal?.sectionId === sectionId)
        .filter((signal) => {
            const signalTime = Date.parse(signal?.timestamp || '');
            return Number.isFinite(signalTime) && signalTime >= cutoff;
        })
        .sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp));

    let trailingWrong = 0;

    signals.forEach((signal) => {
        switch (signal.type) {
            case 'hint_request':
                summary.hint_requests += 1;
                break;
            case 'stuck_event':
                summary.stuck_events += 1;
                if ((signal.payload?.reason || '').toLowerCase().includes('idle')) {
                    summary.idle_events += 1;
                }
                break;
            case 'practice_correct':
            case 'inline_quiz_correct':
                summary.practice_attempts += 1;
                summary.correct_attempts += 1;
                trailingWrong = 0;
                break;
            case 'practice_incorrect':
            case 'inline_quiz_incorrect':
                summary.practice_attempts += 1;
                trailingWrong += 1;
                break;
            case 'affect_confused':
                summary.affect_confused += 1;
                break;
            case 'affect_insight':
                summary.affect_insight += 1;
                break;
            case 'affect_engaged':
                summary.affect_engaged += 1;
                break;
            case 'affect_disengaged':
                summary.affect_disengaged += 1;
                break;
            case 'chat_engagement':
                summary.chat_turns += 1;
                break;
            case 'representation_request':
                summary.representation_requests += 1;
                break;
            case 'explanation_request':
                summary.explain_requests += 1;
                break;
            case 'confidence_report':
                summary.confidence_samples += 1;
                summary.confidence_total += Number(signal.payload?.value || 0);
                break;
            case 'misconception_report': {
                const type = String(signal.payload?.type || 'unknown');
                summary.misconception_counts[type] = (summary.misconception_counts[type] || 0) + 1;
                break;
            }
            case 'intervention_accept':
                summary.intervention_accepts += 1;
                break;
            case 'intervention_decline':
                summary.intervention_declines += 1;
                break;
            case 'annotation_create':
                if (signal.payload?.annotationType === 'question') {
                    summary.annotation_questions += 1;
                } else if (signal.payload?.annotationType === 'confusion') {
                    summary.annotation_confusions += 1;
                } else if (signal.payload?.annotationType === 'insight') {
                    summary.annotation_insights += 1;
                } else if (signal.payload?.annotationType === 'connection') {
                    summary.annotation_connections += 1;
                }
                break;
            case 'annotation_reaction':
                if (signal.payload?.reactionType === 'helpful') {
                    summary.annotation_helpful_reactions += 1;
                }
                break;
            case 'artifact_studio_trace':
                summary.artifact_trace_count += 1;
                summary.artifact_quality_total += Number(signal.payload?.artifactQualityScore || 0);
                summary.artifact_trace_completeness_total += Number(signal.payload?.traceCompleteness || 0);
                break;
            default:
                break;
        }
    });

    summary.consecutive_wrong = trailingWrong;
    summary.confidence_average = summary.confidence_samples
        ? Number((summary.confidence_total / summary.confidence_samples).toFixed(3))
        : 0;
    summary.artifact_quality_average = summary.artifact_trace_count
        ? Number((summary.artifact_quality_total / summary.artifact_trace_count).toFixed(3))
        : 0;
    summary.artifact_trace_completeness = summary.artifact_trace_count
        ? Number((summary.artifact_trace_completeness_total / summary.artifact_trace_count).toFixed(3))
        : 0;
    return summary;
}

/**
 * Generates a formative assessment based on current context.
 */
export const generateAssessment = async (sectionTitle, bioContext, engContext, learningObjectives, conceptIds, options = {}) => {
    try {
        const apiKey = localStorage.getItem('gemini_api_key') || '';
        const response = await fetch(`${LLM_API_BASE}/generate_assessment`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                section_title: sectionTitle,
                biology_context: bioContext,
                engineering_context: engContext,
                learning_objectives: learningObjectives,
                concept_ids: conceptIds,
                section_id: options.sectionId || '',
                content_version: options.contentVersion || null,
                retrieved_context: Array.isArray(options.retrievedContext) ? options.retrievedContext.slice(0, 5) : [],
                api_key: apiKey
            })
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        return data.assessment ? { ...data.assessment, generation_trace: data.generation_trace || null } : null;
    } catch (error) {
        console.error('Error generating assessment:', error);
        return [];
    }
};

/**
 * Grades a short-answer or summary response using the LLM rubric.
 */
export const gradeSummary = async (question, studentAnswer, rubric, options = {}) => {
    try {
        const apiKey = localStorage.getItem('gemini_api_key') || '';
        const response = await fetch(`${LLM_API_BASE}/grade_summary`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                question: question,
                student_answer: studentAnswer,
                rubric: rubric,
                section_id: options.sectionId || '',
                section_title: options.sectionTitle || '',
                api_key: apiKey
            })
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        return data; // Returns { content_score, wording_score, feedback, is_passing }
    } catch (error) {
        console.error('Error grading summary:', error);
        throw error;
    }
};

/**
 * Updates the user's mastery score in Supabase for a set of concepts using the BKT Engine on the backend.
 * Expects a q_matrix like {"concept1": 1.0, "concept2": 0.5}
 */
export const updateMastery = async (qMatrix, isCorrect, options = {}) => {
    try {
        const { hintUsed = false, sectionId = null, courseId = null } = options
        const { data: { session } } = await supabase.auth.getSession();
        let userId = session?.user?.id;

        // 1. Fetch current states for all concepts in the Q-Matrix
        const conceptIds = Object.keys(qMatrix);
        const localMastery = getLocalMasteryMap(conceptIds);
        let existingRecords = [];

        if (userId) {
            const { data, error: fetchError } = await supabase
                .from('mastery')
                .select('*')
                .eq('user_id', userId)
                .in('concept_id', conceptIds);

            if (fetchError) {
                console.warn('[Mastery] Supabase fetch failed; using local mastery:', fetchError);
            } else {
                existingRecords = data || [];
            }
        }

        // Build current state dictionary
        let currentStates = {};
        conceptIds.forEach(cid => {
            const record = existingRecords?.find(r => r.concept_id === cid);
            currentStates[cid] = record ? record.p_known : (localMastery[cid] ?? 0.1); // Default prior
        });

        // Hint penalty: damp the Q-matrix weights so a hint-assisted correct
        // answer updates p_known by less than an unaided correct answer.
        // Empirically picking 0.6 as the damping factor (Carnegie Learning's
        // hint-aware BKT typically uses 0.5-0.7).
        const adjustedQMatrix = hintUsed
            ? Object.fromEntries(Object.entries(qMatrix).map(([cid, w]) => [cid, Number(w) * 0.6]))
            : qMatrix

        // 2. Call Python backend BKT engine
        const response = await fetch(`${LLM_API_BASE}/grade`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                current_states: currentStates,
                q_matrix: adjustedQMatrix,
                is_correct: isCorrect
            })
        });

        if (!response.ok) throw new Error('BKT grading failed');
        const { new_states } = await response.json();
        persistLocalMasteryStates(new_states, {
            sectionId,
            courseId,
            source: 'bkt_update'
        });

        if (!userId) {
            return new_states;
        }

        // 3. Upsert the new values back to Supabase
        const upsertData = Object.entries(new_states).map(([cid, newPKnown]) => {
            const record = existingRecords?.find(r => r.concept_id === cid);
            let attempts = (record ? record.attempts_count : 0) + 1;
            let correctCount = (record ? record.correct_count : 0) + (isCorrect ? 1 : 0);

            // Map p_known to a legacy confidence level or mastery score
            let confidence = 'low';
            if (newPKnown > 0.8 && attempts > 2) confidence = 'high';
            else if (newPKnown > 0.5) confidence = 'medium';

            return {
                user_id: userId,
                concept_id: cid,
                p_known: newPKnown,
                mastery_score: newPKnown, // using p_known as mastery score proxy
                attempts_count: attempts,
                correct_count: correctCount,
                confidence_level: confidence,
                updated_at: new Date().toISOString(),
                last_practiced_at: new Date().toISOString()
            };
        });

        const { error: upsertError } = await supabase
            .from('mastery')
            .upsert(upsertData, { onConflict: 'user_id,concept_id' });

        if (upsertError) {
            console.warn('[Mastery] Supabase upsert failed; local mastery was kept:', upsertError);
            return new_states;
        }

        // Mirror the authoritative BKT mastery into the research table so the
        // research dashboard and adaptive engine see the same value as the
        // legacy mastery table. Only touches mastery_prob + updated_at; other
        // rich fields populated by researchService.updateLearnerModel are
        // preserved by Supabase upsert merge semantics.
        const researchUpsert = Object.entries(new_states).map(([cid, newPKnown]) => ({
            user_id: userId,
            concept_id: cid,
            mastery_prob: newPKnown,
            updated_at: new Date().toISOString(),
        }));

        const { error: researchUpsertError } = await supabase
            .from('learner_concept_state')
            .upsert(researchUpsert, { onConflict: 'user_id,concept_id' });

        if (researchUpsertError) {
            console.warn('[Mastery] BKT mirror to learner_concept_state failed:', researchUpsertError);
        }

        return new_states;

    } catch (error) {
        console.error('Error updating mastery with BKT:', error);
        const fallbackStates = Object.fromEntries(
            Object.keys(qMatrix || {}).map((conceptId) => {
                const current = getLocalMasteryMap([conceptId])[conceptId] ?? 0.1;
                const delta = isCorrect ? 0.18 : -0.12;
                return [conceptId, Math.max(0.05, Math.min(0.95, current + delta))];
            })
        );
        persistLocalMasteryStates(fallbackStates, {
            sectionId: options.sectionId,
            courseId: options.courseId,
            source: 'bkt_fallback'
        });
        return Object.keys(fallbackStates).length > 0 ? fallbackStates : null;
    }
};

/**
 * Adjust BKT priors based on interaction telemetry (Soft Evidence)
 */
export const fuseTelemetry = async (conceptId, interactionType, intensity = 1.0) => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        let userId = session?.user?.id;
        if (!userId) return null;

        const { data: records } = await supabase
            .from('mastery')
            .select('*')
            .eq('user_id', userId)
            .eq('concept_id', conceptId)
            .single();

        let currentSlip = records?.p_slip ?? 0.1;
        let currentTransit = records?.p_transit ?? 0.1;

        const response = await fetch(`${LLM_API_BASE}/telemetry_fusion`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                current_p_slip: currentSlip,
                current_p_transit: currentTransit,
                interaction_type: interactionType,
                intensity: intensity
            })
        });

        if (!response.ok) throw new Error('Telemetry fusion failed');
        const { new_p_slip, new_p_transit } = await response.json();

        await supabase.from('mastery').upsert({
            user_id: userId,
            concept_id: conceptId,
            p_slip: new_p_slip,
            p_transit: new_p_transit,
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,concept_id' });

        return { new_p_slip, new_p_transit };

    } catch (error) {
        console.error('Error fusing telemetry:', error);
        return null;
    }
};

// --- Adaptive recommendation backoff -------------------------------------
// The adaptive endpoint is called from reader-side effects (IntelRail,
// ArtifactStudio), so when the worker is down (503) the old behavior was a
// tight retry loop that spammed the console on every render/interaction.
// Failures now open an exponential backoff window (1s -> 4s -> 15s); after
// the ladder is exhausted the circuit opens for the rest of the session with
// a single console.info. A later success closes everything again.
const ADAPTIVE_BACKOFF_STEPS_MS = [1000, 4000, 15000];
const adaptiveBackoffState = {
    failureCount: 0,
    notBefore: 0,
    circuitOpen: false,
    circuitAnnounced: false,
};

function adaptiveBackoffAllows(now = Date.now()) {
    if (adaptiveBackoffState.circuitOpen) return false;
    return now >= adaptiveBackoffState.notBefore;
}

function noteAdaptiveSuccess() {
    adaptiveBackoffState.failureCount = 0;
    adaptiveBackoffState.notBefore = 0;
    adaptiveBackoffState.circuitOpen = false;
    adaptiveBackoffState.circuitAnnounced = false;
}

function noteAdaptiveFailure(now = Date.now()) {
    adaptiveBackoffState.failureCount += 1;
    const stepIndex = adaptiveBackoffState.failureCount - 1;
    if (stepIndex >= ADAPTIVE_BACKOFF_STEPS_MS.length) {
        adaptiveBackoffState.circuitOpen = true;
        if (!adaptiveBackoffState.circuitAnnounced) {
            adaptiveBackoffState.circuitAnnounced = true;
            console.info('[knowledgeService] Adaptive recommendations are unavailable; pausing further attempts for this session.');
        }
        return;
    }
    adaptiveBackoffState.notBefore = now + ADAPTIVE_BACKOFF_STEPS_MS[stepIndex];
}

/** Test hook: reset the module-level adaptive backoff state. */
export function _resetAdaptiveBackoffForTests() {
    noteAdaptiveSuccess();
}

export const getAdaptiveRecommendation = async ({
    sectionId,
    sectionTitle = '',
    conceptIds = [],
    currentHeading = '',
    stuckReason = null,
    context = {}
}) => {
    // Backoff / circuit guard: skip the network entirely (and stay silent —
    // no console spam) while a previous failure's cooldown is active.
    if (!adaptiveBackoffAllows()) return null;
    try {
        let mastery = [];
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;

        if (userId && conceptIds.length > 0) {
            const { data, error } = await supabase
                .from('mastery')
                .select('*')
                .eq('user_id', userId)
                .in('concept_id', conceptIds);

            if (!error && Array.isArray(data)) {
                mastery = data.map((row) => ({
                    concept_id: row.concept_id,
                    p_known: row.p_known ?? row.mastery_score ?? 0.0,
                    mastery_score: row.mastery_score ?? row.p_known ?? 0.0,
                    attempts_count: row.attempts_count ?? 0,
                    correct_count: row.correct_count ?? 0,
                    confidence_level: row.confidence_level ?? '',
                    p_slip: row.p_slip ?? 0.1,
                    p_transit: row.p_transit ?? 0.1
                }));
            }
        }

        const telemetry = summarizeAdaptiveSignals(sectionId)
        const learnerProfile = buildLearnerProfileSnapshot({
            sectionId,
            conceptIds,
            mastery,
            telemetry
        })

        const response = await fetch(`${LLM_API_BASE}/adaptive_recommendation`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                section_id: sectionId,
                section_title: sectionTitle,
                concept_ids: conceptIds,
                current_heading: currentHeading,
                stuck_reason: stuckReason,
                mastery,
                telemetry,
                learner_profile: learnerProfile
            })
        });

        if (!response.ok) {
            throw new Error(`Adaptive recommendation failed: ${response.status}`);
        }

        const data = await response.json();
        noteAdaptiveSuccess();
        const trace = startInterventionTrace({
            sectionId,
            sectionTitle,
            recommendation: data,
            learnerState: data?.learner_state || null,
            learnerProfile,
            context
        })

        return {
            ...data,
            learner_profile: learnerProfile,
            client_trace_id: trace.trace_id
        };
    } catch (error) {
        noteAdaptiveFailure();
        if (!adaptiveBackoffState.circuitOpen) {
            console.warn('Error getting adaptive recommendation (will back off before retrying):', error);
        }
        return null;
    }
};
