import { useEffect, useState } from 'react'
import { CheckCircle2, Circle, ExternalLink, Lock } from 'lucide-react'
import { getStudySteps, markStepDone, STEP_IDS } from '../lib/studySteps'
import { logEvent } from '../lib/loggingService'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

const RESEARCH_EMAIL = 'seabu@crimson.ua.edu'

function formatDate(iso) {
    try {
        return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    } catch {
        return ''
    }
}

// Whether this participant has completed a Simulation Lab (recorded by SimLab.jsx).
function useLabCompleted(enabled) {
    const [completed, setCompleted] = useState(false)
    useEffect(() => {
        if (!enabled || !isSupabaseConfigured) return undefined
        let active = true
        supabase.from('event_logs').select('id').eq('event_type', 'sim_lab_completed').limit(1)
            .then(({ data }) => { if (active) setCompleted((data || []).length > 0) })
            .catch(() => {})
        return () => { active = false }
    }, [enabled])
    return completed
}

export default function StudySteps({ user, needsLab }) {
    const steps = getStudySteps(user)
    const labCompleted = useLabCompleted(Boolean(steps) && needsLab)
    const [opened, setOpened] = useState({})
    const [saving, setSaving] = useState(null)
    const [error, setError] = useState('')

    // Qualtrics sends participants back to /learn?survey_done=<step> when they submit.
    useEffect(() => {
        if (!steps) return
        const params = new URLSearchParams(window.location.search)
        const returned = params.get('survey_done')
        if (!returned) return
        params.delete('survey_done')
        const query = params.toString()
        window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`)
        const step = steps.find((s) => s.id === returned)
        if (STEP_IDS.includes(returned) && step?.unlocked && !step.done) {
            markStepDone(user, returned, 'qualtrics_redirect').catch((err) => setError(err.message))
        }
        // Run once when the page opens with the parameter.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    if (!steps) return null

    const finish = async (stepId) => {
        setSaving(stepId)
        setError('')
        try {
            await markStepDone(user, stepId)
        } catch (err) {
            setError(err.message)
        } finally {
            setSaving(null)
        }
    }

    const allDone = steps.every((s) => s.done)
    const current = steps.find((s) => !s.done)

    return (
        <section aria-labelledby="study-steps-title" className="editorial-surface mt-6 p-6 md:p-8">
            <p className="editorial-kicker">Research study</p>
            <h2 id="study-steps-title" className="mt-2 text-2xl font-semibold tracking-tight text-[var(--ath-text)]">
                {allDone ? 'You have completed the study. Thank you!' : 'Your study steps'}
            </h2>
            {!allDone && (
                <p className="mt-2 text-sm text-[var(--ath-muted)]">
                    Do these in order. Surveys open in a new tab and already include your Study ID.
                </p>
            )}

            <ol className="mt-6 space-y-3">
                {steps.map((step, index) => {
                    const isCurrent = step.id === current?.id
                    const learnBlocked = step.kind === 'learn' && needsLab && !labCompleted
                    return (
                        <li
                            key={step.id}
                            className={`rounded-[1.4rem] border p-4 ${isCurrent ? 'border-[var(--ath-primary)] bg-[var(--ath-panel)]' : 'border-[var(--ath-line)]'}`}
                        >
                            <div className="flex items-start gap-3">
                                <span className="mt-0.5 shrink-0" aria-hidden="true">
                                    {step.done
                                        ? <CheckCircle2 className="h-5 w-5 text-[var(--ath-primary)]" />
                                        : step.unlocked ? <Circle className="h-5 w-5 text-[var(--ath-secondary)]" /> : <Lock className="h-5 w-5 text-[var(--ath-muted)]" />}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="font-semibold text-[var(--ath-text)]">
                                        Step {index + 1}: {step.title}
                                        <span className="ml-2 text-xs font-medium text-[var(--ath-muted)]">
                                            {step.done ? `Done ${formatDate(step.doneAt)}` : step.unlocked ? '' : 'Opens after the previous step'}
                                        </span>
                                    </p>
                                    <p className="mt-1 text-sm text-[var(--ath-muted)]">{step.description}</p>

                                    {step.unlocked && !step.done && step.kind === 'survey' && (
                                        step.url ? (
                                            <div className="mt-3 flex flex-wrap items-center gap-3">
                                                <a
                                                    href={step.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    onClick={() => {
                                                        setOpened((prev) => ({ ...prev, [step.id]: true }))
                                                        logEvent('study_step_opened', step.id, { step: step.id })
                                                    }}
                                                    className="editorial-button px-5 py-2.5 text-sm"
                                                >
                                                    Open {step.title.toLowerCase()} <ExternalLink className="h-4 w-4" aria-hidden="true" />
                                                </a>
                                                {opened[step.id] && (
                                                    <button
                                                        type="button"
                                                        disabled={saving === step.id}
                                                        onClick={() => finish(step.id)}
                                                        className="editorial-button-secondary px-5 py-2.5 text-sm disabled:opacity-60"
                                                    >
                                                        I have submitted it
                                                    </button>
                                                )}
                                            </div>
                                        ) : (
                                            <p className="mt-3 text-sm font-medium text-[var(--ath-secondary)]">
                                                This part is not open yet. We will email you when it is ready.
                                            </p>
                                        )
                                    )}

                                    {step.unlocked && !step.done && step.kind === 'learn' && (
                                        <div className="mt-3">
                                            {learnBlocked && (
                                                <p className="mb-2 text-sm text-[var(--ath-secondary)]">
                                                    Complete one Simulation Lab first (see below), then come back here.
                                                </p>
                                            )}
                                            <button
                                                type="button"
                                                disabled={learnBlocked || saving === step.id}
                                                onClick={() => finish(step.id)}
                                                className="editorial-button-secondary px-5 py-2.5 text-sm disabled:opacity-60"
                                            >
                                                I have finished the learning materials
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </li>
                    )
                })}
            </ol>

            {error && <p role="alert" className="mt-4 text-sm font-medium text-[var(--ath-danger)]">{error}</p>}
            <p className="mt-5 text-xs text-[var(--ath-muted)]">
                Questions or problems? Email <a className="underline" href={`mailto:${RESEARCH_EMAIL}`}>{RESEARCH_EMAIL}</a> with your Study ID.
            </p>
        </section>
    )
}
