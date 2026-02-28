import { useState, useEffect } from 'react';

export function useCourseProgress(user) {
    const [completedSections, setCompletedSections] = useState([]);

    useEffect(() => {
        const key = `alget_progress_${user?.id || 'guest'}`;
        const saved = localStorage.getItem(key);
        if (saved) {
            try {
                setCompletedSections(JSON.parse(saved));
            } catch (e) { }
        }
    }, [user]);

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
