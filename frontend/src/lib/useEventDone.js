import { useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase } from './supabase'

// Whether the signed-in learner has logged this event at least once (e.g.
// 'sim_lab_completed', 'generative_lab_query'). event_logs is readable only for
// the learner's own rows (RLS), so no user filter is needed here.
export function useEventDone(eventType, enabled = true) {
    const [done, setDone] = useState(false)
    useEffect(() => {
        if (!enabled || !isSupabaseConfigured) return undefined
        let active = true
        supabase.from('event_logs').select('id').eq('event_type', eventType).limit(1)
            .then(({ data }) => { if (active) setDone((data || []).length > 0) })
            .catch(() => {})
        return () => { active = false }
    }, [eventType, enabled])
    return done
}
