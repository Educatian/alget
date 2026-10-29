import { useMemo, useState } from 'react'

/**
 * "Class analytics" tab of the instructor dashboard (sites with the analytics feature): eight class-level
 * views from educational data science, drawn as plain SVG. `overview` is /instructor/overview, `analytics`
 * is /instructor/analytics. Every chart has a hover tooltip and a table view.
 */

// Sequential blue ramp (light -> dark) for magnitude; roster colours for section status.
const BLUE = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#2a78d6', '#1c5cab', '#104281']
const SERIES = ['#2a78d6', '#eb6834', '#1baf7a'] // categorical slots 1-3, fixed order
const STATUS_FILL = { done: '#10b981', working: '#fcd34d', reading: '#bae6fd' }
const INK = 'var(--ath-text)'
const MUTED = 'var(--ath-muted)'
const GRID = 'var(--ath-line)'

const shortSection = (id) => String(id || '').split('/').slice(-2).map(Number).join('.')
const pct = (v) => (v == null ? '–' : `${Math.round(v * 100)}%`)
const seq = (v) => BLUE[Math.min(BLUE.length - 1, Math.max(0, Math.round(v * (BLUE.length - 1))))]
const median = (xs) => {
    const s = [...xs].sort((a, b) => a - b)
    return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null
}
const quantile = (s, q) => s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))]

function useTip() {
    const [tip, setTip] = useState(null)
    const bind = (lines) => ({
        onMouseMove: (e) => {
            const box = e.currentTarget.ownerSVGElement?.parentElement?.getBoundingClientRect() || e.currentTarget.getBoundingClientRect()
            setTip({ x: e.clientX - box.left, y: e.clientY - box.top, lines })
        },
        onMouseLeave: () => setTip(null),
    })
    return [tip, bind]
}

function Tip({ tip }) {
    if (!tip) return null
    return (
        <div className="pointer-events-none absolute z-10 max-w-[18rem] rounded-lg border border-[var(--ath-line)] bg-[var(--ath-panel)] px-2.5 py-1.5 text-xs text-[var(--ath-text)] shadow-lg"
            style={{ left: Math.min(tip.x + 12, 9999), top: tip.y + 12 }}>
            {tip.lines.map((l, i) => <div key={i} className={i === 0 ? 'font-semibold' : 'text-[var(--ath-muted)]'}>{l}</div>)}
        </div>
    )
}

function ChartCard({ title, read, children, table, wide = false }) {
    const [showTable, setShowTable] = useState(false)
    return (
        <section className={`rounded-2xl border border-[var(--ath-line)] bg-[var(--ath-panel)] p-4 ${wide ? 'lg:col-span-2' : ''}`}>
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h3 className="text-sm font-semibold text-[var(--ath-text)]">{title}</h3>
                    <p className="mt-0.5 text-xs leading-5 text-[var(--ath-muted)]">{read}</p>
                </div>
                {table && (
                    <button type="button" aria-pressed={showTable} onClick={() => setShowTable((v) => !v)}
                        className="shrink-0 rounded-lg border border-[var(--ath-line)] px-2 py-1 text-xs font-medium text-[var(--ath-text)] hover:bg-[var(--ath-background)]">
                        {showTable ? 'Chart' : 'Table'}
                    </button>
                )}
            </div>
            <div className="relative mt-3">{showTable ? <DataTable {...table} /> : children}</div>
        </section>
    )
}

function DataTable({ head, rows }) {
    return (
        <div className="max-h-80 overflow-auto rounded-lg border border-[var(--ath-line)]">
            <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-[var(--ath-panel)] text-[var(--ath-muted)]"><tr>{head.map((h) => <th key={h} className="px-2 py-1.5 font-medium">{h}</th>)}</tr></thead>
                <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-[var(--ath-line)] text-[var(--ath-text)]">{r.map((c, j) => <td key={j} className="px-2 py-1">{c}</td>)}</tr>)}</tbody>
            </table>
        </div>
    )
}

const Empty = ({ children = 'Not enough activity yet.' }) => <p className="py-10 text-center text-sm text-[var(--ath-muted)]">{children}</p>

