/**
 * Instructor dashboard data (instructor sessions only):
 *
 *   GET /instructor/overview            roster with status and progress, per-section and per-item stats
 *   GET /instructor/student?id=TAMU-007 one student: sections, mastery, written work, recent activity
 *
 * Built from the learning events and per-student progress in D1. Test and instructor IDs
 * (TAMU-9xx) are left out. Note and highlight text is never returned, only counts; written
 * activities (submitted work) are returned in full.
 */
import { ACTIVITIES } from './activities.js'
import { loadSection } from './content.js'

const STUDENT = "student_id NOT LIKE 'TAMU-9%'"
const ACTIVE_NOW_MIN = 10

/** Sections in course order, with their practice items and concepts. */
async function course(env) {
    const ids = Object.keys(ACTIVITIES).sort()
    const sections = await Promise.all(ids.map(async (id) => {
        const s = await loadSection(env, id)
        return {
            id,
            title: s?.meta?.title || id,
            items: (s?.practice?.problems || []).map((p) => ({ id: p.id, concept: p.concept_id, stem: p.stem, options: p.options, correct: p.correct_index })),
            concepts: s?.meta?.concept_ids || [],
        }
    }))
    return sections
}

async function roster(env) {
    const ids = []
    let cursor
    do {
        const page = await env.ACCOUNTS.list({ prefix: 'account:TAMU-', cursor })
        ids.push(...page.keys.map((k) => k.name.slice('account:'.length)))
        cursor = page.list_complete ? null : page.cursor
    } while (cursor)
    return ids.filter((id) => !id.startsWith('TAMU-9')).sort()
}

const all = async (env, sql, ...binds) => (await env.DB.prepare(sql).bind(...binds).all()).results

/** Per-student, per-section counts from the event log. */
async function sectionCounts(env, where = '', ...binds) {
    return all(env, `SELECT student_id, section_id,
            SUM(event = 'page_view') AS views,
            COUNT(DISTINCT CASE WHEN event = 'practice_answer' THEN target END) AS items_answered,
            SUM(event = 'practice_answer' AND json_extract(data, '$.attempt_number') = 1) AS first_tries,
            SUM(event = 'practice_answer' AND json_extract(data, '$.attempt_number') = 1 AND json_extract(data, '$.is_correct') = 1) AS first_correct,
            COUNT(DISTINCT CASE WHEN event = 'video_quiz_answer' THEN target END) AS checkins_answered,
            COUNT(DISTINCT CASE WHEN event = 'video_quiz_answer' AND json_extract(data, '$.correct') = 1 THEN target END) AS checkins_correct,
            SUM(event = 'activity_feedback_received') AS activity_rounds,
            MAX(CASE WHEN event = 'activity_feedback_received' AND json_extract(data, '$.ready') = 1 THEN 1 ELSE 0 END) AS activity_ready,
            SUM(event = 'hint_rung') AS hints,
            SUM(event = 'hint_rung' AND json_extract(data, '$.kind') = 'ai') AS ai_hints,
            SUM(event = 'stuck_event') AS stuck,
            SUM(event = 'intervention_shown') AS interventions,
            SUM(event = 'lesson_video_finished') AS videos_finished
        FROM events WHERE ${STUDENT} AND section_id IS NOT NULL ${where} GROUP BY student_id, section_id`, ...binds)
}

function sectionStatus(row, itemCount) {
    if (!row) return 'not_started'
    const practiced = row.items_answered >= itemCount && itemCount > 0
    if (practiced && row.activity_rounds > 0) return 'done'
    if (row.items_answered > 0 || row.activity_rounds > 0 || row.checkins_answered > 0) return 'working'
    return row.views > 0 ? 'reading' : 'not_started'
}

function activityLabel(lastTs, now) {
    if (!lastTs) return 'not_started'
    const minutes = (now - Date.parse(lastTs)) / 60000
    if (minutes <= ACTIVE_NOW_MIN) return 'active_now'
    if (minutes <= 24 * 60) return 'today'
    if (minutes <= 7 * 24 * 60) return 'this_week'
    return 'inactive'
}

