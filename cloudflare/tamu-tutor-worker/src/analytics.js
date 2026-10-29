/**
 * Class analytics for the instructor dashboard's "Class analytics" tab (sites with the analytics
 * feature, instructor sessions only):
 *
 *   GET /instructor/analytics
 *
 * Aggregates only; built from the same event log and progress store as /instructor/overview, with
 * test and instructor IDs (9xx) left out. computeAnalytics() is pure so it can be tested on rows.
 */
import { STUDENT, all, course, masteryMap } from './instructor.js'

const PER_GROUP = 3
const MAX_GROUPS = 12
const MIN_FOR_DISCRIMINATION = 5

const round = (v, d = 2) => (v == null || Number.isNaN(v) ? null : Math.round(v * 10 ** d) / 10 ** d)

function pointBiserial(pairs) {
    // pairs: [item correct 0/1, rest score]; null when either side has no spread.
    const n = pairs.length
    if (n < MIN_FOR_DISCRIMINATION) return null
    const mean = (xs) => xs.reduce((a, v) => a + v, 0) / xs.length
    const mx = mean(pairs.map((p) => p[0]))
    const my = mean(pairs.map((p) => p[1]))
    let sxy = 0
    let sxx = 0
    let syy = 0
    for (const [x, y] of pairs) {
        sxy += (x - mx) * (y - my)
        sxx += (x - mx) ** 2
        syy += (y - my) ** 2
    }
    return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null
}

/**
 * sections: [{id, title, items: [{id, concept, stem}]}]
 * practice: [{student_id, target, client_ts, attempt, correct}] in time order
 * cells:    [{student_id, section_id, first_tries, first_correct}]
 * hints:    [{student_id, hints, ai_hints}]
 * hourly:   [{h: 'YYYY-MM-DDTHH', student_id, n}]
 * mastery:  [{student_id, value}]  (alget_local_mastery_v1)
 */
export function computeAnalytics({ sections, practice, cells, hints, hourly, mastery }) {
    const itemInfo = new Map(sections.flatMap((s) => s.items.map((it) => [it.id, { ...it, section: s.id }])))

    // Item analysis on first attempts: difficulty p (share correct) and corrected point-biserial
    // discrimination against each student's first-try score on the other items.
    const first = practice.filter((r) => Number(r.attempt) === 1 && itemInfo.has(r.target))
    const byStudent = new Map()
    for (const r of first) {
        const m = byStudent.get(r.student_id) || new Map()
        if (!m.has(r.target)) m.set(r.target, Number(r.correct) === 1 ? 1 : 0)
        byStudent.set(r.student_id, m)
    }
    const totals = new Map([...byStudent].map(([id, m]) => [id, [...m.values()].reduce((a, v) => a + v, 0)]))
    const items = [...itemInfo.values()].map((it) => {
        const pairs = []
        for (const [id, m] of byStudent) if (m.has(it.id)) pairs.push([m.get(it.id), totals.get(id) - m.get(it.id)])
        return {
            id: it.id, section: it.section, concept: it.concept || null, stem: it.stem,
            n: pairs.length,
            difficulty: pairs.length ? round(pairs.reduce((a, p) => a + p[0], 0) / pairs.length) : null,
            discrimination: round(pointBiserial(pairs)),
        }
    })

    // Learning curve: error rate on each student's practice items in the order they did them (first tries),
    // in groups of PER_GROUP. Each concept has about one item here, so per-concept curves would be one point long.
    const order = new Map() // student -> first tries so far
    const groups = new Map() // group -> [errors, n]
    const counted = new Set()
    for (const r of first) {
        const key = `${r.student_id}|${r.target}`
        if (counted.has(key)) continue
        counted.add(key)
        const k = (order.get(r.student_id) || 0) + 1
        order.set(r.student_id, k)
        const g = Math.ceil(k / PER_GROUP)
        if (g > MAX_GROUPS) continue
        const [e, n] = groups.get(g) || [0, 0]
        groups.set(g, [e + (Number(r.correct) === 1 ? 0 : 1), n + 1])
    }
    const curve = [...groups].sort((a, b) => a[0] - b[0]).map(([g, [e, n]]) => ({
        group: g, from: (g - 1) * PER_GROUP + 1, to: g * PER_GROUP, error_rate: round(e / n), n,
    }))

    // Student x section first-try accuracy.
    const heat = cells.filter((c) => c.first_tries > 0).map((c) => ({
        student: c.student_id, section: c.section_id, accuracy: round(c.first_correct / c.first_tries), tries: c.first_tries,
    }))

    // Help seeking against performance, one point per student who has practiced.
    const hintsBy = new Map(hints.map((h) => [h.student_id, h]))
    const help = [...byStudent].map(([id, m]) => ({
        student: id, items: m.size,
        accuracy: round(totals.get(id) / m.size),
        hints_per_item: round((hintsBy.get(id)?.hints || 0) / m.size),
        ai_hints: hintsBy.get(id)?.ai_hints || 0,
    }))

    // Concept mastery spread (the reader's own estimates, synced with progress).
    const conceptValues = new Map()
    for (const row of mastery) {
        for (const [concept, p] of Object.entries(masteryMap(row.value))) {
            conceptValues.set(concept, [...(conceptValues.get(concept) || []), p])
        }
    }
    const conceptOrder = sections.flatMap((s) => s.concepts || [])
    const concepts = [...conceptValues].map(([concept, values]) => ({ concept, values: values.sort((a, b) => a - b) }))
        .sort((a, b) => conceptOrder.indexOf(a.concept) - conceptOrder.indexOf(b.concept))

    return { items, curve, heat, help, hourly, concepts }
}

export async function analytics(env) {
    const [sections, practice, cells, hints, hourly, mastery] = await Promise.all([
        course(env),
        all(env, `SELECT student_id, target, client_ts, json_extract(data, '$.attempt_number') AS attempt, json_extract(data, '$.is_correct') AS correct
            FROM events WHERE ${STUDENT} AND event = 'practice_answer' ORDER BY client_ts`),
        all(env, `SELECT student_id, section_id,
                SUM(json_extract(data, '$.attempt_number') = 1) AS first_tries,
                SUM(json_extract(data, '$.attempt_number') = 1 AND json_extract(data, '$.is_correct') = 1) AS first_correct
            FROM events WHERE ${STUDENT} AND event = 'practice_answer' GROUP BY student_id, section_id`),
        all(env, `SELECT student_id, COUNT(*) AS hints, SUM(json_extract(data, '$.kind') = 'ai') AS ai_hints
            FROM events WHERE ${STUDENT} AND event = 'hint_rung' GROUP BY student_id`),
        all(env, `SELECT substr(client_ts, 1, 13) AS h, student_id, COUNT(*) AS n FROM events WHERE ${STUDENT} GROUP BY h, student_id`),
        all(env, `SELECT student_id, value FROM progress WHERE ${STUDENT} AND key = 'alget_local_mastery_v1'`),
    ])
    return [{ generated_at: new Date().toISOString(), ...computeAnalytics({ sections, practice, cells, hints, hourly, mastery }) }, 200]
}