function Legend({ items }) {
    return (
        <div className="mt-2 flex flex-wrap gap-3 text-xs text-[var(--ath-muted)]">
            {items.map(([label, color, kind]) => (
                <span key={label} className="flex items-center gap-1.5">
                    {kind === 'line' ? <span className="h-0.5 w-4 rounded" style={{ background: color }} /> : <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: color }} />}
                    {label}
                </span>
            ))}
        </div>
    )
}

/* 1. Progress funnel: for each section, how many students are done, working, reading. */
function Funnel({ overview }) {
    const [tip, bind] = useTip()
    const total = overview.students.length
    const rows = overview.sections.map((s, i) => {
        const st = overview.students.map((x) => x.sections[i])
        return { id: s.id, title: s.title, done: st.filter((v) => v === 'done').length, working: st.filter((v) => v === 'working').length, reading: st.filter((v) => v === 'reading').length }
    })
    const W = 600, ROW = 22, L = 44, R = 40
    const H = rows.length * ROW + 24
    const x = (n) => L + (total ? (n / total) * (W - L - R) : 0)
    return (
        <ChartCard title="Progress through the course" read="Students in each section by status. Where the bars shorten is where the class thins out."
            table={{ head: ['Section', 'Done', 'Working', 'Reading', 'Not started'], rows: rows.map((r) => [`${shortSection(r.id)} ${r.title}`, r.done, r.working, r.reading, total - r.done - r.working - r.reading]) }}>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Students per section by status">
                {[0, 0.5, 1].map((f) => (
                    <g key={f}>
                        <line x1={x(f * total)} x2={x(f * total)} y1={0} y2={H - 18} stroke={GRID} />
                        <text x={x(f * total)} y={H - 4} fontSize="10" fill={MUTED} textAnchor="middle">{Math.round(f * total)}</text>
                    </g>
                ))}
                {rows.map((r, i) => {
                    const y = i * ROW + 3
                    let at = 0
                    return (
                        <g key={r.id}>
                            <text x={L - 8} y={y + 12} fontSize="11" fill={INK} textAnchor="end">{shortSection(r.id)}</text>
                            {['done', 'working', 'reading'].map((k) => {
                                const w = x(at + r[k]) - x(at)
                                const rect = r[k] > 0 && <rect key={k} x={x(at) + (at ? 1 : 0)} y={y} width={Math.max(0, w - (at ? 1 : 0) - 1)} height={ROW - 6} rx="3" fill={STATUS_FILL[k]}
                                    {...bind([`${shortSection(r.id)} ${r.title}`, `${r[k]} ${k}`])} />
                                at += r[k]
                                return rect
                            })}
                            <text x={x(at) + 6} y={y + 12} fontSize="10" fill={MUTED}>{r.done + r.working + r.reading}</text>
                        </g>
                    )
                })}
            </svg>
            <Legend items={[['Done', STATUS_FILL.done], ['Working', STATUS_FILL.working], ['Reading', STATUS_FILL.reading]]} />
            <Tip tip={tip} />
        </ChartCard>
    )
}

/* 2. Student x section heatmap of first-try accuracy. */
function Heatmap({ overview, analytics, onStudent }) {
    const [tip, bind] = useTip()
    const cells = new Map(analytics.heat.map((c) => [`${c.student}|${c.section}`, c]))
    const students = overview.students.filter((s) => s.items_answered > 0).map((s) => s.id)
    if (!students.length) return <ChartCard title="First-try accuracy by student and section" read=""><Empty /></ChartCard>
    const W = 600, L = 64, T = 22, CW = (W - L - 8) / overview.sections.length, CH = 14
    const H = T + students.length * CH + 4
    return (
        <ChartCard title="First-try accuracy by student and section" read="Darker is more correct on the first try; blank means no practice yet. Click a row to open that student."
            table={{ head: ['Student', ...overview.sections.map((s) => shortSection(s.id))], rows: students.map((id) => [id, ...overview.sections.map((s) => pct(cells.get(`${id}|${s.id}`)?.accuracy))]) }}>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Heatmap of first-try accuracy">
                {overview.sections.map((s, j) => <text key={s.id} x={L + j * CW + CW / 2} y={T - 8} fontSize="10" fill={MUTED} textAnchor="middle">{shortSection(s.id)}</text>)}
                {students.map((id, i) => (
                    <g key={id} className="cursor-pointer" onClick={() => onStudent(id)}>
                        <text x={L - 6} y={T + i * CH + CH - 4} fontSize="10" fill={INK} textAnchor="end">{id}</text>
                        {overview.sections.map((s, j) => {
                            const c = cells.get(`${id}|${s.id}`)
                            return <rect key={s.id} x={L + j * CW + 1} y={T + i * CH + 1} width={CW - 2} height={CH - 2} rx="2"
                                fill={c ? seq(c.accuracy) : 'transparent'} stroke={c ? 'none' : GRID}
                                {...bind([`${id} · ${shortSection(s.id)} ${s.title}`, c ? `${pct(c.accuracy)} first try (${c.tries} item${c.tries === 1 ? '' : 's'})` : 'No practice yet'])} />
                        })}
                    </g>
                ))}
            </svg>
            <div className="mt-2 flex items-center gap-2 text-xs text-[var(--ath-muted)]">0%<span className="flex">{BLUE.map((c) => <span key={c} className="h-2.5 w-5" style={{ background: c }} />)}</span>100%</div>
            <Tip tip={tip} />
        </ChartCard>
    )
}

