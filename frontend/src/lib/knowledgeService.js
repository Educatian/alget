import API_BASE from './apiConfig';
import { supabase } from './supabase';

/**
 * Generates a formative assessment based on current context.
 */
export const generateAssessment = async (sectionTitle, bioContext, engContext) => {
    try {
        const response = await fetch(`${API_BASE}/generate_assessment`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                section_title: sectionTitle,
                biology_context: bioContext,
                engineering_context: engContext
            })
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        return data.questions || [];
    } catch (error) {
        console.error('Error generating assessment:', error);
        return [];
    }
};

/**
 * Updates the user's mastery score in Supabase for a specific concept.
 * Implements a simple Knowledge Tracing (moving average) model.
 */
export const updateMastery = async (conceptId, isCorrect) => {
    try {
        // 1. Get current user
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || !session.user) {
            console.warn('No active user session for mastery update');
            return null;
        }

        const userId = session.user.id;

        // 2. Fetch existing mastery record
        const { data: existingRecords, error: fetchError } = await supabase
            .from('mastery')
            .select('*')
            .eq('user_id', userId)
            .eq('concept_id', conceptId);

        if (fetchError) throw fetchError;

        const record = existingRecords && existingRecords.length > 0 ? existingRecords[0] : null;

        // 3. Simple Knowledge Tracing Math
        // If no record, initial score is 0.
        let currentScore = record ? record.mastery_score : 0.0;
        let attempts = record ? record.attempts_count : 0;
        let correctCount = record ? record.correct_count : 0;

        const learningRate = 0.3; // How fast the score adapts
        const target = isCorrect ? 1.0 : 0.0;

        // Update values
        attempts += 1;
        if (isCorrect) correctCount += 1;

        // Exponential moving average for knowledge tracing
        const newScore = currentScore + learningRate * (target - currentScore);

        // Determine confidence level
        let confidence = 'low';
        if (newScore > 0.8 && attempts > 2) confidence = 'high';
        else if (newScore > 0.5) confidence = 'medium';

        // 4. Upsert the new values
        const { error: upsertError } = await supabase
            .from('mastery')
            .upsert({
                user_id: userId,
                concept_id: conceptId,
                mastery_score: newScore,
                attempts_count: attempts,
                correct_count: correctCount,
                confidence_level: confidence,
                updated_at: new Date().toISOString(),
                last_practiced_at: new Date().toISOString()
            }, {
                onConflict: 'user_id,concept_id'
            });

        if (upsertError) throw upsertError;

        return { conceptId, newScore, confidence };

    } catch (error) {
        console.error('Error updating mastery:', error);
        return null;
    }
};
