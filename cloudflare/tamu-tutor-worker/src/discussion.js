/**
 * Section discussions (sites with the discussion feature):
 *
 *   GET  /discussion?section=ai-literacy/01/02   posts in that section, oldest first
 *   POST /discussion {section_id, body, anchor?, parent_id?}
 *   POST /discussion/hide {id, hidden}           instructors only
 *
 * Authors show by roster ID; hidden posts (and replies under a hidden thread) are left out for students
 * and marked for instructors.
 * After a post the reader tells the live worker, which asks everyone in the section to reload.
 */
const SECTION = /^[a-z0-9-]+\/\d\d\/\d\d$/
const MAX_BODY = 1000
const MAX_ANCHOR = 300
const MAX_POSTS = 300

const clean = (v, max) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, max)

export async function listPosts(env, session, section) {
    if (!SECTION.test(String(section || ''))) return [{ error: 'bad_section' }, 400]
    const instructor = session.role === 'instructor'
    const { results } = await env.DB.prepare(
        `SELECT id, parent_id, anchor, student_id, role, body, created, hidden FROM posts
         WHERE section_id = ? ${instructor ? '' : 'AND hidden = 0 AND (parent_id IS NULL OR parent_id NOT IN (SELECT id FROM posts WHERE hidden = 1))'}
         ORDER BY created, id LIMIT ${MAX_POSTS}`,
    ).bind(section).all()
    const posts = results.map((p) => ({
        id: p.id, parent_id: p.parent_id, anchor: p.anchor, author: p.student_id, role: p.role,
        mine: p.student_id === session.id, body: p.body, created: p.created, hidden: Boolean(p.hidden),
    }))
    return [{ section, posts }, 200]
}

export async function addPost(env, session, body) {
    const section = String(body?.section_id || '')
    if (!SECTION.test(section)) return [{ error: 'bad_section' }, 400]
    const text = clean(body?.body, MAX_BODY)
    if (!text) return [{ error: 'empty' }, 400]
    let parent = null
    if (body?.parent_id != null) {
        parent = await env.DB.prepare('SELECT id, parent_id FROM posts WHERE id = ? AND section_id = ? AND hidden = 0').bind(Number(body.parent_id), section).first()
        if (!parent) return [{ error: 'bad_parent' }, 400]
    }
    const anchor = parent ? null : clean(body?.anchor, MAX_ANCHOR) || null
    const created = new Date().toISOString()
    const res = await env.DB.prepare('INSERT INTO posts (section_id, parent_id, anchor, student_id, role, body, created) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind(section, parent ? parent.parent_id ?? parent.id : null, anchor, session.id, session.role === 'instructor' ? 'instructor' : 'student', text, created).run()
    return [{ ok: true, id: Number(res?.meta?.last_row_id ?? res?.lastInsertRowid ?? 0) }, 200]
}

export async function hidePost(env, session, body) {
    if (session.role !== 'instructor') return [{ error: 'instructors_only' }, 403]
    const hidden = body?.hidden === false ? 0 : 1
    const res = await env.DB.prepare('UPDATE posts SET hidden = ?, hidden_by = ? WHERE id = ?').bind(hidden, hidden ? session.id : null, Number(body?.id)).run()
    const changed = Number(res?.meta?.changes ?? res?.changes ?? 0)
    return changed ? [{ ok: true }, 200] : [{ error: 'not_found' }, 404]
}