const pct = (a, b) => (b ? Math.round((a / b) * 100) : null)

function masteryMap(value) {
    try {
        return Object.fromEntries(Object.entries(JSON.parse(value) || {}).map(([c, r]) => [c, Math.round(Number(r?.p_known ?? r?.mastery_score ?? 0) * 100) / 100]))
    } catch {
        return {}
    }
}

export async function overview(env) {
    const now = Date.now()
    const [sections, ids, base, counts, current, mastery, items, wrong] = await Promise.all([
        course(env),
        roster(env),
        all(env, `SELECT student_id, MIN(client_ts) AS first_ts, MAX(client_ts) AS last_ts, COUNT(DISTINCT session_id) AS sessions,
                COUNT(DISTINCT substr(client_ts, 1, 16)) AS active_minutes FROM events WHERE ${STUDENT} GROUP BY student_id`),
        sectionCounts(env),
        all(env, `SELECT student_id, section_id, MAX(client_ts) AS at FROM events WHERE ${STUDENT} AND event = 'page_view' GROUP BY student_id`),
        all(env, `SELECT student_id, value FROM progress WHERE ${STUDENT} AND key = 'alget_local_mastery_v1'`),
        all(env, `SELECT target AS item, section_id, COUNT(DISTINCT student_id) AS students,
                SUM(json_extract(data, '$.attempt_number') = 1) AS first_tries,
                SUM(json_extract(data, '$.attempt_number') = 1 AND json_extract(data, '$.is_correct') = 1) AS first_correct
            FROM events WHERE ${STUDENT} AND event = 'practice_answer' GROUP BY target`),
        all(env, `SELECT target AS item, json_extract(data, '$.selected_index') AS pick, COUNT(*) AS n
            FROM events WHERE ${STUDENT} AND event = 'practice_answer' AND json_extract(data, '$.is_correct') = 0 GROUP BY target, pick`),
    ])
    const byStudent = new Map(base.map((b) => [b.student_id, b]))
    const masteryBy = new Map(mastery.map((m) => [m.student_id, masteryMap(m.value)]))
    const currentBy = new Map(current.map((c) => [c.student_id, c.section_id]))
    const countsBy = new Map()
    for (const c of counts) countsBy.set(`${c.student_id}|${c.section_id}`, c)

    const students = [...new Set([...ids, ...byStudent.keys()])].sort().map((id) => {
        const b = byStudent.get(id)
        const rows = sections.map((s) => countsBy.get(`${id}|${s.id}`))
        const statuses = sections.map((s, i) => sectionStatus(rows[i], s.items.length))
        const sum = (k) => rows.reduce((a, r) => a + (r?.[k] || 0), 0)
        const m = Object.values(masteryBy.get(id) || {})
        const firstTries = sum('first_tries')
        const accuracy = pct(sum('first_correct'), firstTries)
        const status = activityLabel(b?.last_ts, now)
        const flags = []
        if (status === 'not_started') flags.push('not_started')
        if (firstTries >= 4 && accuracy < 50) flags.push('low_accuracy')
        if (sum('stuck') >= 3) flags.push('often_stuck')
        if (b && status === 'inactive') flags.push('inactive')
        return {
            id, status, flags,
            last_active: b?.last_ts || null, first_active: b?.first_ts || null,
            sessions: b?.sessions || 0, active_minutes: b?.active_minutes || 0,
            current_section: currentBy.get(id) || null,
            sections: statuses,
            sections_done: statuses.filter((x) => x === 'done').length,
            sections_started: statuses.filter((x) => x !== 'not_started').length,
            practice_first_try_accuracy: accuracy, items_answered: sum('items_answered'),
            checkins_answered: sum('checkins_answered'), checkins_correct: sum('checkins_correct'),
            activities_submitted: rows.filter((r) => r?.activity_rounds > 0).length,
            activities_complete: rows.filter((r) => r?.activity_ready > 0).length,
            hints: sum('hints'), ai_hints: sum('ai_hints'), stuck: sum('stuck'), interventions: sum('interventions'),
            mastery_avg: m.length ? Math.round((m.reduce((a, v) => a + v, 0) / m.length) * 100) / 100 : null,
        }
    })

    const sectionStats = sections.map((s, i) => {
        const st = students.map((x) => x.sections[i])
        return {
            id: s.id, title: s.title,
            started: st.filter((x) => x !== 'not_started').length,
            done: st.filter((x) => x === 'done').length,
            items: s.items.map((it) => {
                const row = items.find((r) => r.item === it.id)
                const picks = wrong.filter((w) => w.item === it.id).sort((a, b) => b.n - a.n)
                return {
                    id: it.id, stem: it.stem, students: row?.students || 0,
                    first_try_accuracy: pct(row?.first_correct || 0, row?.first_tries || 0),
                    common_wrong: picks[0] ? { option: it.options?.[picks[0].pick] ?? String(picks[0].pick), count: picks[0].n } : null,
                }
            }),
        }
    })

    return [{ generated_at: new Date(now).toISOString(), sections: sections.map((s) => ({ id: s.id, title: s.title })), students, section_stats: sectionStats }, 200]
}