/* 3. Item analysis: difficulty (share correct on first try) against discrimination (point-biserial). */
function ItemAnalysis({ analytics }) {
    const [tip, bind] = useTip()
    const items = analytics.items.filter((it) => it.difficulty != null)
    const W = 600, H = 300, L = 44, B = 36, T = 10, R = 12
    const x = (p) => L + p * (W - L - R)
    const y = (d) => T + (1 - (d + 0.5) / 1.5) * (H - T - B)
    const review = (it) => it.difficulty > 0.9 || it.difficulty < 0.3 || (it.discrimination != null && it.discrimination < 0.2)
    return (
        <ChartCard title="Item analysis" read="Each dot is a practice question. Right = easier; up = better at separating stronger from weaker students. Orange dots are worth a look: too easy, too hard, or weak at telling students apart."
            table={{ head: ['Section', 'Question', 'Students', 'Difficulty (p)', 'Discrimination'], rows: items.map((it) => [shortSection(it.section), it.stem, it.n, it.difficulty, it.discrimination ?? '–']) }}>
            {!items.length ? <Empty /> : (
                <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Item difficulty against discrimination">
                    <rect x={x(0.3)} y={y(1)} width={x(0.9) - x(0.3)} height={y(0.2) - y(1)} fill="rgba(42,120,214,0.06)" />
                    {[0, 0.25, 0.5, 0.75, 1].map((p) => (
                        <g key={p}><line x1={x(p)} x2={x(p)} y1={T} y2={H - B} stroke={GRID} /><text x={x(p)} y={H - B + 14} fontSize="10" fill={MUTED} textAnchor="middle">{p}</text></g>
                    ))}
                    {[-0.5, 0, 0.5, 1].map((d) => (
                        <g key={d}><line x1={L} x2={W - R} y1={y(d)} y2={y(d)} stroke={GRID} /><text x={L - 6} y={y(d) + 3} fontSize="10" fill={MUTED} textAnchor="end">{d}</text></g>
                    ))}
                    <line x1={L} x2={W - R} y1={y(0.2)} y2={y(0.2)} stroke={MUTED} strokeDasharray="4 3" />
                    <text x={W - R - 2} y={y(0.2) - 4} fontSize="10" fill={MUTED} textAnchor="end">0.2: weak below</text>
                    <text x={(x(0.3) + x(0.9)) / 2} y={y(1) + 12} fontSize="10" fill={MUTED} textAnchor="middle">healthy zone</text>
                    <text x={(L + W - R) / 2} y={H - 4} fontSize="11" fill={INK} textAnchor="middle">Difficulty: share correct on first try</text>
                    <text x={12} y={(T + H - B) / 2} fontSize="11" fill={INK} textAnchor="middle" transform={`rotate(-90 12 ${(T + H - B) / 2})`}>Discrimination</text>
                    {items.map((it) => (
                        <circle key={it.id} cx={x(it.difficulty)} cy={y(it.discrimination ?? 0)} r="5.5" fill={review(it) ? SERIES[1] : SERIES[0]} stroke="var(--ath-panel)" strokeWidth="2"
                            opacity={it.discrimination == null ? 0.45 : 1}
                            {...bind([`${shortSection(it.section)} · ${it.stem}`, `p = ${it.difficulty}, discrimination ${it.discrimination ?? 'n/a (too few students)'}`, `${it.n} students`])} />
                    ))}
                </svg>
            )}
            <Legend items={[['Looks fine', SERIES[0]], ['Worth a look', SERIES[1]]]} />
            <Tip tip={tip} />
        </ChartCard>
    )
}

