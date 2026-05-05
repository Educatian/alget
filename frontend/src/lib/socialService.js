import { supabase } from './supabase'
import { safeLocalStorageGet, safeLocalStorageSet } from './browserStorage'

const SOCIAL_ALIAS_KEY = 'alget_social_alias'
const SOCIAL_COLOR_KEY = 'alget_social_color'
const SOCIAL_HELP_COOLDOWN_MS = 5 * 60 * 1000

const ADJECTIVES = ['Curious', 'Steady', 'Bright', 'Thoughtful', 'Swift', 'Calm', 'Bold', 'Patient']
const ANIMALS = ['Fox', 'Otter', 'Falcon', 'Panda', 'Lynx', 'Heron', 'Robin', 'Whale']
const COLOR_TOKENS = [
    'from-sky-500 to-cyan-400',
    'from-emerald-500 to-teal-400',
    'from-amber-500 to-orange-400',
    'from-violet-500 to-fuchsia-400',
    'from-rose-500 to-pink-400',
    'from-indigo-500 to-blue-400'
]

function pickRandom(list) {
    return list[Math.floor(Math.random() * list.length)]
}

function sanitizeSectionId(sectionId = '') {
    return sectionId.replace(/[^a-zA-Z0-9_-]/g, '-')
}

function buildPresenceKey(identity, sectionId) {
    return `${identity.userKey}-${sanitizeSectionId(sectionId)}`
}

function flattenPresence(channel, selfKey) {
    const state = channel?.presenceState?.() || {}
    return Object.entries(state).flatMap(([key, entries]) =>
        (entries || []).map((entry, index) => ({
            ...entry,
            key: `${key}-${index}`,
            isSelf: key === selfKey
        }))
    )
}

function getCompletionStorageKey(userId, sectionId) {
    return `alget_social_completion_${userId || 'guest'}_${sectionId}`
}

function getHelpStorageKey(userId, sectionId) {
    return `alget_social_help_${userId || 'guest'}_${sectionId}`
}

export const SOCIAL_REACTIONS = [
    { id: 'clicked', label: 'This clicked' },
    { id: 'need_example', label: 'Need an example' },
    { id: 'stuck_too', label: "I'm stuck too" }
]

export function getSocialIdentity(user) {
    if (typeof window === 'undefined') {
        return {
            alias: 'Curious Fox',
            colorToken: COLOR_TOKENS[0],
            userKey: user?.id || 'guest'
        }
    }

    let alias = safeLocalStorageGet(SOCIAL_ALIAS_KEY)
    let colorToken = safeLocalStorageGet(SOCIAL_COLOR_KEY)

    if (!alias) {
        alias = `${pickRandom(ADJECTIVES)} ${pickRandom(ANIMALS)}`
        safeLocalStorageSet(SOCIAL_ALIAS_KEY, alias)
    }

    if (!colorToken) {
        colorToken = pickRandom(COLOR_TOKENS)
        safeLocalStorageSet(SOCIAL_COLOR_KEY, colorToken)
    }

    return {
        alias,
        colorToken,
        userKey: user?.id || alias.toLowerCase().replace(/\s+/g, '-')
    }
}

export function getAliasInitials(alias = 'Peer') {
    return alias
        .split(' ')
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() || '')
        .join('')
}

export async function createSocialPresenceChannel({
    sectionId,
    sectionTitle,
    course,
    heading,
    focusConcept,
    user,
    onPresenceChange,
    onLiveSignal,
    onStatusChange
}) {
    if (!sectionId || typeof supabase.channel !== 'function') {
        return null
    }

    const identity = getSocialIdentity(user)
    const selfKey = buildPresenceKey(identity, sectionId)
    const channel = supabase.channel(`social:${sanitizeSectionId(sectionId)}`, {
        config: {
            presence: {
                key: selfKey
            }
        }
    })
    channel.__presenceKey = selfKey

    channel
        .on('presence', { event: 'sync' }, () => {
            onPresenceChange?.(flattenPresence(channel, selfKey))
        })
        .on('broadcast', { event: 'social_signal' }, ({ payload }) => {
            onLiveSignal?.(payload)
        })

    channel.subscribe(async (status) => {
        onStatusChange?.(status)

        if (status === 'SUBSCRIBED') {
            const snapshot = {
                alias: identity.alias,
                colorToken: identity.colorToken,
                presenceKey: selfKey,
                userId: user?.id || null,
                sectionId,
                sectionTitle,
                course,
                heading,
                focusConcept,
                joinedAt: new Date().toISOString()
            }

            await channel.track(snapshot)
            await persistPresenceSnapshot(snapshot)
        }
    })

    return {
        channel,
        identity
    }
}

export async function updatePresenceSnapshot(channel, snapshot) {
    if (!channel?.track) return

    try {
        const nextSnapshot = {
            ...snapshot,
            presenceKey: channel.__presenceKey,
            updatedAt: new Date().toISOString()
        }

        await channel.track(nextSnapshot)
        await persistPresenceSnapshot(nextSnapshot)
    } catch (error) {
        console.warn('[Social] Presence update failed:', error)
    }
}

export async function disconnectSocialPresence(channel) {
    if (!channel) return
    try {
        await clearPresenceSnapshot(channel.__presenceKey)
        await supabase.removeChannel(channel)
    } catch (error) {
        console.warn('[Social] Failed to remove presence channel:', error)
    }
}

