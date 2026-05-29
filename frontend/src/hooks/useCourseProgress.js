import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { safeLocalStorageGet, safeLocalStorageSet, safeLocalStorageRemove } from '../lib/browserStorage'
import { supabase } from '../lib/supabase'

function getScopedKey(prefix, userId) {
    return `${prefix}_${userId || 'guest'}`
}

function getProgressKey(userId) {
    return getScopedKey('alget_progress', userId)
}

function getRecentKey(userId) {
    return getScopedKey('alget_recent', userId)
}

function getBookmarkKey(userId) {
    return getScopedKey('alget_bookmarks', userId)
}

function normalizeSectionId(course, chapter, section) {
    return `${course}/${chapter}/${section}`
}

function parseSectionId(sectionId) {
    const [course = '', chapter = '', section = ''] = String(sectionId || '').split('/')
    return { course, chapter, section }
}

function dedupeSections(sectionIds = []) {
    return Array.from(new Set(sectionIds.filter(Boolean)))
}

function readJsonStorage(key, fallbackValue) {
    if (typeof window === 'undefined') {
        return fallbackValue
    }

    const saved = safeLocalStorageGet(key)
    if (!saved) {
        return fallbackValue
    }

    try {
        return JSON.parse(saved)
    } catch {
        return fallbackValue
    }
}

function persistJsonStorage(key, value) {
    if (typeof window === 'undefined') {
        return
    }

    safeLocalStorageSet(key, JSON.stringify(value))
}

function normalizeBookmark(entry) {
    if (!entry) return null

    const sectionId = entry.sectionId || normalizeSectionId(entry.course, entry.chapter, entry.section)
    if (!sectionId) return null

    const parsed = parseSectionId(sectionId)

    return {
        sectionId,
        course: entry.course || parsed.course,
        chapter: entry.chapter || parsed.chapter,
        section: entry.section || parsed.section,
        title: entry.title || '',
        chapterTitle: entry.chapterTitle || '',
        description: entry.description || '',
        estimatedTimeMinutes: entry.estimatedTimeMinutes || null,
        savedAt: entry.savedAt || entry.updatedAt || new Date().toISOString()
    }
}

function dedupeBookmarks(bookmarks = []) {
    const merged = new Map()

    bookmarks.forEach((bookmark) => {
        const normalized = normalizeBookmark(bookmark)
        if (!normalized?.sectionId) return

        const previous = merged.get(normalized.sectionId)
        if (!previous || new Date(normalized.savedAt).getTime() >= new Date(previous.savedAt).getTime()) {
            merged.set(normalized.sectionId, normalized)
        }
    })

    return Array.from(merged.values()).sort(
        (left, right) => new Date(right.savedAt).getTime() - new Date(left.savedAt).getTime()
    )
}

function normalizeRecent(entry) {
    if (!entry) return null

    const sectionId = entry.sectionId || normalizeSectionId(entry.course, entry.chapter, entry.section)
    if (!sectionId) return null

    const parsed = parseSectionId(sectionId)

    return {
        sectionId,
        course: entry.course || parsed.course,
        chapter: entry.chapter || parsed.chapter,
        section: entry.section || parsed.section,
        title: entry.title || '',
        chapterTitle: entry.chapterTitle || '',
        description: entry.description || '',
        estimatedTimeMinutes: entry.estimatedTimeMinutes || null,
        updatedAt: entry.updatedAt || entry.savedAt || new Date().toISOString()
    }
}

function pickLatestRecent(entries = []) {
    return entries
        .map(normalizeRecent)
        .filter(Boolean)
        .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())[0] || null
}

function loadCompletedSections(userId) {
    const parsed = readJsonStorage(getProgressKey(userId), [])
    return Array.isArray(parsed) ? dedupeSections(parsed) : []
}

function persistCompletedSections(userId, sectionIds) {
    persistJsonStorage(getProgressKey(userId), dedupeSections(sectionIds))
}

function loadRecentSection(userId) {
    return normalizeRecent(readJsonStorage(getRecentKey(userId), null))
}