/* 4. Learning curve: error rate on students' practice items in the order they did them, in groups of three. */
function LearningCurve({ analytics }) {
    const [tip, bind] = useTip()
    const pts = (analytics.curve || []).filter((p) => p.n >= 3)
    const W = 600, H = 240, L = 44, B = 36, T = 14, R = 16
    const x = (i) => L + (pts.length > 1 ? i / (pts.length - 1) : 0.5) * (W - L - R)
    const y = (e) => T + (1 - e) * (H - T - B)
    const label = (p) => `${p.from}–${p.to}`
    return (
        <ChartCard title="Learning curve" read="Error rate on first tries, by how far into the practice each student was (their items 1–3, 4–6, ...). A falling line means students make fewer first-try errors as they practise."
            table={{ head: ['Practice items', 'Error rate', 'First tries'], rows: pts.map((p) => [label(p), pct(p.error_rate), p.n]) }}>
            {pts.length < 2 ? <Empty /> : (
                <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="First-try error rate over practice">
                    {[0, 0.25, 0.5, 0.75, 1].map((e) => (
                        <g key={e}><line x1={L} x2={W - R} y1={y(e)} y2={y(e)} stroke={GRID} /><text x={L - 6} y={y(e) + 3} fontSize="10" fill={MUTED} textAnchor="end">{Math.round(e * 100)}%</text></g>
                    ))}
                    {pts.map((p, i) => (i % Math.ceil(pts.length / 8) === 0 || i === pts.length - 1) && <text key={p.group} x={x(i)} y={H - B + 14} fontSize="10" fill={MUTED} textAnchor="middle">{label(p)}</text>)}
                    <text x={(L + W - R) / 2} y={H - 4} fontSize="11" fill={INK} textAnchor="middle">Each student's practice items, in the order done</text>
                    <polyline points={pts.map((p, i) => `${x(i)},${y(p.error_rate)}`).join(' ')} fill="none" stroke={SERIES[0]} strokeWidth="2" strokeLinejoin="round" />
                    {pts.map((p, i) => (
                        <g key={p.group}>
                            <circle cx={x(i)} cy={y(p.error_rate)} r="4.5" fill={SERIES[0]} stroke="var(--ath-panel)" strokeWidth="2" />
                            <circle cx={x(i)} cy={y(p.error_rate)} r="12" fill="transparent" {...bind([`Items ${label(p)}`, `${pct(p.error_rate)} wrong on the first try`, `${p.n} first tries`])} />
                        </g>
                    ))}
                    <text x={x(0) + 8} y={y(pts[0].error_rate) - 8} fontSize="10" fill={INK}>{pct(pts[0].error_rate)}</text>
                    <text x={x(pts.length - 1) - 8} y={y(pts.at(-1).error_rate) - 8} fontSize="10" fill={INK} textAnchor="end">{pct(pts.at(-1).error_rate)}</text>
                </svg>
            )}
            <Tip tip={tip} />
        </ChartCard>
    )
}

