// Restores a participant's lab choice and saved lab events from their own
// event_logs rows (readable by the signed-in user), so progress follows them
// across devices. Falls back to this browser's storage if the query fails.
import { isSupabaseConfigured, supabase } from './supabase'
import { safeLocalStorageGet, safeLocalStorageSet } from './browserStorage'
import { logEvent } from './loggingService'

const CHOICE_KEY = 'alget_sim_lab_choice'

export async function loadSavedLabEvents(simId) {
    if (!isSupabaseConfigured) return []
    try {
        const { data, error } = await supabase
            .from('event_logs')
            .select('event_type, event_data, client_ts')
            .eq('event_target', simId)
            .like('event_type', 'sim_unity_%')
            .order('client_ts', { ascending: true })
            .limit(1000)
        if (error) return []
        return (data || []).map((row) => ({ type: row.event_type.replace(/^sim_/, ''), data: row.event_data || {} }))
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
