import { useId, useMemo, useState } from 'react'
import { evaluateExpression } from './safeEvaluator'

/**
 * ParameterExplorer - a generic live "explore the parameters" widget.
 *
 * Drops into MDX as:
 *   <parameter-explorer config='{
 *     "title": "Projectile range",
 *     "sliders": [
 *       {"name":"v","label":"Launch speed","min":0,"max":50,"step":1,"unit":"m/s","default":20},
 *       {"name":"theta","label":"Launch angle","min":0,"max":90,"step":1,"unit":"deg","default":45},
 *       {"name":"g","label":"Gravity","min":1,"max":20,"step":0.1,"unit":"m/s^2","default":9.8}
 *     ],
 *     "outputs": [
 *       {"label":"Range","unit":"m","expr":"v^2 * sin(2 * theta * 3.14159 / 180) / g"}
 *     ],
 *     "plot": {"x":"theta","output":0}
 *   }' />
 *
 * Pedagogy: lets learners build intuition by manipulating named parameters and
 * watching dependent quantities (and a small plot) respond live. Output
 * expressions are evaluated by a tiny safe arithmetic parser written below -
 * never eval / Function - so author-supplied formulas cannot run arbitrary code.
 *
 * MDX delivers all attribute values as strings, so config is parsed
 * defensively; with no usable config the widget degrades to a short notice.
 */

function safeParse(raw, fallback = null) {
    if (raw == null) return fallback
    if (typeof raw === 'object') return raw
    try {
        return JSON.parse(raw)
    } catch {
        return fallback
    }
}

function formatNumber(value) {
    if (!Number.isFinite(value)) return '--'
    const abs = Math.abs(value)
    if (abs !== 0 && (abs < 1e-3 || abs >= 1e6)) {
        return value.toExponential(3)
    }
    return Number(value.toFixed(4)).toString()
}

function normalizeSliders(rawSliders) {
    if (!Array.isArray(rawSliders)) return []
    return rawSliders
        .map((slider, index) => {
            if (!slider || typeof slider !== 'object') return null
            const name = String(slider.name || slider.var || `x${index}`)
            const min = Number(slider.min ?? 0)
            const max = Number(slider.max ?? 10)
            const step = Number(slider.step ?? 1) || 1
            const def = slider.default ?? slider.value ?? (min + max) / 2
            return {
                name,
                label: String(slider.label || name),
                unit: slider.unit ? String(slider.unit) : '',
                min: Number.isFinite(min) ? min : 0,
                max: Number.isFinite(max) ? max : 10,
                step,
                default: Number.isFinite(Number(def)) ? Number(def) : min,
            }
        })
        .filter(Boolean)
}

function normalizeOutputs(rawOutputs) {
    if (!Array.isArray(rawOutputs)) return []
    return rawOutputs
        .map((output, index) => {
            if (!output || typeof output !== 'object') return null
            const expr = String(output.expr || output.formula || '')
            if (!expr.trim()) return null
            return {
                label: String(output.label || `Output ${index + 1}`),
                unit: output.unit ? String(output.unit) : '',
                expr,
            }
        })
        .filter(Boolean)
}

