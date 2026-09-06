import { lazy, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Circle, FlaskConical, Save } from 'lucide-react'
import { logSimEvent } from '../lib/simTelemetry'
import { summarizeGuideText } from '../lib/guidedSimulationTelemetry'
import UnityLabFrame from './UnityLabFrame'

const RelativeDensityExplorer = lazy(() => import('./RelativeDensityExplorer'))
const NacreLab = lazy(() => import('./NacreLab'))
const PeelAsymmetryExplorer = lazy(() => import('./PeelAsymmetryExplorer'))
const RibletLab = lazy(() => import('./RibletLab'))
const SerrationOptimizer = lazy(() => import('./SerrationOptimizer'))
const GeckoGripLab = lazy(() => import('./GeckoGripLab'))
const BraggColorDesigner = lazy(() => import('./BraggColorDesigner'))
const StackEffectDesigner = lazy(() => import('./StackEffectDesigner'))
const CapsuleHealingExplorer = lazy(() => import('./CapsuleHealingExplorer'))
const SwarmFlockingLab = lazy(() => import('./SwarmFlockingLab'))

const FIN_GRIP_URL = import.meta.env.VITE_FINGRIP_UNITY_URL || 'https://fingrip-lab-unity.pages.dev/'
const PINE_MORPH_URL = import.meta.env.VITE_PINEMORPH_UNITY_URL || 'https://pinemorph-lab-unity.pages.dev/'
const TRABECULA_URL = import.meta.env.VITE_TRABECULA_UNITY_URL || 'https://trabecula-lab-unity.pages.dev/'