/* 5. Help seeking against performance, one dot per student, split at the class medians. */
function HelpSeeking({ analytics, onStudent }) {
    const [tip, bind] = useTip()
    const pts = analytics.help.filter((h) => h.items > 0)
    const W = 600, H = 300, L = 44, B = 36, T = 10, R = 12
    const maxH = Math.max(1, ...pts.map((p) => p.hints_per_item))
    const x = (h) => L + (h / maxH) * (W - L - R)
    const y = (a) => T + (1 - a) * (H - T - B)
    const mx = median(pts.map((p) => p.hints_per_item)) ?? 0
    const my = median(pts.map((p) => p.accuracy)) ?? 0.5
    const corner = [
        ['Few hints, accurate', L + 6, T + 12, 'start'],
        ['Many hints, accurate', W - R - 6, T + 12, 'end'],
        ['Few hints, struggling: may avoid help', L + 6, H - B - 6, 'start'],
        ['Many hints, struggling', W - R - 6, H - B - 6, 'end'],
    ]
    return (
        <ChartCard title="Help seeking and performance" read="Each dot is a student: hints opened per practice item against first-try accuracy. Lines are class medians. Bottom-left students struggle without asking for help. Click a dot to open that student."
            table={{ head: ['Student', 'Items', 'First-try accuracy', 'Hints per item', 'AI hints'], rows: pts.map((p) => [p.student, p.items, pct(p.accuracy), p.hints_per_item, p.ai_hints]) }}>
            {!pts.length ? <Empty /> : (
                <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Hints per item against first-try accuracy">
                    {[0, 0.5, 1].map((a) => <g key={a}><line x1={L} x2={W - R} y1={y(a)} y2={y(a)} stroke={GRID} /><text x={L - 6} y={y(a) + 3} fontSize="10" fill={MUTED} textAnchor="end">{Math.round(a * 100)}%</text></g>)}
                    {[0, maxH / 2, maxH].map((h) => <text key={h} x={x(h)} y={H - B + 14} fontSize="10" fill={MUTED} textAnchor="middle">{h.toFixed(1)}</text>)}
                    <line x1={x(mx)} x2={x(mx)} y1={T} y2={H - B} stroke={MUTED} strokeDasharray="4 3" />
                    <line x1={L} x2={W - R} y1={y(my)} y2={y(my)} stroke={MUTED} strokeDasharray="4 3" />
                    {corner.map(([t, cx, cy, a]) => <text key={t} x={cx} y={cy} fontSize="10" fill={MUTED} textAnchor={a}>{t}</text>)}
                    <text x={(L + W - R) / 2} y={H - 4} fontSize="11" fill={INK} textAnchor="middle">Hints opened per practice item</text>
                    <text x={12} y={(T + H - B) / 2} fontSize="11" fill={INK} textAnchor="middle" transform={`rotate(-90 12 ${(T + H - B) / 2})`}>First-try accuracy</text>
                    {pts.map((p) => (
                        <circle key={p.student} cx={x(p.hints_per_item)} cy={y(p.accuracy)} r="5.5" fill={SERIES[0]} stroke="var(--ath-panel)" strokeWidth="2" className="cursor-pointer"
                            onClick={() => onStudent(p.student)} {...bind([p.student, `${pct(p.accuracy)} first try over ${p.items} items`, `${p.hints_per_item} hints per item (${p.ai_hints} AI)`])} />
                    ))}
                </svg>
            )}
            <Tip tip={tip} />
        </ChartCard>
    )
}