function persistRecentSection(userId, entry) {
    if (!entry) return
    persistJsonStorage(getRecentKey(userId), normalizeRecent(entry))
}

function loadBookmarks(userId) {
    const parsed = readJsonStorage(getBookmarkKey(userId), [])
    return Array.isArray(parsed) ? dedupeBookmarks(parsed) : []
}

function persistBookmarks(userId, bookmarks) {
    persistJsonStorage(getBookmarkKey(userId), dedupeBookmarks(bookmarks))
}

async function fetchCloudProgress(userId) {
    if (!userId) {
        return []
    }

    try {
        const { data, error } = await supabase
            .from('course_progress')
            .select('section_id')
            .eq('user_id', userId)

        if (error) {
            console.warn('[Progress] Could not fetch cloud progress:', error)
            return []
        }

        return dedupeSections((data || []).map((row) => row.section_id))
    } catch (error) {
        console.warn('[Progress] Cloud progress fetch failed:', error)
        return []
    }
}

async function syncProgressRows(userId, sectionIds) {
    if (!userId || sectionIds.length === 0) {
        return
    }

    try {
        const rows = sectionIds.map((sectionId) => {
            const parsed = parseSectionId(sectionId)
            return {
                user_id: userId,
                section_id: sectionId,
                course: parsed.course,
                chapter: parsed.chapter,
                section: parsed.section,
                completed_at: new Date().toISOString(),
                last_synced_at: new Date().toISOString()
            }
        })

        const { error } = await supabase
            .from('course_progress')
            .upsert(rows, { onConflict: 'user_id,section_id' })

        if (error) {
            console.warn('[Progress] Could not sync cloud progress:', error)
        }
    } catch (error) {
        console.warn('[Progress] Cloud progress sync failed:', error)
    }
}

