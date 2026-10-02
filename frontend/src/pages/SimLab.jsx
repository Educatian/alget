import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CheckCircle2, CircleHelp, FlaskConical, LifeBuoy } from 'lucide-react'
import UnityLabFrame from '../components/UnityLabFrame'
import { computeLabProgress } from '../lib/labProgress'
import { SIM_LAB_TIME, SIM_LABS, getSimLab } from '../lib/simLabs'
import { loadLabChoice, loadSavedLabEvents, recordLabCompleted, recordLabStuck, saveLabChoice } from '../lib/simLabStore'
import '../index.css'

const HELP_AFTER_MS = 10 * 60 * 1000
const RESEARCH_EMAIL = 'seabu@crimson.ua.edu' // Stephen handles lab support

function Shell({ children, onBack, backLabel }) {
    return (
        <div className="editorial-shell min-h-screen">
            <header className="sticky top-0 z-40 border-b border-[var(--ath-line)] bg-[rgba(248,246,241,0.84)] backdrop-blur-2xl">
                <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
                    <div className="flex items-center gap-3">
                        <FlaskConical className="h-6 w-6 text-[var(--ath-primary)]" aria-hidden="true" />
                        <h1 className="text-xl font-semibold tracking-tight text-[var(--ath-primary-deep)]">Simulation Lab</h1>
                    </div>
                    <button onClick={onBack} className="editorial-button-secondary flex items-center gap-2 px-4 py-2 text-sm">
                        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {backLabel}
                    </button>
                </div>
            </header>
            <main className="mx-auto max-w-7xl px-6 py-10 lg:px-8">{children}</main>
        </div>
    )
}

function LabChooser() {
    const navigate = useNavigate()
    const [current, setCurrent] = useState(null)
    useEffect(() => { loadLabChoice().then(setCurrent) }, [])

    // The lab page records the choice when it opens (only if it changed).
    const choose = (lab) => navigate(`/sim-lab/${lab.id}`)

    return (
        <Shell onBack={() => navigate('/learn')} backLabel="Back to courses">
            <p className="editorial-kicker">Choose one lab</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--ath-text)]">Pick the simulation you want to explore</h2>
            <p className="mt-3 max-w-3xl text-[var(--ath-muted)]">
                You only need to complete <strong>one</strong> of these four labs. Each one asks you to predict, test, and
                improve a bio-inspired design over a few trials. {SIM_LAB_TIME}
            </p>
            <div className="mt-8 grid gap-5 md:grid-cols-2">
                {SIM_LABS.map((lab) => (
                    <div key={lab.id} className={`editorial-surface flex flex-col p-6 ${lab.id === current ? 'ring-2 ring-[var(--ath-primary)]' : ''}`}>
                        <div className="flex items-start justify-between gap-3">
                            <h3 className="text-xl font-semibold text-[var(--ath-text)]">{lab.title}</h3>
                            {lab.id === current && <span className="editorial-pill text-xs">Your lab</span>}
                        </div>
                        <p className="mt-2 flex-1 text-[var(--ath-muted)]">{lab.tagline}</p>
                        <p className="mt-3 text-sm text-[var(--ath-secondary)]">{lab.requiredTrials} {lab.trialWord}s to complete</p>
                        <button onClick={() => choose(lab)} className="editorial-button mt-5 w-fit px-5 py-2.5 text-sm">
                            {lab.id === current ? 'Continue this lab' : 'Choose this lab'} <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </button>
                    </div>
                ))}
            </div>
        </Shell>
    )
}

function HelpPanel({ lab, onClose }) {
    return (
        <div role="dialog" aria-label="Help with this lab" className="editorial-surface border-l-4 border-[var(--ath-primary)] p-5">
            <div className="flex items-start justify-between gap-4">
                <h3 className="flex items-center gap-2 text-lg font-semibold"><LifeBuoy className="h-5 w-5" aria-hidden="true" /> Need a hand?</h3>
                <button onClick={onClose} className="text-sm text-[var(--ath-muted)] hover:underline">Close</button>
            </div>
            <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-[var(--ath-text)]">
                {lab.steps.map((step) => <li key={step}>{step}</li>)}
            </ol>
            <p className="mt-3 text-sm text-[var(--ath-muted)]">
                The lab&apos;s own <strong>?</strong> button replays its guided tour. If the lab will not load or nothing happens
                when you click, try the lab&apos;s Fullscreen button, reload this page, or choose a different lab. Still stuck? Email
                the research team at <a className="font-semibold underline" href={`mailto:${RESEARCH_EMAIL}`}>{RESEARCH_EMAIL}</a> with your Study ID.
            </p>
        </div>
    )
}