const LABS = Object.freeze({
    'relative-density': {
        simId: 'relative-density',
        title: 'Relative Density Explorer',
        objective: 'Connect relative density to stiffness, strength, and mass before applying the Gibson–Ashby scaling laws.',
        prediction: 'Before moving the slider, predict which will fall faster as relative density decreases: stiffness or strength. State the scaling-law reason.',
        checkpoints: [
            'Test at least three relative-density values, including one below 0.20.',
            'Compare the shape of the stiffness and strength curves.',
            'Identify one design point that balances low mass with acceptable stiffness.',
        ],
        reflection: 'What pattern did the graph make visible that the equations alone did not?',
        transfer: 'Choose a lightweight product and explain how you would set a minimum relative density for it.',
        Lab: RelativeDensityExplorer,
    },
    fingrip: {
        simId: 'fingrip',
        title: 'FinGrip Lab — Compliant Bio-Inspired Gripper',
        objective: 'Translate a biological compliance strategy into an engineering design that balances grasping, damage risk, and manufacturability.',
        prediction: 'Predict how increasing compliance will affect grasp success and object-damage risk. Name the mechanism behind your prediction.',
        checkpoints: [
            'Run a baseline design and record which constraint fails first.',
            'Change one parameter at a time and compare at least two trials.',
            'Create a redesign that improves one outcome without violating another constraint.',
        ],
        reflection: 'Which parameter had the strongest causal effect, and what evidence from two trials supports that claim?',
        transfer: 'How would your design change for a fragile, irregular object rather than the current target?',
        renderLab: (sectionId) => (
            <UnityLabFrame
                sectionId={sectionId}
                simId="fingrip"
                source="FinGripLab"
                src={FIN_GRIP_URL}
                title="FinGrip Lab — Tune a Compliant Bio-Inspired Gripper"
                description="Predict, test, and redesign a compliant gripper while balancing grasp force, damage risk, and manufacturability."
            />
        ),
    },
    trabecula: {
        simId: 'trabecula',
        title: 'Trabecula Lab — Material Along Load Paths',
        objective: 'Relate trabecular orientation, density, and bracing to anisotropy and efficient load transfer.',
        prediction: 'Predict whether density or alignment with the principal load path will matter more for the first design you test. Explain why.',
        checkpoints: [
            'Run the baseline under two different loading directions.',
            'Change orientation while holding density approximately constant.',
            'Find a low-material design that still carries the target load.',
        ],
        reflection: 'How did load direction change the value of the same material layout?',
        transfer: 'Sketch in words how the load-path principle should alter a drone landing strut or bridge member.',
        renderLab: (sectionId) => TRABECULA_URL ? (
            <UnityLabFrame
                sectionId={sectionId}
                simId="trabecula"
                source="TrabeculaLab"
                src={TRABECULA_URL}
                title="Trabecula Lab — Align Material with Load Paths"
                description="Investigate orientation, density, bracing, and loading, then transfer the load-path principle to a new structure."
            />
        ) : <LabUnavailable title="Trabecula Lab" variable="VITE_TRABECULA_UNITY_URL" />,
    },
    nacre: {
        simId: 'nacre',
        title: 'Nacre Toughening Lab',
        objective: 'Examine how weak interfaces and layered geometry can deflect cracks and improve toughness.',
        prediction: 'Predict how changing platelet overlap or interface strength will alter the crack path.',
        checkpoints: ['Run a baseline fracture.', 'Change one interface parameter.', 'Compare toughness and failure path across two designs.'],
        reflection: 'What evidence shows that a weaker interface can sometimes improve system-level toughness?',
        transfer: 'Name a manufactured laminate where controlled crack deflection would be valuable.',
        Lab: NacreLab,
    },
    'peel-asymmetry': {
        simId: 'peel-asymmetry',
        title: 'Peel Asymmetry Explorer',
        objective: 'Connect directional attachment geometry to asymmetric release and secure holding.',
        prediction: 'Predict which loading direction will detach first and identify the geometric reason.',
        checkpoints: ['Test both loading directions.', 'Change the feature angle.', 'Find a design with a large attach–release contrast.'],
        reflection: 'Which variable controlled directional asymmetry most strongly?',
        transfer: 'How could this principle support a reversible medical patch or climbing robot?',
        Lab: PeelAsymmetryExplorer,
    },
    riblet: {
        simId: 'riblet',
        title: 'Riblet Drag-Reduction Lab',
        objective: 'Relate riblet spacing and alignment to near-wall flow and drag reduction.',
        prediction: 'Predict what happens when riblet spacing is much larger than the near-wall vortex scale.',
        checkpoints: ['Run the smooth-surface baseline.', 'Test at least three spacings.', 'Check whether misalignment reverses the benefit.'],
        reflection: 'Why is there an optimum spacing rather than a “more texture is better” rule?',
        transfer: 'How would operating speed change the physical riblet size you select?',
        Lab: RibletLab,
    },
    serration: {
        simId: 'serration',
        title: 'Serration Optimizer',
        objective: 'Explore how trailing-edge geometry trades aerodynamic performance against noise reduction.',
        prediction: 'Predict how deeper serrations will affect noise and aerodynamic cost.',
        checkpoints: ['Run a no-serration baseline.', 'Test two depth–spacing combinations.', 'Identify a Pareto-style compromise rather than a single maximum.'],
        reflection: 'Which tradeoff prevented one design from dominating every outcome?',
        transfer: 'Propose a different design choice for a quiet urban drone versus a utility-scale turbine.',
        Lab: SerrationOptimizer,
    },
    geckogrip: {
        simId: import.meta.env.VITE_GECKOGRIP_UNITY_URL ? 'geckogrip-unity' : 'geckogrip',
        title: 'GeckoGrip Lab — Reversible Dry Adhesion',
        objective: 'Connect hierarchical contact, preload, peel angle, and surface condition to controllable dry adhesion.',
        prediction: 'Predict how preload and peel angle will affect holding force and release. State the contact-mechanics reason.',
        checkpoints: [
            'Test the baseline on both a smooth and a rough surface.',
            'Change one microstructure parameter while holding the others fixed.',
            'Complete a redesign for the rescue-robot constraint set.',
        ],
        reflection: 'Which result challenged a simple “more contact area means more adhesion” explanation?',
        transfer: 'How would you redesign the pad for dusty, curved, or repeatedly used surfaces?',
        Lab: GeckoGripLab,
    },
    'bragg-color': {
        simId: 'bragg-color',
        title: 'Bragg Structural-Color Designer',
        objective: 'Connect periodic structure, refractive index, and viewing conditions to reflected color.',
        prediction: 'Predict how increasing layer spacing will shift the reflected wavelength.',
        checkpoints: ['Run a baseline spectrum.', 'Change spacing only.', 'Compare structural color under a second viewing condition.'],
        reflection: 'What makes structural color different from pigment absorption?',
        transfer: 'Design a sensing application where a color shift reports strain or humidity.',
        Lab: BraggColorDesigner,
    },
    'stack-effect': {
        simId: 'stack-effect',
        title: 'Stack-Effect Designer',
        objective: 'Relate height, temperature difference, and opening area to buoyancy-driven ventilation.',
        prediction: 'Predict which variable will most increase airflow in the first scenario and justify it from the governing equation.',
        checkpoints: ['Run the baseline building.', 'Change one variable at a time.', 'Find a design that improves airflow without exceeding the stated constraint.'],
        reflection: 'Which variable had a nonlinear or unexpectedly limited effect?',
        transfer: 'How would climate and nighttime temperature change your passive-ventilation strategy?',
        Lab: StackEffectDesigner,
    },
    pinemorph: {
        simId: 'pinemorph',
        title: 'PineMorph Lab — Passive Hygromorphic Motion',
        objective: 'Use anisotropic bilayers to explain and design passive motion driven by environmental change.',
        prediction: 'Predict the bending direction when humidity changes. Identify which layer expands more and why.',
        checkpoints: [
            'Run the default bilayer through one environmental cycle.',
            'Change layer orientation or thickness and compare the curvature.',
            'Create a passive response that meets the target direction and response range.',
        ],
        reflection: 'How did boundary conditions or layer orientation alter the same material response?',
        transfer: 'Propose a no-motor ventilation flap or indicator and specify the environmental trigger.',
        renderLab: (sectionId) => (
            <UnityLabFrame
                sectionId={sectionId}
                simId="pinemorph"
                source="pinemorph-lab"
                src={PINE_MORPH_URL}
                title="PineMorph Lab — Design Passive Hygromorphic Motion"
                description="Use pine-cone-inspired bilayers to predict and test passive morphing under environmental constraints."
            />
        ),
    },
    'capsule-healing': {
        simId: 'capsule-healing',
        title: 'Capsule Self-Healing Explorer',
        objective: 'Balance capsule density, healing coverage, and intact-material performance.',
        prediction: 'Predict why continually increasing capsule fraction will eventually harm overall performance.',
        checkpoints: ['Run an unmodified baseline.', 'Test at least three capsule fractions.', 'Find the best compromise under the scenario constraints.'],
        reflection: 'Where did the benefit of added healing capacity begin to level off or reverse?',
        transfer: 'How would expected crack size and location change your capsule design?',
        Lab: CapsuleHealingExplorer,
    },
    swarm: {
        simId: 'swarm',
        title: 'Swarm Flocking Lab',
        objective: 'Relate local alignment, cohesion, and separation rules to emergent group behavior.',
        prediction: 'Predict the group-level pattern produced when cohesion is high but separation is low.',
        checkpoints: ['Observe the baseline swarm.', 'Change only one local rule.', 'Create a stable pattern and then deliberately destabilize it.'],
        reflection: 'Which global behavior emerged without any agent being given a global plan?',
        transfer: 'Which local rules would you prioritize for warehouse robots or disaster-search drones?',
        Lab: SwarmFlockingLab,
    },
})

