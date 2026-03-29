import { useState } from 'react';

function loadCompletedSections(userId) {
    const saved = localStorage.getItem(`alget_progress_${userId || 'guest'}`);

    if (!saved) {
        return [];
    }

    try {
        return JSON.parse(saved);
    } catch {
        return [];
    }
}

export function useCourseProgress(user) {
    const [completedSections, setCompletedSections] = useState(() => loadCompletedSections(user?.id));

    const markCompleted = (course, chapter, section) => {
        const id = `${course}/${chapter}/${section}`;
        setCompletedSections(prev => {
            if (prev.includes(id)) return prev;
            const next = [...prev, id];
            localStorage.setItem(`alget_progress_${user?.id || 'guest'}`, JSON.stringify(next));
            return next;
        });
    }

    const isCompleted = (course, chapter, section) => {
        const id = `${course}/${chapter}/${section}`;
        return completedSections.includes(id);
    }

    return { completedSections, markCompleted, isCompleted };
}
