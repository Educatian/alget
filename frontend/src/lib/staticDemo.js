/**
 * Static demo build (VITE_STATIC_DEMO=true): a read-only preview of one course with no
 * Supabase, no backend and no accounts. Course content is served as static JSON from
 * /demo-api (written by scripts/export_static_demo.py), and nothing the reader does is
 * stored or sent anywhere.
 */

export const STATIC_DEMO = import.meta.env.VITE_STATIC_DEMO === 'true'
export const DEMO_COURSE = import.meta.env.VITE_DEMO_COURSE || 'ai-literacy'
export const DEMO_START = `/book/${DEMO_COURSE}/01/01`
export const DEMO_USER = STATIC_DEMO ? { id: 'demo-reader', email: 'demo@alget.local' } : null

// Same rule as the backend's multiple-choice branch of /api/grade/{problem_id}.
export function gradeMultipleChoice(problem, selectedIndex) {
    const options = problem?.options || []
    const correctIndex = problem?.correct_index
    const isCorrect = selectedIndex !== null && correctIndex !== undefined && correctIndex !== null
        && Number(selectedIndex) === Number(correctIndex)
    return {
        is_correct: isCorrect,
        user_answer: options[selectedIndex] ?? '',
        expected: options[correctIndex] ?? '',
        explanation: problem?.explanation || (isCorrect ? 'Correct.' : 'Not quite. Review the explanation and try again.'),
        selected_option: selectedIndex,
        correct_index: correctIndex,
    }
}
