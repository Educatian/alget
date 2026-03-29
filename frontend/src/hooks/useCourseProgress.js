import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

function getStorageKey(userId) {
    return `alget_progress_${userId || 'guest'}`;
}

function normalizeSectionId(course, chapter, section) {
    return `${course}/${chapter}/${section}`;
}

function parseSectionId(sectionId) {
    const [course = '', chapter = '', section = ''] = String(sectionId || '').split('/');
    return { course, chapter, section };
}

function dedupeSections(sectionIds = []) {
    return Array.from(new Set(sectionIds.filter(Boolean)));
}

function loadCompletedSections(userId) {
    if (typeof window === 'undefined') {
        return [];
    }

    const saved = window.localStorage.getItem(getStorageKey(userId));

    if (!saved) {
        return [];
    }

    try {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? dedupeSections(parsed) : [];
    } catch {
        return [];
    }
}

function persistCompletedSections(userId, sectionIds) {
    if (typeof window === 'undefined') {
        return;
    }

    window.localStorage.setItem(getStorageKey(userId), JSON.stringify(dedupeSections(sectionIds)));
}

async function fetchCloudProgress(userId) {
    if (!userId) {
        return [];
    }

    try {
        const { data, error } = await supabase
            .from('course_progress')
            .select('section_id')
            .eq('user_id', userId);

        if (error) {
            console.warn('[Progress] Could not fetch cloud progress:', error);
            return [];
        }

        return dedupeSections((data || []).map((row) => row.section_id));
    } catch (error) {
        console.warn('[Progress] Cloud progress fetch failed:', error);
        return [];
    }
}

async function syncProgressRows(userId, sectionIds) {
    if (!userId || sectionIds.length === 0) {
        return;
    }

    try {
        const rows = sectionIds.map((sectionId) => {
            const parsed = parseSectionId(sectionId);
            return {
                user_id: userId,
                section_id: sectionId,
                course: parsed.course,
                chapter: parsed.chapter,
                section: parsed.section,
                completed_at: new Date().toISOString(),
                last_synced_at: new Date().toISOString()
            };
        });

        const { error } = await supabase
            .from('course_progress')
            .upsert(rows, { onConflict: 'user_id,section_id' });

        if (error) {
            console.warn('[Progress] Could not sync cloud progress:', error);
        }
    } catch (error) {
        console.warn('[Progress] Cloud progress sync failed:', error);
    }
}

export function useCourseProgress(user) {
    const userId = user?.id || null;
    const [completedSections, setCompletedSections] = useState(() => loadCompletedSections(userId));
    const [syncStatus, setSyncStatus] = useState('idle');

    useEffect(() => {
        let cancelled = false;

        const initializeProgress = async () => {
            const guestProgress = loadCompletedSections(null);
            const userLocalProgress = loadCompletedSections(userId);
            const localMerged = dedupeSections([...guestProgress, ...userLocalProgress]);

            setCompletedSections(localMerged);
            persistCompletedSections(userId, localMerged);

            if (!userId) {
                setSyncStatus('local');
                return;
            }

            setSyncStatus('syncing');
            const cloudProgress = await fetchCloudProgress(userId);
            if (cancelled) {
                return;
            }

            const merged = dedupeSections([...cloudProgress, ...localMerged]);
            setCompletedSections(merged);
            persistCompletedSections(userId, merged);

            const missingInCloud = merged.filter((sectionId) => !cloudProgress.includes(sectionId));
            if (missingInCloud.length > 0) {
                await syncProgressRows(userId, missingInCloud);
            }

            if (!cancelled) {
                setSyncStatus('synced');
            }
        };

        void initializeProgress();

        return () => {
            cancelled = true;
        };
    }, [userId]);

    const markCompleted = useCallback((course, chapter, section) => {
        const sectionId = normalizeSectionId(course, chapter, section);

        setCompletedSections((previous) => {
            if (previous.includes(sectionId)) {
                return previous;
            }

            const next = dedupeSections([...previous, sectionId]);
            persistCompletedSections(userId, next);

            if (userId) {
                setSyncStatus('syncing');
                void syncProgressRows(userId, [sectionId]).finally(() => {
                    setSyncStatus('synced');
                });
            }

            return next;
        });
    }, [userId]);

    const isCompleted = useCallback((course, chapter, section) => {
        const sectionId = normalizeSectionId(course, chapter, section);
        return completedSections.includes(sectionId);
    }, [completedSections]);

    const progressStats = useMemo(() => {
        const total = completedSections.length;
        const courseBreakdown = completedSections.reduce((accumulator, sectionId) => {
            const { course } = parseSectionId(sectionId);
            if (!course) {
                return accumulator;
            }

            accumulator[course] = (accumulator[course] || 0) + 1;
            return accumulator;
        }, {});

        return {
            totalCompleted: total,
            syncStatus,
            courseBreakdown
        };
    }, [completedSections, syncStatus]);

    return { completedSections, markCompleted, isCompleted, progressStats };
}