/* 6. Engagement over time: daily active students, and when in the week the class works. */
function Engagement({ analytics }) {
    const [tip, bind] = useTip()
    const days = new Map()
    const grid = Array.from({ length: 7 }, () => Array(24).fill(0))
    for (const r of analytics.hourly) {
        const d = new Date(`${r.h}:00:00Z`)
        if (Number.isNaN(d.getTime())) continue
        const key = d.toLocaleDateString('en-CA')
        days.set(key, (days.get(key) || new Set()).add(r.student_id))
        grid[d.getDay()][d.getHours()] += r.n
    }
    const today = new Date()
    const series = Array.from({ length: 21 }, (_, i) => {
        const d = new Date(today)
        d.setDate(d.getDate() - (20 - i))
        const key = d.toLocaleDateString('en-CA')
        return { key, label: d.toLocaleDateString([], { month: 'short', day: 'numeric' }), n: days.get(key)?.size || 0 }
    })
    const maxN = Math.max(1, ...series.map((s) => s.n))
    const maxCell = Math.max(1, ...grid.flat())
    const W = 1200, H1 = 150, L = 30, B = 22, T = 8, R = 6
    const bw = (W - L - R) / series.length
    const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const CW = (W - L - R) / 24, CH = 18, H2 = 7 * CH + 20
    return (
        <ChartCard wide title="Engagement over time" read="Top: students active each day (last 3 weeks). Bottom: when the class works, by weekday and hour in your time zone; darker is busier."
            table={{ head: ['Day', 'Active students'], rows: series.map((s) => [s.label, s.n]) }}>
            <svg viewBox={`0 0 ${W} ${H1}`} className="w-full" role="img" aria-label="Active students per day">
                {[0, maxN].map((v) => <g key={v}><line x1={L} x2={W - R} y1={T + (1 - v / maxN) * (H1 - T - B)} y2={T + (1 - v / maxN) * (H1 - T - B)} stroke={GRID} /><text x={L - 4} y={T + (1 - v / maxN) * (H1 - T - B) + 3} fontSize="10" fill={MUTED} textAnchor="end">{v}</text></g>)}
                {series.map((s, i) => {
                    const h = (s.n / maxN) * (H1 - T - B)
                    return (
                        <g key={s.key}>
                            {s.n > 0 && <rect x={L + i * bw + 1} y={H1 - B - h} width={bw - 2} height={h} rx="3" fill={SERIES[0]} {...bind([s.label, `${s.n} active student${s.n === 1 ? '' : 's'}`])} />}
                            {i % 2 === 0 && <text x={L + i * bw + bw / 2} y={H1 - 6} fontSize="10" fill={MUTED} textAnchor="middle">{s.label}</text>}
                        </g>
                    )
                })}
            </svg>
            <svg viewBox={`0 0 ${W} ${H2}`} className="mt-3 w-full" role="img" aria-label="Activity by weekday and hour">
                {DAYS.map((d, i) => (
                    <g key={d}>
                        <text x={L - 4} y={i * CH + CH - 4} fontSize="10" fill={MUTED} textAnchor="end">{d}</text>
                        {grid[i].map((n, h) => <rect key={h} x={L + h * CW + 1} y={i * CH + 1} width={CW - 2} height={CH - 2} rx="2" fill={n ? seq(n / maxCell) : 'transparent'} stroke={n ? 'none' : GRID}
                            {...bind([`${d} ${h}:00–${h + 1}:00`, `${n} recorded actions`])} />)}
                    </g>
                ))}
                {[0, 6, 12, 18].map((h) => <text key={h} x={L + h * CW + CW / 2} y={7 * CH + 14} fontSize="10" fill={MUTED} textAnchor="middle">{h === 0 ? '12 AM' : h === 12 ? '12 PM' : h < 12 ? `${h} AM` : `${h - 12} PM`}</text>)}
            </svg>
            <Tip tip={tip} />
        </ChartCard>
    )
}

/* 7. Distributions across students: first-try accuracy and active minutes. */
function Histogram({ values, bins, label, unit, bind }) {
    const W = 280, H = 150, L = 24, B = 30, T = 8, R = 4
    const counts = bins.slice(0, -1).map((lo, i) => values.filter((v) => v >= lo && (i === bins.length - 2 ? v <= bins[i + 1] : v < bins[i + 1])).length)
    const max = Math.max(1, ...counts)
    const bw = (W - L - R) / counts.length
    return (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={label}>
            <line x1={L} x2={W - R} y1={H - B} y2={H - B} stroke={GRID} />
            <text x={L - 4} y={T + 8} fontSize="10" fill={MUTED} textAnchor="end">{max}</text>
            {counts.map((c, i) => {
                const h = (c / max) * (H - T - B)
                return c > 0 && <rect key={i} x={L + i * bw + 1} y={H - B - h} width={bw - 2} height={h} rx="3" fill={SERIES[0]} {...bind([`${bins[i]}–${bins[i + 1]}${unit}`, `${c} student${c === 1 ? '' : 's'}`])} />
            })}
            {[0, Math.floor(counts.length / 2), counts.length].map((i) => <text key={i} x={L + i * bw} y={H - B + 12} fontSize="10" fill={MUTED} textAnchor="middle">{bins[i]}{unit}</text>)}
            <text x={(L + W - R) / 2} y={H - 2} fontSize="11" fill={INK} textAnchor="middle">{label}</text>
        </svg>
    )
}

