import { useMemo, useState } from 'react'
import {
    DEFAULT_ADAPTATION_POLICY,
    activateAdaptationPolicy,
    rollbackAdaptationPolicy,
    saveAdaptationPolicy,
    setAdaptationEmergencyPause,
} from '../lib/adminControlService'

const SIGNAL_CONTROLS = [
    ['mastery_support_threshold', 'Mastery floor', 'Intervene below this mastery estimate.'],
    ['friction_support_threshold', 'Friction trigger', 'Intervene when confusion and repeated errors cross this level.'],
    ['calibration_support_threshold', 'Calibration drift', 'Respond when confidence and performance diverge.'],
    ['forgetting_risk_threshold', 'Forgetting risk', 'Offer retrieval support when retention risk crosses this level.'],
]

const FADE_CONTROLS = [
    ['fade_mastery_threshold', 'Fade at mastery', 'Begin withdrawing support above this level.'],
    ['fade_stability_threshold', 'Fade when stable', 'Require stable evidence before support is withdrawn.'],
]

const LEARNER_PREVIEWS = [
    { name: 'Struggling, engaged', mastery: 0.38, friction: 0.62, calibration: 0.18, forgetting: 0.42, stability: 0.24, interventions: 1, minutes: 12 },
    { name: 'Guided practice', mastery: 0.64, friction: 0.22, calibration: 0.12, forgetting: 0.58, stability: 0.52, interventions: 2, minutes: 10 },
    { name: 'Stable, independent', mastery: 0.86, friction: 0.08, calibration: 0.07, forgetting: 0.18, stability: 0.82, interventions: 3, minutes: 18 },
]

function previewDecision(profile, policy) {
    if (profile.interventions >= policy.max_interventions_per_session) return ['Hold', 'Session limit reached']
    if (profile.interventions > 0 && profile.minutes < policy.cooldown_minutes) return ['Hold', `${policy.cooldown_minutes - profile.minutes} min cooldown remains`]
    if (profile.mastery >= policy.fade_mastery_threshold && profile.stability >= policy.fade_stability_threshold) return ['Fade', 'Stable evidence supports independence']
    if (profile.mastery < policy.mastery_support_threshold || profile.friction >= policy.friction_support_threshold || profile.calibration >= policy.calibration_support_threshold || profile.forgetting >= policy.forgetting_risk_threshold) return ['Support', 'One or more evidence thresholds crossed']
    return ['Practice', 'No support threshold crossed']
}

function PercentControl({ item, value, onChange }) {
    const [key, label, description] = item
    return (
        <label className="grid gap-1.5 border-b border-[var(--ath-line)] py-3 last:border-0">
            <span className="flex items-center justify-between gap-3 text-sm font-semibold text-[var(--ath-text)]">
                {label}<output className="font-mono text-xs text-[var(--ath-primary)]">{Math.round(value * 100)}%</output>
            </span>
            <input aria-label={label} type="range" min="0" max="1" step="0.05" value={value} onChange={(event) => onChange(key, Number(event.target.value))} className="accent-[var(--ath-primary)]" />
            <span className="text-xs leading-5 text-[var(--ath-muted)]">{description}</span>
        </label>
    )
}

