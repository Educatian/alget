import { useMemo, useState } from 'react'
import { ArrowRight, CheckCircle2, Crosshair, RefreshCw, Sparkles } from 'lucide-react'
import { pickScenario } from '../lib/scenarioBank'

function scenarioImageUri({ scenario, topic }) {
    const visual = scenario.visual
    const title = String(topic || 'Scenario').replace(/[<>&]/g, '')
    const motif = String(visual.motif || 'case').replace(/[<>&]/g, '')
    const accent = visual.accent || '#0f5167'
    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 420" role="img" aria-label="${title} ${motif}">
            <defs>
                <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="${accent}"/>
                    <stop offset="56%" stop-color="#d8e9ed"/>
                    <stop offset="100%" stop-color="#fff8ed"/>
                </linearGradient>
                <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="16" stdDeviation="18" flood-color="#0f172a" flood-opacity="0.22"/>
                </filter>
            </defs>
            <rect width="720" height="420" rx="28" fill="url(#g)"/>
            <circle cx="610" cy="72" r="120" fill="#ffffff" opacity="0.18"/>
            <circle cx="105" cy="336" r="96" fill="#ffffff" opacity="0.16"/>
            <path d="M78 105 C188 35 252 170 360 96 C468 22 560 78 642 148" fill="none" stroke="#ffffff" stroke-width="12" stroke-linecap="round" opacity="0.4"/>
            <g filter="url(#shadow)">
                <rect x="78" y="92" width="244" height="174" rx="22" fill="#ffffff" opacity="0.92"/>
                <rect x="104" y="122" width="118" height="14" rx="7" fill="${accent}" opacity="0.82"/>
                <rect x="104" y="152" width="176" height="10" rx="5" fill="#64748b" opacity="0.46"/>
                <rect x="104" y="176" width="142" height="10" rx="5" fill="#64748b" opacity="0.34"/>
                <circle cx="268" cy="214" r="28" fill="${accent}" opacity="0.82"/>
                <path d="M256 214 l10 10 l18 -24" fill="none" stroke="#ffffff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
            </g>
            <g filter="url(#shadow)">
                <rect x="376" y="132" width="248" height="194" rx="24" fill="#0f172a" opacity="0.78"/>
                <path d="M420 282 L466 228 L512 252 L580 182" fill="none" stroke="#c8e2ec" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
                <circle cx="466" cy="228" r="13" fill="#facc15"/>
                <circle cx="512" cy="252" r="13" fill="#f97316"/>
                <circle cx="580" cy="182" r="13" fill="#86efac"/>
                <rect x="418" y="164" width="112" height="12" rx="6" fill="#ffffff" opacity="0.82"/>
                <rect x="418" y="190" width="72" height="9" rx="4.5" fill="#ffffff" opacity="0.42"/>
            </g>
            <text x="80" y="348" fill="#ffffff" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="800" letter-spacing="3">${motif.toUpperCase()}</text>
            <text x="80" y="382" fill="#ffffff" font-family="Inter, Arial, sans-serif" font-size="18" font-weight="600" opacity="0.84">${title.slice(0, 42)}</text>
        </svg>
    `
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

function ScenarioVisual({ scenario, topic }) {
    const visual = scenario.visual
    const choices = scenario.choices || []
    const imageSrc = scenarioImageUri({ scenario, topic })

    return (
        <div
            role="img"
            className="relative min-h-[220px] overflow-hidden rounded-lg border border-[var(--ath-line)] bg-slate-900 text-white shadow-inner"
            style={{ background: visual.gradient }}
            aria-label={`${topic} scenario visual`}
        >
            <img src={imageSrc} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-linear-to-t from-black/55 via-black/10 to-transparent" />

            <div className="relative z-10 flex h-full flex-col justify-between gap-8">
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/75">{visual.motif}</p>
                    <h5 className="mt-2 max-w-[15rem] text-lg font-semibold leading-tight text-white">{scenario.learnerRole}</h5>
                </div>

                <div className="grid grid-cols-3 gap-2">
                    {choices.slice(0, 3).map((choice, index) => (
                        <div key={choice.label} className="rounded-md border border-white/25 bg-black/18 p-2 backdrop-blur-sm">
                            <div className="mb-2 flex h-5 w-5 items-center justify-center rounded-full bg-white/90 text-[11px] font-bold" style={{ color: visual.accent }}>
                                {index + 1}
                            </div>
                            <p className="line-clamp-2 text-[11px] font-semibold leading-snug text-white">{choice.label}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

function MiniList({ title, items }) {
    if (!items?.length) return null
    return (
        <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--ath-secondary)]">{title}</p>
            <ul className="mt-2 grid gap-1.5">
                {items.slice(0, 4).map((item) => (
                    <li key={item} className="flex gap-2 text-sm leading-6 text-[var(--ath-muted)]">
                        <CheckCircle2 className="mt-1 h-3.5 w-3.5 shrink-0 text-[var(--ath-primary)]" aria-hidden="true" />
                        <span>{item}</span>
                    </li>
                ))}
            </ul>
        </div>
    )
}

export default function DynamicScenario({ topic, prompt, context, userContext, course = 'bio-inspired' }) {
    const [variant, setVariant] = useState(0)
    const [revealedChoice, setRevealedChoice] = useState(0)
    const resolvedTopic = topic || prompt || 'Applied learning scenario'
    const resolvedContext = context || userContext || prompt || 'General application'
    const scenario = useMemo(() => (
        pickScenario({ topic: resolvedTopic, context: resolvedContext, course, variant })
    ), [course, resolvedContext, resolvedTopic, variant])
    const activeChoice = scenario.choices?.[revealedChoice] || scenario.choices?.[0]

    const refreshScenario = () => {
        setVariant((value) => value + 1)
        setRevealedChoice(0)
    }

    return (
        <section className="not-prose my-8 overflow-hidden rounded-lg border border-[var(--ath-line)] bg-[var(--ath-surface-strong)] shadow-sm">
            <div className="grid gap-0 lg:grid-cols-[0.9fr_1.1fr]">
                <div className="border-b border-[var(--ath-line)] p-4 lg:border-b-0 lg:border-r">
                    <ScenarioVisual scenario={scenario} topic={resolvedTopic} />
                </div>

                <div className="p-5">
                    <div className="flex flex-wrap items-start gap-3">
                        <div className="min-w-0 flex-1">
                            <p className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--ath-secondary)]">
                                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                                Tailored case
                            </p>
                            <h4 className="mt-2 text-xl font-semibold leading-tight text-[var(--ath-text)]">{resolvedTopic}</h4>
                        </div>
                        <button
                            type="button"
                            onClick={refreshScenario}
                            className="inline-flex h-9 items-center gap-2 rounded-full border border-[var(--ath-line)] bg-[var(--ath-panel)] px-3 text-xs font-semibold text-[var(--ath-muted)] transition-colors hover:bg-[var(--ath-panel-muted)] hover:text-[var(--ath-text)]"
                        >
                            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                            Shuffle
                        </button>
                    </div>

                    <div className="mt-4 grid gap-3">
                        <div className="rounded-lg bg-[var(--ath-panel)] p-4">
                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--ath-secondary)]">Scene</p>
                            <p className="mt-2 text-sm leading-6 text-[var(--ath-text)]">{scenario.setting}</p>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                            <div className="rounded-lg border border-[var(--ath-line)] p-4">
                                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--ath-secondary)]">Role</p>
                                <p className="mt-2 text-sm leading-6 text-[var(--ath-text)]">{scenario.learnerRole}</p>
                            </div>
                            <div className="rounded-lg border border-[var(--ath-line)] p-4">
                                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--ath-secondary)]">Friction</p>
                                <p className="mt-2 text-sm leading-6 text-[var(--ath-text)]">{scenario.friction}</p>
                            </div>
                        </div>

                        <div className="rounded-lg border border-[var(--ath-line)] p-4">
                            <div className="flex items-start gap-3">
                                <Crosshair className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ath-primary)]" aria-hidden="true" />
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--ath-secondary)]">Decision point</p>
                                    <p className="mt-2 text-base font-semibold leading-7 text-[var(--ath-text)]">{scenario.decisionPoint}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="border-t border-[var(--ath-line)] bg-[var(--ath-panel)] p-5">
                <div className="grid gap-5 xl:grid-cols-[1fr_1.3fr_1fr]">
                    <MiniList title="Inspect" items={scenario.variables} />

                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--ath-secondary)]">Choose a move</p>
                        <div className="mt-2 grid gap-2">
                            {scenario.choices?.map((choice, index) => (
                                <button
                                    key={choice.label}
                                    type="button"
                                    onClick={() => setRevealedChoice(index)}
                                    className={`group rounded-lg border p-3 text-left transition-colors ${revealedChoice === index
                                        ? 'border-[var(--ath-primary)] bg-[var(--ath-surface-strong)]'
                                        : 'border-[var(--ath-line)] bg-[var(--ath-surface-strong)] hover:border-[var(--ath-line-strong)]'
                                    }`}
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-sm font-semibold text-[var(--ath-text)]">{choice.label}</span>
                                        <ArrowRight className={`h-4 w-4 shrink-0 transition-transform ${revealedChoice === index ? 'translate-x-0 text-[var(--ath-primary)]' : 'text-[var(--ath-secondary)] group-hover:translate-x-0.5'}`} />
                                    </div>
                                    <p className="mt-1 text-xs leading-5 text-[var(--ath-muted)]">{choice.action}</p>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-lg border border-[var(--ath-line)] bg-[var(--ath-surface-strong)] p-4">
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--ath-secondary)]">Feedback</p>
                        <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ath-text)]">{activeChoice?.tradeoff}</p>
                        <p className="mt-2 text-sm leading-6 text-[var(--ath-muted)]">{activeChoice?.feedback}</p>
                    </div>
                </div>

                <div className="mt-5 grid gap-5 border-t border-[var(--ath-line)] pt-5 md:grid-cols-2">
                    <MiniList title="Success criteria" items={scenario.successCriteria} />
                    <MiniList title="Theory moves" items={scenario.theoryMoves} />
                </div>

                {scenario.reflectionPrompt && (
                    <div className="mt-5 rounded-lg border border-[var(--ath-line)] bg-[var(--ath-surface-strong)] p-4">
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--ath-secondary)]">Reflect</p>
                        <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ath-text)]">{scenario.reflectionPrompt}</p>
                    </div>
                )}
            </div>
        </section>
    )
}