export function useCourseProgress(user) {
    const userId = user?.id || null
    const [completedSections, setCompletedSections] = useState(() => loadCompletedSections(userId))
    const [recentSection, setRecentSection] = useState(() => loadRecentSection(userId))
    const [bookmarks, setBookmarks] = useState(() => loadBookmarks(userId))
    const [syncStatus, setSyncStatus] = useState('idle')

    // Mirror of completedSections so markCompleted can decide "is this a NEW
    // completion?" WITHOUT running side effects inside the state updater (which
    // React may invoke twice in StrictMode/concurrent mode -> double streak/toast).
    const completedRef = useRef(completedSections)
    useEffect(() => {
        completedRef.current = completedSections
    }, [completedSections])

    useEffect(() => {
        let cancelled = false

        const initializeProgress = async () => {
            const guestProgress = loadCompletedSections(null)
            const userLocalProgress = loadCompletedSections(userId)
            const mergedLocalProgress = dedupeSections([...guestProgress, ...userLocalProgress])

            const mergedRecent = pickLatestRecent([
                loadRecentSection(null),
                loadRecentSection(userId)
            ])

            const mergedBookmarks = dedupeBookmarks([
                ...loadBookmarks(null),
                ...loadBookmarks(userId)
            ])

            setCompletedSections(mergedLocalProgress)
            setRecentSection(mergedRecent)
            setBookmarks(mergedBookmarks)

            persistCompletedSections(userId, mergedLocalProgress)
            if (mergedRecent) {
                persistRecentSection(userId, mergedRecent)
            }
            persistBookmarks(userId, mergedBookmarks)

            // Once a real/demo user has CLAIMED the guest-bucket progress (merged
            // + persisted under their id), clear the guest keys so the next
            // different user on this browser doesn't inherit the same data.
            if (userId) {
                safeLocalStorageRemove(getProgressKey(null))
                safeLocalStorageRemove(getRecentKey(null))
                safeLocalStorageRemove(getBookmarkKey(null))
            }

            if (!userId) {
                setSyncStatus('local')
                return
            }

            setSyncStatus('syncing')
            const cloudProgress = await fetchCloudProgress(userId)
            if (cancelled) {
                return
            }

            const mergedProgress = dedupeSections([...cloudProgress, ...mergedLocalProgress])
            setCompletedSections(mergedProgress)
            persistCompletedSections(userId, mergedProgress)

            const missingInCloud = mergedProgress.filter((sectionId) => !cloudProgress.includes(sectionId))
            if (missingInCloud.length > 0) {
                await syncProgressRows(userId, missingInCloud)
            }

            if (!cancelled) {
                setSyncStatus('synced')
            }
        }

        void initializeProgress()

        return () => {
            cancelled = true
        }
    }, [userId])

    const markCompleted = useCallback((course, chapter, section) => {
        const sectionId = normalizeSectionId(course, chapter, section)

        // Determine newness from the ref (not inside the updater) so the
        // celebration/persist/sync side effects run exactly once per real
        // completion even if React double-invokes the pure updater.
        if (completedRef.current.includes(sectionId)) {
            return
        }

        const next = dedupeSections([...completedRef.current, sectionId])
        completedRef.current = next
        setCompletedSections(next) // pure: just commit the new value
        persistCompletedSections(userId, next)

        // Streak + celebration on a NEW completion only. Dynamic import keeps
        // the hook usable without window/localStorage. Dispatch a window event
        // so chrome (BookLayout header chip, toast) can react.
        if (typeof window !== 'undefined') {
            import('../lib/streak').then(({ bumpStreak }) => {
                const result = bumpStreak()
                window.dispatchEvent(new CustomEvent('alget-section-completed', {
                    detail: { sectionId, course, chapter, section, streak: result },
                }))
            }).catch(() => {})
        }

        if (userId) {
            setSyncStatus('syncing')
            void syncProgressRows(userId, [sectionId]).finally(() => {
                setSyncStatus('synced')
            })
        }
    }, [userId])

    const markRecentSection = useCallback((course, chapter, section, metadata = {}) => {
        const nextRecent = normalizeRecent({
            course,
            chapter,
            section,
            title: metadata.title,
            chapterTitle: metadata.chapterTitle,
            description: metadata.description,
            estimatedTimeMinutes: metadata.estimatedTimeMinutes,
            updatedAt: new Date().toISOString()
        })

        if (!nextRecent) return

        setRecentSection(nextRecent)
        persistRecentSection(userId, nextRecent)
    }, [userId])

    const toggleBookmark = useCallback((course, chapter, section, metadata = {}) => {
        const sectionId = normalizeSectionId(course, chapter, section)

        setBookmarks((previous) => {
            const exists = previous.some((bookmark) => bookmark.sectionId === sectionId)
            const next = exists
                ? previous.filter((bookmark) => bookmark.sectionId !== sectionId)
                : dedupeBookmarks([
                    {
                        sectionId,
                        course,
                        chapter,
                        section,
                        title: metadata.title,
                        chapterTitle: metadata.chapterTitle,
                        description: metadata.description,
                        estimatedTimeMinutes: metadata.estimatedTimeMinutes,
                        savedAt: new Date().toISOString()
                    },
                    ...previous
                ])

            persistBookmarks(userId, next)
            return next
        })
    }, [userId])

    const isCompleted = useCallback((course, chapter, section) => {
        const sectionId = normalizeSectionId(course, chapter, section)
        return completedSections.includes(sectionId)
    }, [completedSections])

    const isBookmarked = useCallback((course, chapter, section) => {
        const sectionId = normalizeSectionId(course, chapter, section)
        return bookmarks.some((bookmark) => bookmark.sectionId === sectionId)
    }, [bookmarks])

    const progressStats = useMemo(() => {
        const total = completedSections.length
        const courseBreakdown = completedSections.reduce((accumulator, sectionId) => {
            const { course } = parseSectionId(sectionId)
            if (!course) {
                return accumulator
            }

            accumulator[course] = (accumulator[course] || 0) + 1
            return accumulator
        }, {})

        return {
            totalCompleted: total,
            syncStatus,
            courseBreakdown,
            totalBookmarks: bookmarks.length
        }
    }, [bookmarks.length, completedSections, syncStatus])

    return {
        completedSections,
        markCompleted,
        isCompleted,
        progressStats,
        recentSection,
        markRecentSection,
        bookmarks,
        toggleBookmark,
        isBookmarked
    }
}
