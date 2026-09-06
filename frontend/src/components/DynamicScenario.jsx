import { useMemo, useState } from 'react'
import { ArrowRight, CheckCircle2, Crosshair, RefreshCw, Sparkles } from 'lucide-react'
import { pickScenario } from '../lib/scenarioBank'
import { logEvent } from '../lib/loggingService'
import ParametricSim from './ParametricSim'

function ScenarioVisual({ scenario, topic }) {
    const visual = scenario.visual
    const choices = scenario.choices || []

    return (
        <div
            role="img"
            className="relative flex min-h-[220px] flex-col justify-between gap-6 overflow-hidden rounded-lg border border-[var(--ath-line)] p-4 text-white shadow-inner"
            style={{ background: visual.gradient }}
            aria-label={`${topic} scenario visual: ${visual.motif}`}
        >
            <div className="absolute inset-0 bg-linear-to-t from-black/55 via-black/10 to-transparent" aria-hidden="true" />

            <div className="relative z-10">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/80">{visual.motif}</p>
                <h3 className="mt-2 max-w-[16rem] text-lg font-semibold leading-tight text-white">{scenario.learnerRole}</h3>
            </div>

            <div className="relative z-10 grid grid-cols-3 gap-2">
                {choices.slice(0, 3).map((choice, index) => (
                    <div key={choice.label} className="rounded-md border border-white/25 bg-black/25 p-2 backdrop-blur-sm">
                        <div className="mb-2 flex h-5 w-5 items-center justify-center rounded-full bg-white/90 text-[11px] font-bold" style={{ color: visual.accent }}>
                            {index + 1}
                        </div>
                        <p className="line-clamp-2 text-[11px] font-semibold leading-snug text-white">{choice.label}</p>
                    </div>
                ))}
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

export default function DynamicScenario({ topic, prompt, context, userContext, course = 'bio-inspired', sectionId = null }) {
    const [variant, setVariant] = useState(0)
    const [revealedChoice, setRevealedChoice] = useState(0)
    const resolvedTopic = topic || prompt || 'Applied learning scenario'
    const resolvedContext = context || userContext || prompt || 'General application'
    const result = useMemo(() => (
        pickScenario({ topic: resolvedTopic, context: resolvedContext, course, variant })
    ), [course, resolvedContext, resolvedTopic, variant])

    // Render nothing when no curated case genuinely matches the section. A
    // misleading decorative fallback is worse than no scenario at all.
    if (!result.matched || !result.scenario) {
        return null
    }

    const scenario = result.scenario
    const activeChoice = scenario.choices?.[revealedChoice] || scenario.choices?.[0]

    const refreshScenario = () => {
        logEvent('dynamic_scenario_shuffle', 'dynamic-scenario', {
            course,
            scenario_id: scenario.sim || scenario.id || 'curated',
            next_variant: variant + 1,
        }, sectionId)
        setVariant((value) => value + 1)
        setRevealedChoice(0)
    }

    const handleChoice = (index) => {
        logEvent('dynamic_scenario_choice', 'dynamic-scenario', {
            course,
            scenario_id: scenario.sim || scenario.id || 'curated',
            choice_index: index,
            choice_count: scenario.choices?.length || 0,
            variant,
        }, sectionId)
        setRevealedChoice(index)
    }

    return (
        <section className="not-prose my-8 overflow-hidden rounded-lg border border-[var(--ath-line)] bg-[var(--ath-surface-strong)] shadow-sm">
            <div className="grid gap-0 lg:grid-cols-[0.9fr_1.1fr]">
                <div className="border-b border-[var(--ath-line)] p-4 lg:border-b-0 lg:border-r">
                    {scenario.sim ? (
                        <ParametricSim kind={scenario.sim} />
                    ) : (
                        <ScenarioVisual scenario={scenario} topic={resolvedTopic} />
                    )}
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
                                    onClick={() => handleChoice(index)}
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

                    <div className="rounded-lg border border-[var(--ath-line)] bg-[var(--ath-surface-strong)] p-4" role="status" aria-live="polite">
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
