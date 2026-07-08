export const ENGINEERING_COURSE_IDS = [
    'statics',
    'dynamics',
    'bio-inspired'
]

export const EDUCATION_COURSE_IDS = [
    'inst-design',
    'ai-ethics',
    'ail606-supplement',
    'cat531-supplement',
    'cat100-supplement'
]

export const ALL_COURSE_IDS = [
    ...ENGINEERING_COURSE_IDS,
    ...EDUCATION_COURSE_IDS
]

// Learner-facing course titles (kept in sync with the pathway cards in
// MainApp.jsx). Used wherever a component needs to name the current course,
// e.g. the tutor persona line in ChatWidget.
export const COURSE_TITLES = {
    statics: 'Engineering Statics',
    dynamics: 'Engineering Dynamics',
    'bio-inspired': 'Bio-Inspired Design',
    'inst-design': 'Foundation of Instructional Design',
    'ai-ethics': 'AI and Ethics',
    'ail606-supplement': 'AIL 606: Software Technology',
    'cat531-supplement': 'CAT 531: Technology and Teaching',
    'cat100-supplement': 'CAT 100: Computer Concepts',
}

/**
 * Resolve a display title for a course id. Falls back to prettifying the id
 * ("some-course" -> "Some Course") so an unknown/new course still gets a
 * sensible label instead of another course's persona.
 */
export function getCourseTitle(courseId) {
    if (COURSE_TITLES[courseId]) return COURSE_TITLES[courseId]
    const pretty = String(courseId || '')
        .split('-')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')
    return pretty || 'This Course'
}
