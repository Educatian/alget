import { useEffect, useMemo, useState } from 'react'
import { LIVE_ENABLED, setLiveWhere, subscribeLive } from '../lib/liveClass'

const OFF = { connected: false, presence: null, shared: {} }

function useLiveState() {
    const [live, setLive] = useState(OFF)
    useEffect(() => (LIVE_ENABLED ? subscribeLive(setLive) : undefined), [])
    return live
}

/**
 * Live class counts for the reader (TAMU accounts mode; inert otherwise): classmates online and
 * reading, per section and per heading of this section. Reports this reader's section and heading.
 */
export function useLiveClass({ sectionId, heading }) {
    const live = useLiveState()
    useEffect(() => {
        if (LIVE_ENABLED && sectionId) setLiveWhere(sectionId, heading || null)
    }, [sectionId, heading])
    const { connected, presence: p } = live
    return useMemo(() => ({
        enabled: LIVE_ENABLED,
        connected,
        online: p?.online || 0,
        reading: p?.reading || 0,
        here: p?.here || 0,
        sections: p?.sections || {},
        headings: p?.headings || {},
    }), [connected, p])
}

/** Passages in this section that several classmates underlined ([] when live class is off). */
export function useLiveShared(sectionId) {
    const live = useLiveState()
    return (LIVE_ENABLED && live.shared[sectionId]) || []
}