export async function persistPresenceSnapshot(snapshot) {
    if (!snapshot?.presenceKey || !snapshot?.sectionId || !snapshot?.alias) {
        return false
    }

    try {
        const { error } = await supabase
            .from('social_presence')
            .upsert({
                presence_key: snapshot.presenceKey,
                user_id: snapshot.userId || null,
                alias: snapshot.alias,
                color_token: snapshot.colorToken || null,
                course: snapshot.course || null,
                section_id: snapshot.sectionId,
                section_title: snapshot.sectionTitle || null,
                heading: snapshot.heading || null,
                concept_id: snapshot.focusConcept || null,
                joined_at: snapshot.joinedAt || snapshot.updatedAt || new Date().toISOString(),
                last_seen_at: new Date().toISOString()
            }, { onConflict: 'presence_key' })

        if (error) {
            console.warn('[Social] Presence persist failed:', error)
            return false
        }

        return true
    } catch (error) {
        console.warn('[Social] Presence persist error:', error)
        return false
    }
}

export async function clearPresenceSnapshot(presenceKey) {
    if (!presenceKey) {
        return
    }

    try {
        const { error } = await supabase
            .from('social_presence')
            .delete()
            .eq('presence_key', presenceKey)

        if (error) {
            console.warn('[Social] Presence clear failed:', error)
        }
    } catch (error) {
        console.warn('[Social] Presence clear error:', error)
    }
}

export async function broadcastSocialSignal(channel, payload) {
    if (!channel?.send) return
    try {
        await channel.send({
            type: 'broadcast',
            event: 'social_signal',
            payload
        })
    } catch (error) {
        console.warn('[Social] Broadcast failed:', error)
    }
}

export async function persistSocialSignal(signal) {
    try {
        const { error } = await supabase.from('social_signals').insert([signal])
        if (error) {
            console.warn('[Social] Persist failed:', error)
            return false
        }
        return true
    } catch (error) {
        console.warn('[Social] Persist error:', error)
        return false
    }
}

export async function fetchSocialSignals(sectionId) {
    if (!sectionId) return []

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    try {
        const { data, error } = await supabase
            .from('social_signals')
            .select('signal_type, signal_value, heading, created_at')
            .eq('section_id', sectionId)
            .gte('created_at', since)
            .order('created_at', { ascending: false })
            .limit(250)

        if (error) {
            console.warn('[Social] Fetch signals failed:', error)
            return []
        }

        return data || []
    } catch (error) {
        console.warn('[Social] Fetch signals error:', error)
        return []
    }
}

export async function fetchLivePresenceSnapshots(windowMinutes = 5) {
    const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString()

    try {
        const { data, error } = await supabase
            .from('social_presence')
            .select('presence_key, user_id, alias, course, section_id, heading, concept_id, last_seen_at')
            .gte('last_seen_at', since)

        if (error) {
            console.warn('[Social] Fetch presence snapshots failed:', error)
            return []
        }

        return data || []
    } catch (error) {
        console.warn('[Social] Fetch presence snapshots error:', error)
        return []
    }
}

export function summarizeSocialSignals(signals, heading) {
    const reactionCounts = SOCIAL_REACTIONS.reduce((accumulator, reaction) => {
        accumulator[reaction.id] = 0
        return accumulator
    }, {})

    let completionsToday = 0
    let helpOpensToday = 0
    let reactionTotal = 0
    const confusionByHeading = {}

    signals.forEach((signal) => {
        if (signal.signal_type === 'completion') {
            completionsToday += 1
        }

        if (signal.signal_type === 'help_open') {
            helpOpensToday += 1
        }

        if (signal.signal_type === 'reaction') {
            const matchesHeading = !heading || !signal.heading || signal.heading === heading
            if (matchesHeading && signal.signal_value in reactionCounts) {
                reactionCounts[signal.signal_value] += 1
            }
            if (signal.signal_value === 'need_example' || signal.signal_value === 'stuck_too') {
                const key = signal.heading || 'this section'
                confusionByHeading[key] = (confusionByHeading[key] || 0) + 1
            }
            reactionTotal += 1
        }
    })

    const topConfusion = Object.entries(confusionByHeading)
        .sort((left, right) => right[1] - left[1])[0] || null

    const supportChoices = [
        { id: 'opened_support', label: 'Opened BigAL support', count: helpOpensToday },
        { id: 'need_example', label: 'Asked for an example', count: reactionCounts.need_example || 0 },
        { id: 'stuck_too', label: 'Marked stuck too', count: reactionCounts.stuck_too || 0 },
        { id: 'clicked', label: 'Marked this clicked', count: reactionCounts.clicked || 0 }
    ]

    const mostSelectedSupport = supportChoices
        .filter((choice) => choice.count > 0)
        .sort((left, right) => right.count - left.count)[0] || null

    return {
        completionsToday,
        helpOpensToday,
        reactionTotal,
        reactionCounts,
        topConfusion: topConfusion
            ? { heading: topConfusion[0], count: topConfusion[1] }
            : null,
        mostSelectedSupport,
        supportChoices
    }
}

export function shouldEmitCompletionSignal(userId, sectionId) {
    if (typeof window === 'undefined') return true
    const key = getCompletionStorageKey(userId, sectionId)
    const hasCompleted = safeLocalStorageGet(key)
    if (hasCompleted) return false
    safeLocalStorageSet(key, new Date().toISOString())
    return true
}

export function shouldEmitHelpSignal(userId, sectionId) {
    if (typeof window === 'undefined') return true
    const key = getHelpStorageKey(userId, sectionId)
    const previous = safeLocalStorageGet(key)
    const now = Date.now()

    if (previous && now - new Date(previous).getTime() < SOCIAL_HELP_COOLDOWN_MS) {
        return false
    }

    safeLocalStorageSet(key, new Date(now).toISOString())
    return true
}
