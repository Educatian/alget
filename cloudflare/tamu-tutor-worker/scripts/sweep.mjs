/**
 * Live evaluation sweep for the deployed tutor (run after the OpenRouter secret is set):
 *   node scripts/sweep.mjs [--base https://alget-tamu-tutor.jewoong-moon.workers.dev] [--out sweep-results.json]
 *
 * Hints: every AI-literacy item x every single wrong pick (rung 1), paced under the per-IP limit.
 * Explain: one passage per section. Writes every response so leaks can also be reviewed by
 * reading (the guard is lexical and can miss a reworded answer).
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { findLeak } from '../src/leakGuard.js'
import { sectionPlainText } from '../src/content.js'

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : fallback }
const BASE = arg('base', 'https://alget-tamu-tutor.jewoong-moon.workers.dev')
const OUT = arg('out', 'sweep-results.json')
const ORIGIN = 'https://tamu-3d-labs.alget-tamu-ai-literacy.pages.dev'
const PACE_MS = 5500 // 12 requests/minute per IP on the worker
const COURSE = fileURLToPath(new URL('../../../frontend/content/ai-literacy/', import.meta.url))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function call(path, body) {
    const started = Date.now()
    const res = await fetch(`${BASE}${path}`, { method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    return { status: res.status, ms: Date.now() - started, body: await res.json().catch(() => null) }
}

const sections = readdirSync(COURSE).filter((d) => /^\d\d$/.test(d)).flatMap((ch) =>
    readdirSync(join(COURSE, ch)).filter((f) => f.endsWith('.mdx')).map((f) => ({ id: `ai-literacy/${ch}/${f.slice(0, 2)}`, dir: join(COURSE, ch), sec: f.slice(0, 2) })))

const results = { base: BASE, at: new Date().toISOString(), hints: [], explains: [] }
for (const s of sections) {
    const { problems } = JSON.parse(readFileSync(join(s.dir, `${s.sec}.practice.json`), 'utf8'))
    for (const p of problems) {
        for (const pick of p.options.map((_, i) => i).filter((i) => i !== p.correct_index)) {
            const r = await call('/hint', { section_id: s.id, problem_id: p.id, rung: 1, picks: [pick] })
            const text = r.body?.hint ? `${r.body.hint} ${r.body.check_question}` : ''
            results.hints.push({ problem: p.id, pick, status: r.status, ms: r.ms, retried: r.body?.retried, error: r.body?.error, hint: r.body?.hint, check: r.body?.check_question, recheck: text ? findLeak(text, p, [pick]) : null })
            process.stdout.write(r.status === 200 ? '.' : `[${r.status}]`)
            await sleep(PACE_MS)
        }
    }
    const paragraph = sectionPlainText(readFileSync(join(s.dir, `${s.sec}.mdx`), 'utf8')).split(/(?<=\.)\s+/).find((x) => x.length > 80)
    const r = await call('/explain', { section_id: s.id, exact: paragraph, mode: 'explain' })
    results.explains.push({ section: s.id, status: r.status, ms: r.ms, quote: paragraph, ...r.body })
    process.stdout.write(r.status === 200 ? 'e' : `[e${r.status}]`)
    await sleep(PACE_MS)
}

const ok = results.hints.filter((h) => h.status === 200)
const ms = ok.map((h) => h.ms).sort((a, b) => a - b)
results.summary = {
    hints: results.hints.length,
    served: ok.length,
    blocked_by_guard: results.hints.filter((h) => h.error === 'guard_blocked').length,
    served_after_retry: ok.filter((h) => h.retried).length,
    leaks_on_recheck: ok.filter((h) => h.recheck).length,
    p95_ms: ms[Math.floor(ms.length * 0.95)] ?? null,
    explains_ok: results.explains.filter((e) => e.status === 200).length,
    explains_out_of_section: results.explains.filter((e) => e.in_section === false).length,
}
writeFileSync(OUT, JSON.stringify(results, null, 2))
console.log(`\n${JSON.stringify(results.summary, null, 2)}\nwrote ${OUT}`)