function LabRunner({ lab }) {
    const navigate = useNavigate()
    const [events, setEvents] = useState([])
    const [loaded, setLoaded] = useState(false)
    const [showHelp, setShowHelp] = useState(false)
    const [dismissedDone, setDismissedDone] = useState(false)
    const completionLogged = useRef(false)

    useEffect(() => {
        let active = true
        loadLabChoice().then((previous) => { if (active && previous !== lab.id) saveLabChoice(lab.id, previous) })
        loadSavedLabEvents(lab.simId).then((saved) => {
            if (!active) return
            // A completion reached on an earlier visit was already recorded then.
            completionLogged.current = computeLabProgress(saved, lab.requiredTrials).complete
            setEvents((live) => [...saved, ...live])
            setLoaded(true)
        })
        return () => { active = false }
    }, [lab])

    const progress = useMemo(() => computeLabProgress(events, lab.requiredTrials), [events, lab.requiredTrials])
    const onEvent = useCallback((event) => setEvents((prev) => [...prev, event]), [])

    // Record completion once, when it is first reached.
    useEffect(() => {
        if (!loaded || !progress.complete || completionLogged.current) return
        completionLogged.current = true
        recordLabCompleted(lab, progress)
    }, [loaded, progress, lab])

    // Offer help if no trial has been run 10 minutes after opening.
    const noTrialsYet = progress.trialsDone === 0
    useEffect(() => {
        if (!noTrialsYet) return undefined
        const timer = setTimeout(() => setShowHelp(true), HELP_AFTER_MS)
        return () => clearTimeout(timer)
    }, [noTrialsYet])

    const next = progress.complete
        ? 'Requirement met. You can keep experimenting or move on.'
        : progress.needsVariedDesigns
            ? `You have run ${progress.trialsDone} ${lab.trialWord}s with the same settings. Change at least one setting, predict, and run one more.`
            : progress.trialsDone === 0
                ? `Next: follow the steps under "Before you start", choose your prediction, then run ${lab.trialWord} 1.`
                : `Next: change one setting, choose your prediction, then run ${lab.trialWord} ${Math.min(progress.trialsDone + 1, progress.required)}.`

    return (
        <Shell onBack={() => navigate('/sim-lab')} backLabel="All labs">
            <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
                <div className="space-y-5">
                    <div>
                        <p className="editorial-kicker">Your lab</p>
                        <h2 className="mt-1 text-3xl font-semibold tracking-tight">{lab.title}</h2>
                        <p className="mt-2 text-[var(--ath-muted)]">{lab.tagline}</p>
                    </div>

                    <div role="status" className="editorial-surface flex flex-wrap items-center gap-3 p-4">
                        {progress.complete
                            ? <CheckCircle2 className="h-5 w-5 text-[var(--ath-primary)]" aria-hidden="true" />
                            : <FlaskConical className="h-5 w-5 text-[var(--ath-secondary)]" aria-hidden="true" />}
                        <span className="font-semibold">
                            {lab.title}: {Math.min(progress.trialsDone, progress.required)} of {progress.required} {lab.trialWord}s done
                        </span>
                        <span className="text-sm text-[var(--ath-muted)]">{next}</span>
                    </div>

                    {progress.complete && !dismissedDone && (
                        <div className="editorial-surface border-l-4 border-[var(--ath-primary)] p-5">
                            <h3 className="flex items-center gap-2 text-lg font-semibold">
                                <CheckCircle2 className="h-5 w-5 text-[var(--ath-primary)]" aria-hidden="true" />
                                Lab complete: you have met the requirement for {lab.title}.
                            </h3>
                            <p className="mt-2 text-sm text-[var(--ath-text)]">
                                You ran {progress.trialsDone} {lab.trialWord}s
                                {progress.designsKnown ? ` and tried ${progress.distinctDesigns} different designs` : ''}.
                                {progress.predictionsCompared > 0 && ` Your prediction matched the result in ${progress.predictionsMatched} of ${progress.predictionsCompared}.`}
                                {' '}{progress.goalMet
                                    ? 'Your best design met the goal.'
                                    : 'Your designs have not met the goal yet, and that is fine: completing the trials is what counts.'}
                            </p>
                            <div className="mt-4 flex flex-wrap gap-3">
                                <button onClick={() => navigate('/learn')} className="editorial-button px-5 py-2.5 text-sm">
                                    Continue to the next part <ArrowRight className="h-4 w-4" aria-hidden="true" />
                                </button>
                                <button onClick={() => setDismissedDone(true)} className="editorial-button-secondary px-5 py-2.5 text-sm">
                                    Keep experimenting (optional)
                                </button>
                            </div>
                        </div>
                    )}

                    {showHelp && <HelpPanel lab={lab} onClose={() => setShowHelp(false)} />}

                    <UnityLabFrame
                        sectionId={lab.sectionId}
                        simId={lab.simId}
                        source={lab.source}
                        src={lab.url}
                        title={lab.title}
                        onEvent={onEvent}
                    />
                </div>

                <aside className="space-y-5">
                    <div className="editorial-surface p-5">
                        <h3 className="text-lg font-semibold">Before you start</h3>
                        <p className="mt-2 text-sm"><strong>Goal:</strong> {lab.goal}</p>
                        <p className="mt-2 text-sm"><strong>To complete:</strong> run {lab.requiredTrials} {lab.trialWord}s and try at least two
                            different designs. Reaching the goal is not required.</p>
                        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-[var(--ath-text)]">
                            {lab.steps.map((step) => <li key={step}>{step}</li>)}
                        </ol>
                        <p className="mt-3 text-xs text-[var(--ath-muted)]">{SIM_LAB_TIME}</p>
                    </div>
                    <button
                        onClick={() => { setShowHelp(true); recordLabStuck(lab, progress, 'button') }}
                        className="editorial-button-secondary flex w-full items-center justify-center gap-2 px-4 py-3 text-sm"
                    >
                        <CircleHelp className="h-4 w-4" aria-hidden="true" /> I&apos;m stuck
                    </button>
                    <button onClick={() => navigate('/sim-lab')} className="w-full text-sm text-[var(--ath-muted)] underline-offset-4 hover:underline">
                        Choose a different lab
                    </button>
                </aside>
            </div>
        </Shell>
    )
}

export default function SimLab() {
    const { labId } = useParams()
    const navigate = useNavigate()
    const lab = labId ? getSimLab(labId) : null
    useEffect(() => { if (labId && !lab) navigate('/sim-lab', { replace: true }) }, [labId, lab, navigate])
    if (labId && lab) return <LabRunner key={lab.id} lab={lab} />
    return <LabChooser />
}
