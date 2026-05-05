import API_BASE from './apiConfig';
import { supabase } from './supabase';
import { buildLearnerProfileSnapshot, startInterventionTrace } from './researchService';

const ADAPTIVE_SIGNAL_KEY = 'alget_adaptive_signals_v1';
const ADAPTIVE_SIGNAL_WINDOW_MS = 1000 * 60 * 90;
const MAX_ADAPTIVE_SIGNALS = 250;

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
export const generateAssessment = async (sectionTitle, bioContext, engContext, learningObjectives, conceptIds) => {
    try {
        const apiKey = localStorage.getItem('gemini_api_key') || import.meta.env.VITE_GEMINI_API_KEY || '';
        const response = await fetch(`${API_BASE}/generate_assessment`, {
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
                api_key: apiKey
            })
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        return data.assessment || null;
    } catch (error) {
        console.error('Error generating assessment:', error);
        return [];
    }
};

/**
 * Grades a short-answer or summary response using the LLM rubric.
 */
export const gradeSummary = async (question, studentAnswer, rubric) => {
    try {
        const apiKey = localStorage.getItem('gemini_api_key') || import.meta.env.VITE_GEMINI_API_KEY || '';
        const response = await fetch(`${API_BASE}/grade_summary`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                question: question,
                student_answer: studentAnswer,
                rubric: rubric,
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
        const { hintUsed = false } = options
        const { data: { session } } = await supabase.auth.getSession();
        let userId = session?.user?.id;

        if (!userId) {
            console.warn('No active user session for mastery update.');
            return null;
        }

        // 1. Fetch current states for all concepts in the Q-Matrix
        const conceptIds = Object.keys(qMatrix);
        const { data: existingRecords, error: fetchError } = await supabase
            .from('mastery')
            .select('*')
            .eq('user_id', userId)
            .in('concept_id', conceptIds);

        if (fetchError) throw fetchError;

        // Build current state dictionary
        let currentStates = {};
        conceptIds.forEach(cid => {
            const record = existingRecords?.find(r => r.concept_id === cid);
            currentStates[cid] = record ? record.p_known : 0.1; // Default prior
        });

        // Hint penalty: damp the Q-matrix weights so a hint-assisted correct
        // answer updates p_known by less than an unaided correct answer.
        // Empirically picking 0.6 as the damping factor (Carnegie Learning's
        // hint-aware BKT typically uses 0.5-0.7).
        const adjustedQMatrix = hintUsed
            ? Object.fromEntries(Object.entries(qMatrix).map(([cid, w]) => [cid, Number(w) * 0.6]))
            : qMatrix

        // 2. Call Python backend BKT engine
        const response = await fetch(`${API_BASE}/grade`, {
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

        if (upsertError) throw upsertError;

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
        return null;
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

        const response = await fetch(`${API_BASE}/telemetry_fusion`, {
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

export const getAdaptiveRecommendation = async ({
    sectionId,
    sectionTitle = '',
    conceptIds = [],
    currentHeading = '',
    stuckReason = null,
    context = {}
}) => {
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

        const response = await fetch(`${API_BASE}/adaptive_recommendation`, {
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
        console.error('Error getting adaptive recommendation:', error);
        return null;
    }
};
