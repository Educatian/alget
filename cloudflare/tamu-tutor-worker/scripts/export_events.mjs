/**
 * Exports a site's learning events from D1 for analysis (TAMU by default; --db alget-utk-events for UTK):
 *
 *   node scripts/export_events.mjs --out <folder> [--since 2026-11-01] [--student TAMU-007] [--db alget-utk-events] [--local]
 *
 * Writes, outside the repository:
 *   events.csv     one row per event, ordered by student, session start and seq
 *   sequences.csv  one row per session: the ordered event names joined by ">", for sequential
 *                  pattern mining (consecutive repeats of scroll and click are collapsed)
 * Event names are listed in docs/tamu-event-codebook.md.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : fallback }
const out = arg('out')
const since = arg('since')
const student = arg('student')
const db = arg('db', 'alget-tamu-events')
if (!/^alget-[a-z]+-events$/.test(db)) throw new Error('--db must be a site events database, like alget-utk-events')
// Each site's database is declared in its own wrangler config (wrangler.utk.jsonc for alget-utk-events).
const config = db === 'alget-tamu-events' ? 'wrangler.jsonc' : `wrangler.${db.split('-')[1]}.jsonc`
const where_db = process.argv.includes('--local') ? '--local' : '--remote' // --local reads the wrangler dev database
const repo = resolve(fileURLToPath(new URL('../../..', import.meta.url)))
if (!out) throw new Error('give --out <folder>')
if (resolve(out).toLowerCase().startsWith(repo.toLowerCase() + sep)) throw new Error('refusing to write learner data inside the repository')
if (since && !/^\d{4}-\d{2}-\d{2}$/.test(since)) throw new Error('--since must be YYYY-MM-DD')
if (student && !/^[A-Z]{2,6}-\d{3}$/.test(student)) throw new Error('--student must look like TAMU-007')

const COLUMNS = ['student_id', 'session_id', 'seq', 'client_ts', 'server_ts', 'event', 'section_id', 'target', 'data']
const where = [since ? `client_ts >= '${since}'` : '', student ? `student_id = '${student}'` : ''].filter(Boolean).join(' AND ')
const PAGE = 5000

const WIN = process.platform === 'win32'

function query(sql) {
    // On Windows npx.cmd needs a shell, which splits arguments on spaces, so quote them there.
    const args = ['--yes', 'wrangler@4.93.0', 'd1', 'execute', db, '-c', config, where_db, '--json', '--command', sql].map((a) => (WIN && /[\s,()*>=]/.test(a) ? `"${a}"` : a))
    const raw = execFileSync(WIN ? 'npx.cmd' : 'npx', args, {
        cwd: fileURLToPath(new URL('..', import.meta.url)), encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, shell: WIN,
    })
    return JSON.parse(raw.slice(raw.indexOf('[')))[0].results
}

const rows = []
for (let offset = 0; ; offset += PAGE) {
    const page = query(`SELECT ${COLUMNS.join(', ')} FROM events ${where ? `WHERE ${where}` : ''} ORDER BY student_id, session_id, seq LIMIT ${PAGE} OFFSET ${offset}`)
    rows.push(...page)
    if (page.length < PAGE) break
}

// Order sessions by when they started, so each student's sessions read in time order.
const start = new Map()
for (const r of rows) if (!start.has(r.session_id) || r.client_ts < start.get(r.session_id)) start.set(r.session_id, r.client_ts)
rows.sort((a, b) => a.student_id.localeCompare(b.student_id) || start.get(a.session_id).localeCompare(start.get(b.session_id)) || a.seq - b.seq)

const csvCell = (v) => (v === null || v === undefined ? '' : /[",\r\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v))
const toCsv = (cols, list) => [cols.join(','), ...list.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\r\n') + '\r\n'

const sessions = []
for (const r of rows) {
    let s = sessions.at(-1)
    if (!s || s.session_id !== r.session_id) sessions.push(s = { student_id: r.student_id, session_id: r.session_id, started: r.client_ts, ended: r.client_ts, events: 0, names: [] })
    s.ended = r.client_ts
    s.events += 1
    if (!(['scroll', 'click'].includes(r.event) && s.names.at(-1) === r.event)) s.names.push(r.event)
}

mkdirSync(out, { recursive: true })
writeFileSync(join(out, 'events.csv'), toCsv(COLUMNS, rows))
writeFileSync(join(out, 'sequences.csv'), toCsv(['student_id', 'session_id', 'started', 'ended', 'events', 'sequence'], sessions.map((s) => ({ ...s, sequence: s.names.join('>') }))))
console.log(`exported ${rows.length} events in ${sessions.length} sessions from ${new Set(rows.map((r) => r.student_id)).size} students -> ${out}`)
