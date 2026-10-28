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

// Same model as backend/knowledge_tracing.py (BayesianKnowledgeTracing.process_q_matrix_update).
export function bktUpdate(currentStates, qMatrix, isCorrect, { guess = 0.2, slip = 0.1, transit = 0.1 } = {}) {
    const next = {}
    for (const [conceptId, weight] of Object.entries(qMatrix || {})) {
        const p = Number(currentStates?.[conceptId] ?? 0.1)
        const evidence = isCorrect ? p * (1 - slip) + (1 - p) * guess : p * slip + (1 - p) * (1 - guess)
        const posterior = evidence === 0 ? 0 : (isCorrect ? p * (1 - slip) : p * slip) / evidence
        const full = Math.max(0.0001, Math.min(0.9999, posterior + (1 - posterior) * transit))
        next[conceptId] = p + Number(weight) * (full - p)
    }
    return next
}

// Re-applies mastery and the current section to a chapter graph exported without them, with the
// same thresholds as backend/server.py (build_mastery_graph_payload, _build_graph_status).
export function applyMasteryToGraph(graph, mastery, currentSectionId, currentConcepts = []) {
    const nodes = (graph?.nodes || []).map((node) => {
        const raw = Number(mastery?.[node.id] ?? 0.1)
        const pKnown = Number.isFinite(raw) ? Math.max(0, Math.min(1, raw)) : 0.1
        return {
            ...node,
            p_known: Math.round(pKnown * 100) / 100,
            status: pKnown >= 0.8 ? 'mastered' : pKnown >= 0.5 ? 'emerging' : 'novice',
            is_current: node.section_id === currentSectionId || currentConcepts.includes(node.id),
        }
    })
    return { nodes, links: graph?.links || [] }
}

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