export async function studentDetail(env, id) {
    if (!/^TAMU-\d{3}$/.test(String(id || ''))) return [{ error: 'bad_student' }, 400]
    const [sections, counts, progress, recent, base] = await Promise.all([
        course(env),
        sectionCounts(env, 'AND student_id = ?', id),
        all(env, 'SELECT key, value, updated FROM progress WHERE student_id = ?', id),
        all(env, `SELECT client_ts, event, section_id, target FROM events WHERE student_id = ? AND event NOT IN ('click', 'scroll', 'input_commit', 'tab_hidden', 'tab_visible')
            ORDER BY client_ts DESC LIMIT 60`, id),
        all(env, 'SELECT MIN(client_ts) AS first_ts, MAX(client_ts) AS last_ts, COUNT(DISTINCT session_id) AS sessions, COUNT(DISTINCT substr(client_ts, 1, 16)) AS active_minutes FROM events WHERE student_id = ?', id),
    ])
    const countsBy = new Map(counts.map((c) => [c.section_id, c]))
    const prog = new Map(progress.map((p) => [p.key, p]))
    const mastery = masteryMap(prog.get('alget_local_mastery_v1')?.value)
    const json = (v, fallback) => { try { return JSON.parse(v) ?? fallback } catch { return fallback } }

    const perSection = sections.map((s) => {
        const c = countsBy.get(s.id)
        const activity = json(prog.get(`alget_activity_v1:${s.id}`)?.value, null)
        const highlights = json(prog.get(`alget_highlights_v1:${s.id}`)?.value, [])
        const lastRound = activity?.rounds?.at(-1) || null
        return {
            id: s.id, title: s.title,
            status: sectionStatus(c, s.items.length),
            views: c?.views || 0,
            items_answered: c?.items_answered || 0, items_total: s.items.length,
            first_try_accuracy: pct(c?.first_correct || 0, c?.first_tries || 0),
            checkins: `${c?.checkins_correct || 0}/${c?.checkins_answered || 0}`,
            hints: c?.hints || 0, stuck: c?.stuck || 0,
            highlights: Array.isArray(highlights) ? highlights.length : 0,
            notes: Array.isArray(highlights) ? highlights.filter((h) => h?.note).length : 0,
            concepts: s.concepts.map((cid) => ({ id: cid, p_known: mastery[cid] ?? null })),
            activity: activity?.text ? {
                prompt: ACTIVITIES[s.id]?.prompt || '',
                text: lastRound?.text || activity.text,
                draft: activity.text !== lastRound?.text ? activity.text : null,
                rounds: (activity.rounds || []).length,
                ready: Boolean(lastRound?.ready),
                criteria: (lastRound?.criteria || []).map((k) => ({ id: k.id, status: k.status, label: ACTIVITIES[s.id]?.criteria?.find((x) => x.id === k.id)?.label || k.id })),
                next_step: lastRound?.next_step || null,
                updated: prog.get(`alget_activity_v1:${s.id}`)?.updated || null,
            } : null,
        }
    })
    return [{ id, ...(base[0] || {}), sections: perSection, recent }, 200]
}