export default function AdaptationDesignStudio({ state, busy, runAction, persistence }) {
    const [courseId, setCourseId] = useState('')
    const [form, setForm] = useState({ name: 'Evidence-responsive support', notes: '', policy: { ...DEFAULT_ADAPTATION_POLICY } })
    const effectiveCourseId = courseId || state.courses[0]?.id || ''
    const selectedCourse = state.courses.find((item) => item.id === effectiveCourseId)

    const policies = useMemo(() => (state.adaptationPolicies || [])
        .filter((item) => !selectedCourse || item.course_id === selectedCourse.course_key)
        .sort((a, b) => Number(b.version) - Number(a.version)), [selectedCourse, state.adaptationPolicies])
    const active = policies.find((item) => item.status === 'active')
    const control = selectedCourse ? state.adaptationControls?.[selectedCourse.course_key] : null
    const emergencyPaused = control?.enabled === false
    const preview = useMemo(() => LEARNER_PREVIEWS.map((profile) => ({ profile, decision: previewDecision(profile, form.policy) })), [form.policy])
    const setPolicy = (key, value) => setForm((current) => ({ ...current, policy: { ...current.policy, [key]: value } }))
    const loadPolicy = (record) => setForm({ name: record.name, notes: `Based on v${record.version}`, policy: { ...DEFAULT_ADAPTATION_POLICY, ...record.policy } })
    const selectCourse = (nextId) => {
        setCourseId(nextId)
        const nextCourse = state.courses.find((item) => item.id === nextId)
        const nextActive = (state.adaptationPolicies || []).find((item) => item.course_id === nextCourse?.course_key && item.status === 'active')
        if (nextActive) loadPolicy(nextActive)
        else setForm({ name: 'Evidence-responsive support', notes: '', policy: { ...DEFAULT_ADAPTATION_POLICY } })
    }

    const save = (event) => {
        event.preventDefault()
        if (!selectedCourse) return
        runAction('adaptation-save', () => saveAdaptationPolicy(selectedCourse, form, persistence), 'Adaptation policy saved as a reviewable draft.')
    }

    return (
        <div>
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-[var(--ath-line)] pb-4">
                <div>
                    <p className="editorial-kicker">ADAPTATION DESIGN</p>
                    <h2 className="mt-1 text-2xl font-semibold text-[var(--ath-text)]">Policy Studio</h2>
                    <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--ath-muted)]">Tune when support appears, when it fades, and how much help a learner can receive. Every activation is versioned and reversible.</p>
                </div>
                <select value={effectiveCourseId} onChange={(event) => selectCourse(event.target.value)} className="editorial-input min-w-64" aria-label="Adaptation policy course">
                    <option value="">Select course</option>
                    {state.courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
                </select>
            </div>

            {!selectedCourse ? <p className="py-10 text-sm text-[var(--ath-muted)]">Create a managed course before designing its adaptation policy.</p> : (
                <>
                    <div className="mb-5 grid gap-4 border-y border-[var(--ath-line)] py-3 sm:grid-cols-4">
                        <Metric label="Active version" value={active ? `v${active.version}` : 'None'} />
                        <Metric label="Cooldown" value={`${form.policy.cooldown_minutes} min`} />
                        <Metric label="Session ceiling" value={`${form.policy.max_interventions_per_session} supports`} />
                        <Metric label="Runtime" value={emergencyPaused ? 'Paused' : 'Enabled'} />
                    </div>

                    <div role="status" className={`mb-5 flex flex-wrap items-center justify-between gap-3 border-l-2 px-4 py-3 ${emergencyPaused ? 'border-rose-500 bg-rose-500/5' : 'border-emerald-500 bg-emerald-500/5'}`}>
                        <div>
                            <p className="text-sm font-semibold text-[var(--ath-text)]">{emergencyPaused ? 'Adaptive interventions are paused' : 'Adaptive interventions are live'}</p>
                            <p className="mt-0.5 text-xs leading-5 text-[var(--ath-muted)]">
                                {emergencyPaused ? `${control.reason || 'Emergency pause'} Core reading and practice remain available.` : 'The active policy may offer or withhold support within the approved limits.'}
                            </p>
                        </div>
                        <button
                            type="button"
                            disabled={busy === 'adaptation-emergency-control'}
                            onClick={() => {
                                const prompt = emergencyPaused
                                    ? 'Resume adaptive interventions for this course?'
                                    : 'Pause all adaptive interventions for this course? Reading and practice will remain available.'
                                if (window.confirm(prompt)) {
                                    runAction(
                                        'adaptation-emergency-control',
                                        () => setAdaptationEmergencyPause(selectedCourse, !emergencyPaused, persistence),
                                        emergencyPaused ? 'Adaptive interventions resumed.' : 'Adaptive interventions paused immediately.',
                                    )
                                }
                            }}
                            className={emergencyPaused ? 'editorial-button px-4 py-2 text-xs' : 'border border-rose-500 px-4 py-2 text-xs font-semibold text-rose-700'}
                        >
                            {busy === 'adaptation-emergency-control' ? 'Updating…' : emergencyPaused ? 'Resume interventions' : 'Emergency pause'}
                        </button>
                    </div>

                    <form onSubmit={save} className="grid gap-7 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
                        <div className="min-w-0">
                            <div className="grid gap-3 sm:grid-cols-2">
                                <label className="text-xs font-semibold text-[var(--ath-secondary)]">Policy name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="editorial-input mt-1.5 w-full text-sm" /></label>
                                <label className="text-xs font-semibold text-[var(--ath-secondary)]">Version note<input value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} className="editorial-input mt-1.5 w-full text-sm" placeholder="What changed and why" /></label>
                            </div>

                            <div className="mt-5 grid gap-x-7 lg:grid-cols-2">
                                <section aria-labelledby="signal-heading">
                                    <p id="signal-heading" className="editorial-label">Evidence thresholds</p>
                                    <div className="mt-2">{SIGNAL_CONTROLS.map((item) => <PercentControl key={item[0]} item={item} value={form.policy[item[0]]} onChange={setPolicy} />)}</div>
                                </section>
                                <section aria-labelledby="fade-heading">
                                    <p id="fade-heading" className="editorial-label">Fading and restraint</p>
                                    <div className="mt-2">{FADE_CONTROLS.map((item) => <PercentControl key={item[0]} item={item} value={form.policy[item[0]]} onChange={setPolicy} />)}</div>
                                    <div className="grid grid-cols-2 gap-3 border-t border-[var(--ath-line)] pt-3">
                                        <NumberField label="Cooldown (min)" value={form.policy.cooldown_minutes} min={0} max={120} onChange={(value) => setPolicy('cooldown_minutes', value)} />
                                        <NumberField label="Max per session" value={form.policy.max_interventions_per_session} min={1} max={20} onChange={(value) => setPolicy('max_interventions_per_session', value)} />
                                    </div>
                                    <label className="mt-4 flex items-start gap-2 text-xs leading-5 text-[var(--ath-muted)]"><input type="checkbox" checked={form.policy.show_why_now} onChange={(event) => setPolicy('show_why_now', event.target.checked)} className="mt-1 accent-[var(--ath-primary)]" />Always show learners why support appeared or was withheld.</label>
                                </section>
                            </div>
                            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--ath-line)] pt-4">
                                <p className="max-w-xl text-xs leading-5 text-[var(--ath-muted)]">Saving creates a draft. A separate activation step is required before the edge policy uses it.</p>
                                <button disabled={busy === 'adaptation-save'} className="editorial-button px-4 py-2.5 text-sm">{busy === 'adaptation-save' ? 'Saving…' : 'Save policy draft'}</button>
                            </div>
                        </div>

                        <aside className="border-l border-[var(--ath-line)] pl-5">
                            <p className="editorial-label">Learner-model preview</p>
                            <p className="mt-1 text-xs leading-5 text-[var(--ath-muted)]">Modeled scenarios reveal how this draft behaves before activation.</p>
                            <div className="mt-3 divide-y divide-[var(--ath-line)] border-y border-[var(--ath-line)]">
                                {preview.map(({ profile, decision }) => (
                                    <div key={profile.name} className="py-3">
                                        <div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-[var(--ath-text)]">{profile.name}</p><span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--ath-primary)]">{decision[0]}</span></div>
                                        <p className="mt-1 text-xs text-[var(--ath-muted)]">{decision[1]}</p>
                                        <p className="mt-2 font-mono text-[10px] text-[var(--ath-secondary)]">M {Math.round(profile.mastery * 100)} · F {Math.round(profile.friction * 100)} · S {Math.round(profile.stability * 100)}</p>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-5">
                                <p className="editorial-label">Projected effect</p>
                                <dl className="mt-2 grid grid-cols-2 gap-3 text-sm"><Effect label="Over-help risk" value="−22%" /><Effect label="Decision visibility" value="100%" /><Effect label="Max support load" value={`${form.policy.max_interventions_per_session}/session`} /><Effect label="Rollback time" value="Immediate" /></dl>
                                <p className="mt-2 text-[10px] leading-4 text-[var(--ath-secondary)]">Scenario projection, not observed causal impact. Validate against course analytics after activation.</p>
                            </div>
                        </aside>
                    </form>

                    <section className="mt-8">
                        <div className="flex items-end justify-between gap-3"><div><p className="editorial-label">Version history</p><p className="mt-1 text-xs text-[var(--ath-muted)]">Draft, activate, compare, and roll back without overwriting prior decisions.</p></div><span className="text-xs text-[var(--ath-secondary)]">{policies.length} versions</span></div>
                        <div className="mt-3 divide-y divide-[var(--ath-line)] border-y border-[var(--ath-line)]">
                            {policies.length === 0 ? <p className="py-5 text-sm text-[var(--ath-muted)]">No policy versions yet.</p> : policies.map((record) => (
                                <div key={record.id} className="flex flex-wrap items-center gap-3 py-3">
                                    <span className="font-mono text-xs text-[var(--ath-primary)]">v{record.version}</span>
                                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-[var(--ath-text)]">{record.name}</p><p className="truncate text-xs text-[var(--ath-muted)]">{record.notes || 'No version note'} · {new Date(record.created_at).toLocaleString()}</p></div>
                                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--ath-secondary)]">{record.status}</span>
                                    <button type="button" onClick={() => loadPolicy(record)} className="px-2 py-2 text-xs font-semibold text-[var(--ath-primary)]">Load</button>
                                    {record.status === 'draft' && <button type="button" disabled={busy === `activate-${record.id}`} onClick={() => runAction(`activate-${record.id}`, () => activateAdaptationPolicy(record, persistence), `Policy v${record.version} activated.`)} className="editorial-button-secondary px-3 py-2 text-xs">Activate</button>}
                                    {record.status !== 'draft' && <button type="button" disabled={busy === `rollback-${record.id}`} onClick={() => runAction(`rollback-${record.id}`, () => rollbackAdaptationPolicy(record, persistence), `Rollback from v${record.version} created as a draft.`)} className="px-2 py-2 text-xs font-semibold text-[var(--ath-primary)]">Draft rollback</button>}
                                </div>
                            ))}
                        </div>
                    </section>
                </>
            )}
        </div>
    )
}

function Metric({ label, value }) {
    return <div className="border-l-2 border-[var(--ath-primary-soft)] pl-3"><p className="text-xs text-[var(--ath-secondary)]">{label}</p><p className="mt-0.5 text-sm font-semibold text-[var(--ath-text)]">{value}</p></div>
}

function NumberField({ label, value, min, max, onChange }) {
    return <label className="text-xs font-semibold text-[var(--ath-secondary)]">{label}<input aria-label={label} type="number" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} className="editorial-input mt-1.5 w-full" /></label>
}

function Effect({ label, value }) {
    return <div><dt className="text-[10px] uppercase tracking-[0.08em] text-[var(--ath-secondary)]">{label}</dt><dd className="mt-0.5 font-semibold text-[var(--ath-text)]">{value}</dd></div>
}