function Distributions({ overview }) {
    const [tip, bind] = useTip()
    const started = overview.students.filter((s) => s.status !== 'not_started')
    const acc = started.map((s) => s.practice_first_try_accuracy).filter((v) => v != null)
    const minutes = started.map((s) => s.active_minutes || 0)
    const maxMin = Math.max(60, Math.ceil(Math.max(0, ...minutes) / 30) * 30)
    const step = maxMin / 8
    return (
        <ChartCard title="Spread across students" read="How first-try accuracy and active time are distributed among students who have started. A long left tail in accuracy is the group to reach."
            table={{ head: ['Student', 'First-try accuracy', 'Active minutes'], rows: started.map((s) => [s.id, s.practice_first_try_accuracy == null ? '–' : `${s.practice_first_try_accuracy}%`, s.active_minutes || 0]) }}>
            {!started.length ? <Empty /> : (
                <div className="grid grid-cols-2 gap-3">
                    <Histogram values={acc} bins={[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]} label="First-try accuracy" unit="%" bind={bind} />
                    <Histogram values={minutes} bins={Array.from({ length: 9 }, (_, i) => Math.round(i * step))} label="Active minutes" unit=" min" bind={bind} />
                </div>
            )}
            <p className="mt-1 text-xs text-[var(--ath-muted)]">Median: {median(acc) == null ? '–' : `${Math.round(median(acc))}%`} first try · {median(minutes) == null ? '–' : Math.round(median(minutes))} active minutes</p>
            <Tip tip={tip} />
        </ChartCard>
    )
}

/* 8. Concept mastery: spread of each student's estimated mastery, as a compact box per concept. */
function Mastery({ analytics }) {
    const [tip, bind] = useTip()
    const rows = analytics.concepts.filter((c) => c.values.length >= 2)
    const W = 1200, ROW = 18, L = 190, R = 16, T = 4
    const H = T + rows.length * ROW + 22
    const x = (p) => L + p * (W - L - R)
    return (
        <ChartCard wide title="Concept mastery across the class" read="Estimated mastery for each concept (the reader's knowledge-tracing estimate). The box spans the middle half of students, the tick is the median, the line runs from lowest to highest."
            table={{ head: ['Concept', 'Students', 'Median', 'Lowest', 'Highest'], rows: rows.map((c) => [c.concept.replace(/_/g, ' '), c.values.length, pct(median(c.values)), pct(c.values[0]), pct(c.values.at(-1))]) }}>
            {!rows.length ? <Empty /> : (
                <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Mastery spread per concept">
                    {[0, 0.25, 0.5, 0.75, 1].map((p) => <g key={p}><line x1={x(p)} x2={x(p)} y1={T} y2={H - 18} stroke={GRID} /><text x={x(p)} y={H - 4} fontSize="10" fill={MUTED} textAnchor="middle">{Math.round(p * 100)}%</text></g>)}
                    {rows.map((c, i) => {
                        const y = T + i * ROW + ROW / 2
                        const q1 = quantile(c.values, 0.25), q3 = quantile(c.values, 0.75), m = median(c.values)
                        const lines = [c.concept.replace(/_/g, ' '), `median ${pct(m)}, middle half ${pct(q1)}–${pct(q3)}`, `${c.values.length} students`]
                        return (
                            <g key={c.concept} {...bind(lines)}>
                                <text x={L - 8} y={y + 3} fontSize="10" fill={INK} textAnchor="end">{c.concept.replace(/_/g, ' ')}</text>
                                <rect x={L} y={y - ROW / 2} width={W - L - R} height={ROW} fill="transparent" />
                                <line x1={x(c.values[0])} x2={x(c.values.at(-1))} y1={y} y2={y} stroke={BLUE[3]} strokeWidth="1.5" />
                                <rect x={x(q1)} y={y - 5} width={Math.max(2, x(q3) - x(q1))} height="10" rx="3" fill={BLUE[1]} stroke={BLUE[4]} />
                                <line x1={x(m)} x2={x(m)} y1={y - 6} y2={y + 6} stroke={BLUE[6]} strokeWidth="2.5" />
                            </g>
                        )
                    })}
                </svg>
            )}
            <Tip tip={tip} />
        </ChartCard>
    )
}

export default function ClassAnalytics({ overview, analytics, error, onStudent }) {
    const ready = useMemo(() => Boolean(overview && analytics), [overview, analytics])
    if (error) return <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">Could not load class analytics ({error}).</p>
    if (!ready) return <p className="py-8 text-center text-sm text-[var(--ath-muted)]">Loading class analytics…</p>
    return (
        <div className="grid gap-4 lg:grid-cols-2">
            <Funnel overview={overview} />
            <Heatmap overview={overview} analytics={analytics} onStudent={onStudent} />
            <ItemAnalysis analytics={analytics} />
            <LearningCurve analytics={analytics} />
            <HelpSeeking analytics={analytics} onStudent={onStudent} />
            <Distributions overview={overview} />
            <Engagement analytics={analytics} />
            <Mastery analytics={analytics} />
        </div>
    )
}