const EMPTY_STATE = Object.freeze({ prediction: '', reflection: '', transfer: '', checkpoints: [] })

function readSessionState(key) {
    try {
        const parsed = JSON.parse(sessionStorage.getItem(key) || 'null')
        if (!parsed || typeof parsed !== 'object') return { ...EMPTY_STATE }
        return {
            prediction: typeof parsed.prediction === 'string' ? parsed.prediction : '',
            reflection: typeof parsed.reflection === 'string' ? parsed.reflection : '',
            transfer: typeof parsed.transfer === 'string' ? parsed.transfer : '',
            checkpoints: Array.isArray(parsed.checkpoints) ? parsed.checkpoints.filter(Number.isInteger) : [],
        }
    } catch {
        return { ...EMPTY_STATE }
    }
}

function LabUnavailable({ title, variable }) {
    return (
        <div className="my-8 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950" role="status">
            <p className="font-semibold">{title} is staged but not published.</p>
            <p className="mt-2">The instructor must provide the approved WebGL URL through <code>{variable}</code> before learners enter this activity.</p>
        </div>
    )
}

export default function GuidedSimulationLab({ lab, sectionId }) {
    const config = LABS[String(lab || '').toLowerCase()]
    const storageKey = `alget:guided-sim-session:v1:${sectionId}:${config?.simId || lab}`
    const [state, setState] = useState(() => readSessionState(storageKey))

    useEffect(() => {
        try { sessionStorage.setItem(storageKey, JSON.stringify(state)) } catch { /* session-only persistence is best effort */ }
    }, [state, storageKey])

    const completedCheckpoints = useMemo(() => new Set(state.checkpoints), [state.checkpoints])

    if (!config) {
        return <LabUnavailable title={`Unknown simulation: ${lab || 'missing lab id'}`} variable="guided-lab lab" />
    }

    const savePrediction = () => {
        logSimEvent(sectionId, config.simId, 'guide_prediction_saved', summarizeGuideText(state.prediction))
    }
    const saveReflection = () => {
        logSimEvent(sectionId, config.simId, 'guide_reflection_saved', {
            reflection: summarizeGuideText(state.reflection),
            transfer: summarizeGuideText(state.transfer),
            checkpoint_count: completedCheckpoints.size,
            checkpoint_total: config.checkpoints.length,
        })
    }
    const toggleCheckpoint = (index) => {
        const completed = !completedCheckpoints.has(index)
        const next = completed
            ? [...state.checkpoints, index]
            : state.checkpoints.filter((item) => item !== index)
        setState((current) => ({ ...current, checkpoints: next }))
        logSimEvent(sectionId, config.simId, 'guide_checkpoint', {
            checkpoint_index: index + 1,
            completed,
            checkpoint_count: next.length,
            checkpoint_total: config.checkpoints.length,
        })
    }

    const Lab = config.Lab

    return (
        <section className="reading-breakout not-prose my-10 overflow-hidden rounded-[1.75rem] border border-[var(--ath-line)] bg-[var(--ath-panel)] shadow-sm" aria-labelledby={`guided-lab-${config.simId}`}>
            <header className="border-b border-[var(--ath-line)] bg-[linear-gradient(135deg,rgba(30,64,175,0.10),rgba(13,148,136,0.08))] px-5 py-5 sm:px-7">
                <p className="editorial-label flex items-center gap-2 text-[var(--ath-primary)]"><FlaskConical size={16} /> Guided simulation</p>
                <h3 id={`guided-lab-${config.simId}`} className="mt-2 text-xl font-semibold text-[var(--ath-text)]">{config.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--ath-muted)]"><strong>Learning target:</strong> {config.objective}</p>
            </header>

            <div className="space-y-4 px-5 py-5 sm:px-7">
                <label className="block">
                    <span className="font-semibold text-[var(--ath-text)]">1. Predict before running the simulation</span>
                    <span className="mt-1 block text-sm leading-6 text-[var(--ath-muted)]">{config.prediction}</span>
                    <textarea
                        value={state.prediction}
                        onChange={(event) => setState((current) => ({ ...current, prediction: event.target.value }))}
                        rows={3}
                        className="mt-3 w-full rounded-xl border border-[var(--ath-line)] bg-[var(--ath-panel)] p-3 text-sm text-[var(--ath-text)]"
                        placeholder="Write a mechanism-based prediction…"
                    />
                </label>
                <button type="button" onClick={savePrediction} className="inline-flex items-center gap-2 rounded-full bg-[var(--ath-primary)] px-4 py-2 text-sm font-semibold text-white">
                    <Save size={15} /> Save prediction for this session
                </button>
                <p className="text-xs leading-5 text-[var(--ath-muted)]">Your written response stays in this browser tab and clears when the session closes. Research logs receive only completion and length bands, never the response text.</p>
            </div>

            <div className="border-y border-[var(--ath-line)] bg-[var(--ath-panel-muted)] px-5 py-5 sm:px-7">
                <p className="font-semibold text-[var(--ath-text)]">2. Test, observe, and revise</p>
                <div className="mt-3 grid gap-2">
                    {config.checkpoints.map((checkpoint, index) => {
                        const completed = completedCheckpoints.has(index)
                        return (
                            <button key={checkpoint} type="button" onClick={() => toggleCheckpoint(index)} className="flex items-start gap-3 rounded-xl border border-[var(--ath-line)] bg-[var(--ath-panel)] px-4 py-3 text-left text-sm leading-6 text-[var(--ath-text)]" aria-pressed={completed}>
                                {completed ? <CheckCircle2 className="mt-1 shrink-0 text-emerald-600" size={18} /> : <Circle className="mt-1 shrink-0 text-[var(--ath-muted)]" size={18} />}
                                {checkpoint}
                            </button>
                        )
                    })}
                </div>
            </div>

            <div className="px-3 py-1 sm:px-5">
                {config.renderLab ? config.renderLab(sectionId) : <Lab />}
            </div>

            <div className="grid gap-5 border-t border-[var(--ath-line)] px-5 py-5 sm:px-7 lg:grid-cols-2">
                <label className="block">
                    <span className="font-semibold text-[var(--ath-text)]">3. Explain and reflect</span>
                    <span className="mt-1 block text-sm leading-6 text-[var(--ath-muted)]">{config.reflection}</span>
                    <textarea value={state.reflection} onChange={(event) => setState((current) => ({ ...current, reflection: event.target.value }))} rows={4} className="mt-3 w-full rounded-xl border border-[var(--ath-line)] bg-[var(--ath-panel)] p-3 text-sm text-[var(--ath-text)]" placeholder="Claim + evidence from trials + mechanism…" />
                </label>
                <label className="block">
                    <span className="font-semibold text-[var(--ath-text)]">4. Transfer to a new design</span>
                    <span className="mt-1 block text-sm leading-6 text-[var(--ath-muted)]">{config.transfer}</span>
                    <textarea value={state.transfer} onChange={(event) => setState((current) => ({ ...current, transfer: event.target.value }))} rows={4} className="mt-3 w-full rounded-xl border border-[var(--ath-line)] bg-[var(--ath-panel)] p-3 text-sm text-[var(--ath-text)]" placeholder="Apply the principle under new constraints…" />
                </label>
                <div className="lg:col-span-2">
                    <button type="button" onClick={saveReflection} className="inline-flex items-center gap-2 rounded-full bg-[var(--ath-primary)] px-4 py-2 text-sm font-semibold text-white"><Save size={15} /> Save reflection for this session</button>
                </div>
            </div>
        </section>
    )
}
