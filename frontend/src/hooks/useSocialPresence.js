import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
    SOCIAL_REACTIONS,
    broadcastSocialSignal,
    createSocialPresenceChannel,
    disconnectSocialPresence,
    fetchSocialSignals,
    getSocialIdentity,
    persistSocialSignal,
    shouldEmitCompletionSignal,
    shouldEmitHelpSignal,
    summarizeSocialSignals,
    updatePresenceSnapshot
} from '../lib/socialService'

export function useSocialPresence({
    user,
    sectionId,
    sectionTitle,
    course,
    heading,
    focusConcept
}) {
    const [status, setStatus] = useState('CLOSED')
    const [presenceEntries, setPresenceEntries] = useState([])
    const [refreshVersion, setRefreshVersion] = useState(0)
    const [signalSummary, setSignalSummary] = useState({
        completionsToday: 0,
        helpOpensToday: 0,
        reactionTotal: 0,
        reactionCounts: SOCIAL_REACTIONS.reduce((accumulator, reaction) => {
            accumulator[reaction.id] = 0
            return accumulator
        }, {})
    })
    const [liveFeed, setLiveFeed] = useState([])
    const channelRef = useRef(null)
    const identityRef = useRef(getSocialIdentity(user))
    const headingRef = useRef(heading)
    const focusConceptRef = useRef(focusConcept)

    const pushLiveFeed = useCallback((entry) => {
        const entryKey = `${entry.alias}-${entry.kind}-${entry.reactionId || 'none'}-${entry.createdAt || 'now'}`
        setLiveFeed((previous) => {
            const deduped = previous.filter((item) => {
                const itemKey = `${item.alias}-${item.kind}-${item.reactionId || 'none'}-${item.createdAt || 'now'}`
                return itemKey !== entryKey
            })
            return [entry, ...deduped].slice(0, 6)
        })
    }, [])

    useEffect(() => {
        identityRef.current = getSocialIdentity(user)
    }, [user])

    useEffect(() => {
        headingRef.current = heading
        focusConceptRef.current = focusConcept
    }, [focusConcept, heading])

    useEffect(() => {
        let cancelled = false

        fetchSocialSignals(sectionId).then((signals) => {
            if (!cancelled) {
                setSignalSummary(summarizeSocialSignals(signals, heading))
            }
        })

        return () => {
            cancelled = true
        }
    }, [heading, refreshVersion, sectionId])

    const requestSignalRefresh = useCallback(() => {
        setRefreshVersion((current) => current + 1)
    }, [])

    useEffect(() => {
        let cancelled = false

        const connect = async () => {
            if (!sectionId) return
            setLiveFeed([])

            const connection = await createSocialPresenceChannel({
                sectionId,
                sectionTitle,
                course,
                heading: headingRef.current,
                focusConcept: focusConceptRef.current,
                user,
                onPresenceChange: (entries) => {
                    if (!cancelled) {
                        setPresenceEntries(entries)
                    }
                },
                onLiveSignal: (payload) => {
                    if (!payload || payload.sectionId !== sectionId) return
                    if (!cancelled && payload.alias) {
                        pushLiveFeed(payload)
                    }
                    requestSignalRefresh()
                },
                onStatusChange: (nextStatus) => {
                    if (!cancelled) {
                        setStatus(nextStatus)
                    }
                }
            })

            if (cancelled) {
                await disconnectSocialPresence(connection?.channel)
                return
            }

            channelRef.current = connection?.channel || null
        }

        connect()

        return () => {
            cancelled = true
            const currentChannel = channelRef.current
            channelRef.current = null
            void disconnectSocialPresence(currentChannel)
            setPresenceEntries([])
            setStatus('CLOSED')
        }
    }, [course, pushLiveFeed, requestSignalRefresh, sectionId, sectionTitle, user])

    useEffect(() => {
        if (!channelRef.current || !sectionId) return

        void updatePresenceSnapshot(channelRef.current, {
            alias: identityRef.current.alias,
            colorToken: identityRef.current.colorToken,
            sectionId,
            sectionTitle,
            course,
            heading,
            focusConcept
        })
    }, [course, focusConcept, heading, sectionId, sectionTitle])

    const peers = useMemo(
        () => presenceEntries.filter((entry) => !entry.isSelf),
        [presenceEntries]
    )

    const sameHeadingPeers = useMemo(
        () => peers.filter((entry) => heading && entry.heading === heading),
        [heading, peers]
    )

    const sameConceptPeers = useMemo(
        () => peers.filter((entry) => focusConcept && entry.focusConcept === focusConcept),
        [focusConcept, peers]
    )

    const sendReaction = useCallback(async (reactionId) => {
        if (!sectionId) return

        const payload = {
            kind: 'reaction',
            alias: identityRef.current.alias,
            colorToken: identityRef.current.colorToken,
            sectionId,
            sectionTitle,
            heading,
            focusConcept,
            reactionId,
            createdAt: new Date().toISOString()
        }

        await broadcastSocialSignal(channelRef.current, payload)
        await persistSocialSignal({
            user_id: user?.id,
            section_id: sectionId,
            course,
            heading,
            concept_id: focusConcept,
            signal_type: 'reaction',
            signal_value: reactionId,
            payload
        })
        pushLiveFeed(payload)
        requestSignalRefresh()
    }, [course, focusConcept, heading, pushLiveFeed, requestSignalRefresh, sectionId, sectionTitle, user?.id])

    const recordCompletion = useCallback(async () => {
        if (!sectionId || !shouldEmitCompletionSignal(user?.id, sectionId)) return

        const payload = {
            kind: 'completion',
            alias: identityRef.current.alias,
            colorToken: identityRef.current.colorToken,
            sectionId,
            sectionTitle,
            heading,
            createdAt: new Date().toISOString()
        }

        await broadcastSocialSignal(channelRef.current, payload)
        await persistSocialSignal({
            user_id: user?.id,
            section_id: sectionId,
            course,
            heading,
            concept_id: focusConcept,
            signal_type: 'completion',
            signal_value: 'section_complete',
            payload
        })
        pushLiveFeed(payload)
        requestSignalRefresh()
    }, [course, focusConcept, heading, pushLiveFeed, requestSignalRefresh, sectionId, sectionTitle, user?.id])

    const recordHelpOpen = useCallback(async () => {
        if (!sectionId || !shouldEmitHelpSignal(user?.id, sectionId)) return

        const payload = {
            kind: 'help_open',
            alias: identityRef.current.alias,
            colorToken: identityRef.current.colorToken,
            sectionId,
            sectionTitle,
            heading,
            createdAt: new Date().toISOString()
        }

        await broadcastSocialSignal(channelRef.current, payload)
        await persistSocialSignal({
            user_id: user?.id,
            section_id: sectionId,
            course,
            heading,
            concept_id: focusConcept,
            signal_type: 'help_open',
            signal_value: 'opened_support',
            payload
        })
        pushLiveFeed(payload)
        requestSignalRefresh()
    }, [course, focusConcept, heading, pushLiveFeed, requestSignalRefresh, sectionId, sectionTitle, user?.id])

    return {
        connected: status === 'SUBSCRIBED',
        peers,
        sameHeadingPeers,
        sameConceptPeers,
        signalSummary,
        liveFeed,
        sendReaction,
        recordCompletion,
        recordHelpOpen
    }
}
