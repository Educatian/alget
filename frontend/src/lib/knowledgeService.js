import API_BASE from './apiConfig';
import { supabase } from './supabase';

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
export const updateMastery = async (qMatrix, isCorrect) => {
    try {
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

        // 2. Call Python backend BKT engine
        const response = await fetch(`${API_BASE}/grade`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                current_states: currentStates,
                q_matrix: qMatrix,
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