// Build the small SVG line plot of one output vs one slider variable.
function PlotSvg({ plotOutput, plotVar, sliders, baseScope, descId }) {
    const SAMPLES = 48
    const WIDTH = 320
    const HEIGHT = 180
    const PAD = 28

    const { points, minY, maxY, slider, ok } = useMemo(() => {
        if (!plotOutput || !plotVar) return { points: [], ok: false }
        const sl = sliders.find((s) => s.name === plotVar)
        if (!sl) return { points: [], ok: false }
        const collected = []
        let lo = Infinity
        let hi = -Infinity
        for (let i = 0; i <= SAMPLES; i += 1) {
            const x = sl.min + ((sl.max - sl.min) * i) / SAMPLES
            let y
            try {
                y = evaluateExpression(plotOutput.expr, { ...baseScope, [plotVar]: x })
            } catch {
                y = NaN
            }
            if (Number.isFinite(y)) {
                lo = Math.min(lo, y)
                hi = Math.max(hi, y)
            }
            collected.push({ x, y })
        }
        if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
            return { points: [], ok: false }
        }
        if (lo === hi) {
            lo -= 1
            hi += 1
        }
        return { points: collected, minY: lo, maxY: hi, slider: sl, ok: true }
    }, [plotOutput, plotVar, sliders, baseScope])

    if (!ok) {
        return (
            <p className="text-xs text-[var(--ath-muted)]">
                Plot unavailable for the current configuration.
            </p>
        )
    }

    const scaleX = (x) =>
        PAD + ((x - slider.min) / (slider.max - slider.min || 1)) * (WIDTH - 2 * PAD)
    const scaleY = (y) =>
        HEIGHT - PAD - ((y - minY) / (maxY - minY || 1)) * (HEIGHT - 2 * PAD)

    const path = points
        .filter((p) => Number.isFinite(p.y))
        .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${scaleX(p.x).toFixed(2)} ${scaleY(p.y).toFixed(2)}`)
        .join(' ')

    // Highlight the current slider position on the curve.
    const currentX = baseScope[plotVar]
    let currentY = NaN
    try {
        currentY = evaluateExpression(plotOutput.expr, baseScope)
    } catch {
        currentY = NaN
    }

    const desc =
        `Line plot of ${plotOutput.label} versus ${slider.label}. ` +
        `As ${slider.label} ranges from ${formatNumber(slider.min)} to ${formatNumber(slider.max)} ${slider.unit}, ` +
        `${plotOutput.label} ranges from ${formatNumber(minY)} to ${formatNumber(maxY)} ${plotOutput.unit}. ` +
        `At the current value ${formatNumber(currentX)} ${slider.unit}, ${plotOutput.label} is ${formatNumber(currentY)} ${plotOutput.unit}.`

    return (
        <figure className="m-0">
            <svg
                viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                width="100%"
                preserveAspectRatio="xMidYMid meet"
                role="img"
                aria-labelledby={descId}
                className="max-w-full"
                style={{ height: 'auto', maxHeight: '14rem', display: 'block' }}
            >
                <desc id={descId}>{desc}</desc>
                {/* axes */}
                <line
                    x1={PAD}
                    y1={HEIGHT - PAD}
                    x2={WIDTH - PAD}
                    y2={HEIGHT - PAD}
                    stroke="var(--ath-line, #cbd5e1)"
                    strokeWidth="1"
                />
                <line
                    x1={PAD}
                    y1={PAD}
                    x2={PAD}
                    y2={HEIGHT - PAD}
                    stroke="var(--ath-line, #cbd5e1)"
                    strokeWidth="1"
                />
                <path
                    d={path}
                    fill="none"
                    stroke="var(--ath-primary, #2563eb)"
                    strokeWidth="2"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                />
                {Number.isFinite(currentX) && Number.isFinite(currentY) && (
                    <circle
                        cx={scaleX(currentX)}
                        cy={scaleY(currentY)}
                        r="4"
                        fill="var(--ath-primary, #2563eb)"
                        stroke="white"
                        strokeWidth="1.5"
                    />
                )}
            </svg>
            <figcaption className="mt-1 text-center text-xs text-[var(--ath-muted)]">
                {plotOutput.label} ({plotOutput.unit || 'value'}) vs {slider.label} ({slider.unit || 'value'})
            </figcaption>
        </figure>
    )
}

export default function ParameterExplorer({ config, ...rest }) {
    const { title: propTitle, sliders: propSliders, outputs: propOutputs, plot: propPlot } = rest
    // Allow direct prop usage too (sliders / outputs / plot as separate props).
    const source = useMemo(() => {
        const parsed = safeParse(config, null)
        return (
            parsed || {
                title: propTitle,
                sliders: safeParse(propSliders, propSliders),
                outputs: safeParse(propOutputs, propOutputs),
                plot: safeParse(propPlot, propPlot),
            }
        )
    }, [config, propTitle, propSliders, propOutputs, propPlot])

    const sliders = useMemo(() => normalizeSliders(source?.sliders), [source])
    const outputs = useMemo(() => normalizeOutputs(source?.outputs), [source])
    const title = source?.title ? String(source.title) : 'Explore the parameters'

    const baseId = useId()

    const [values, setValues] = useState(() => {
        const init = {}
        sliders.forEach((slider) => {
            init[slider.name] = slider.default
        })
        return init
    })

    // Which variable drives the plot's x-axis, and which output is plotted.
    const defaultPlotVar = source?.plot?.x || sliders[0]?.name || ''
    const defaultPlotOutputIndex = Number.isFinite(Number(source?.plot?.output))
        ? Number(source.plot.output)
        : 0
    const [plotVar, setPlotVar] = useState(defaultPlotVar)

    const scope = useMemo(() => ({ ...values }), [values])

    const computedOutputs = useMemo(
        () =>
            outputs.map((output) => {
                try {
                    return { ...output, value: evaluateExpression(output.expr, scope), error: null }
                } catch (error) {
                    return { ...output, value: NaN, error: error.message }
                }
            }),
        [outputs, scope]
    )

    if (sliders.length === 0 || outputs.length === 0) {
        return (
            <div
                className="my-6 rounded-2xl border border-[var(--ath-line)] bg-[rgba(255,255,255,0.85)] p-4 text-sm text-[var(--ath-muted)]"
                role="note"
            >
                Parameter explorer is unavailable: a valid configuration with at least one slider
                and one output formula is required.
            </div>
        )
    }

    const plotOutput = computedOutputs[defaultPlotOutputIndex] || computedOutputs[0]

    const handleChange = (name, raw) => {
        const numeric = Number(raw)
        setValues((prev) => ({ ...prev, [name]: Number.isFinite(numeric) ? numeric : prev[name] }))
    }

    const liveSummary = computedOutputs
        .map((output) =>
            output.error
                ? `${output.label}: formula error`
                : `${output.label} is ${formatNumber(output.value)} ${output.unit}`.trim()
        )
        .join('. ')

    return (
        <section
            data-reading-interactive="parameter-explorer"
            className="my-6 w-full max-w-full min-w-0 rounded-2xl border border-[var(--ath-line)] bg-[rgba(255,255,255,0.88)] p-5 shadow-sm"
            aria-labelledby={`${baseId}-title`}
        >
            <h4
                id={`${baseId}-title`}
                className="text-sm font-semibold uppercase tracking-wider text-[var(--ath-primary)]"
            >
                {title}
            </h4>

            <div className="mt-4 grid min-w-0 gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                {/* Sliders */}
                <div className="grid min-w-0 gap-4">
                    {sliders.map((slider) => {
                        const id = `${baseId}-slider-${slider.name}`
                        const value = values[slider.name]
                        const valueText = `${formatNumber(value)}${slider.unit ? ` ${slider.unit}` : ''}`
                        return (
                            <div key={slider.name}>
                                <div className="flex items-baseline justify-between">
                                    <label
                                        htmlFor={id}
                                        className="text-sm font-medium text-[var(--ath-text)]"
                                    >
                                        {slider.label}
                                    </label>
                                    <span className="font-mono text-xs text-[var(--ath-muted)]">
                                        {valueText}
                                    </span>
                                </div>
                                <input
                                    id={id}
                                    type="range"
                                    min={slider.min}
                                    max={slider.max}
                                    step={slider.step}
                                    value={value}
                                    onChange={(event) => handleChange(slider.name, event.target.value)}
                                    aria-valuetext={valueText}
                                    className="mt-2 w-full accent-[var(--ath-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--ath-primary)_45%,transparent)]"
                                />
                                <div className="mt-0.5 flex justify-between text-[10px] text-[var(--ath-muted)]">
                                    <span>{formatNumber(slider.min)}</span>
                                    <span>{formatNumber(slider.max)}</span>
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* Outputs + plot */}
                <div className="grid min-w-0 gap-4">
                    <div className="min-w-0">
                        <p className="editorial-kicker">Live outputs</p>
                        <div role="status" aria-live="polite" aria-atomic="true">
                            <dl className="mt-2 grid min-w-0 gap-2">
                                {computedOutputs.map((output) => (
                                    <div
                                        key={output.label}
                                        className="flex min-w-0 items-baseline justify-between gap-3 rounded-xl bg-[var(--ath-panel)] px-3 py-2"
                                    >
                                        <dt className="min-w-0 text-sm text-[var(--ath-text)]">{output.label}</dt>
                                        <dd className="shrink-0 font-mono text-sm font-semibold text-[var(--ath-primary)]">
                                            {output.error ? (
                                                <span className="text-rose-600">formula error</span>
                                            ) : (
                                                <>
                                                    {formatNumber(output.value)}
                                                    {output.unit ? (
                                                        <span className="ml-1 text-xs font-normal text-[var(--ath-muted)]">
                                                            {output.unit}
                                                        </span>
                                                    ) : null}
                                                </>
                                            )}
                                        </dd>
                                    </div>
                                ))}
                            </dl>
                        </div>
                        {/* Redundant text summary for assistive tech, kept off-screen. */}
                        <p className="sr-only">{liveSummary}</p>
                    </div>

                    {sliders.length > 1 && (
                        <div className="min-w-0">
                            <p
                                id={`${baseId}-plotvar-label`}
                                className="text-xs font-medium text-[var(--ath-muted)]"
                            >
                                Plot against
                            </p>
                            <div
                                role="group"
                                aria-labelledby={`${baseId}-plotvar-label`}
                                className="mt-2 grid min-w-0 gap-1.5 sm:grid-cols-2"
                            >
                                {sliders.map((slider) => (
                                    <button
                                        key={slider.name}
                                        type="button"
                                        onClick={() => setPlotVar(slider.name)}
                                        aria-pressed={plotVar === slider.name}
                                        className={`min-h-10 min-w-0 rounded-lg border px-2.5 py-2 text-left text-xs font-semibold leading-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--ath-primary)_45%,transparent)] ${plotVar === slider.name
                                            ? 'border-[var(--ath-primary)] bg-[color-mix(in_srgb,var(--ath-primary)_12%,white)] text-[var(--ath-primary)]'
                                            : 'border-[var(--ath-line)] bg-white text-[var(--ath-text)] hover:bg-[var(--ath-panel)]'
                                            }`}
                                    >
                                        {slider.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <PlotSvg
                        plotOutput={plotOutput}
                        plotVar={plotVar}
                        sliders={sliders}
                        baseScope={scope}
                        descId={`${baseId}-plotdesc`}
                    />
                </div>
            </div>
        </section>
    )
}
