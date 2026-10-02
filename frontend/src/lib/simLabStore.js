// Restores a participant's lab choice and saved lab events from their own
// event_logs rows (readable by the signed-in user), so progress follows them
// across devices. Falls back to this browser's storage if the query fails.
import { isSupabaseConfigured, supabase } from './supabase'
import { safeLocalStorageGet, safeLocalStorageSet } from './browserStorage'
import { logEvent } from './loggingService'

const CHOICE_KEY = 'alget_sim_lab_choice'

// Trials (with their data) plus input changes (timestamps only; there can be many),
// merged in time order: that is all computeLabProgress needs.
export async function loadSavedLabEvents(simId) {
    if (!isSupabaseConfigured) return []
    try {
        const [trials, inputs] = await Promise.all([
            supabase.from('event_logs')
                .select('event_type, event_data, client_ts')
                .eq('event_target', simId)
                .in('event_type', ['sim_unity_trial_completed', 'sim_unity_final_design_submitted'])
                .order('client_ts', { ascending: true })
                .limit(2000),
            supabase.from('event_logs')
                .select('event_type, client_ts')
                .eq('event_target', simId)
                .eq('event_type', 'sim_unity_input_changed')
                .order('client_ts', { ascending: true })
                .limit(20000),
        ])
        if (trials.error) return []
        return [...(trials.data || []), ...(inputs.data || [])]
            // Same-millisecond ties: the bridge records a settled input just before its trial.
            .sort((a, b) => String(a.client_ts).localeCompare(String(b.client_ts))
                || (a.event_type === 'sim_unity_input_changed' ? -1 : 0) - (b.event_type === 'sim_unity_input_changed' ? -1 : 0))
            .map((row) => ({ type: row.event_type.replace(/^sim_/, ''), data: row.event_data || {} }))
    } catch {
        return []
    }
}

export async function loadLabChoice() {
    const local = safeLocalStorageGet(CHOICE_KEY)
    if (!isSupabaseConfigured) return local
    try {
        const { data } = await supabase
            .from('event_logs')
            .select('event_target, client_ts')
            .eq('event_type', 'sim_lab_chosen')
            .order('client_ts', { ascending: false })
            .limit(1)
        return data?.[0]?.event_target || local
    } catch {
        return local
    }
}

export function saveLabChoice(labId, previous = null) {
    safeLocalStorageSet(CHOICE_KEY, labId)
    logEvent('sim_lab_chosen', labId, { lab: labId, previous_lab: previous })
}

export function recordLabCompleted(lab, progress) {
    logEvent('sim_lab_completed', lab.id, {
        lab: lab.id,
        trials_done: progress.trialsDone,
        trials_required: progress.required,
        distinct_designs: progress.distinctDesigns,
        designs_known: progress.designsKnown,
        predictions_matched: progress.predictionsMatched,
        predictions_compared: progress.predictionsCompared,
        goal_met: progress.goalMet,
        final_design_submitted: progress.finalDesignSubmitted,
    }, lab.sectionId)
}

export function recordLabStuck(lab, progress, reason) {
    logEvent('sim_lab_stuck', lab.id, { lab: lab.id, reason, trials_done: progress.trialsDone }, lab.sectionId)
}
