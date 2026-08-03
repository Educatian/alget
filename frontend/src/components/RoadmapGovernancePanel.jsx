import { useEffect, useState } from 'react'
import {
    createEvaluationManifest,
    createIncident,
    loadRoadmapManifest,
    registerModel,
} from '../lib/roadmapRuntimeService'

const FALLBACK_MANIFEST = {
    roadmap_contract: 'roadmap-runtime-v1',
    horizons: {
        '0-12_months': ['governed_runtime_package', 'evidence_visible_generation', 'human_release_gate'],
        '12-24_months': ['decision_ledger', 'bounded_adaptive_interventions', 'social_outcome_metrics', 'evaluation_manifest'],
        '24-36_months': ['caliper', 'oneroster', 'case', 'model_registry', 'privacy_controls', 'incident_review'],
    },
    high_risk_actions: { publish: 'human_approval', grade: 'human_approval', message: 'human_approval', enroll: 'human_approval', policy_change: 'human_approval' },
}

function Field({ label, value, onChange, ...props }) {
    return <label className="grid gap-1 text-xs font-semibold text-[var(--ath-secondary)]">{label}<input {...props} value={value} onChange={(event) => onChange(event.target.value)} className="editorial-input text-sm" /></label>
}

export default function RoadmapGovernancePanel() {
    const [manifest, setManifest] = useState(FALLBACK_MANIFEST)
    const [status, setStatus] = useState('')
    const [error, setError] = useState('')
    const [model, setModel] = useState({ provider: '', model_id: '', version: '', capabilities: 'tutor,assessment', status: 'draft' })
    const [incident, setIncident] = useState({ course_id: '', severity: 'medium', category: 'unsafe_output', summary: '' })
    const [evaluation, setEvaluation] = useState({ course_id: '', intervention: '', comparison: 'reader only', primary_outcome: 'transfer' })

    useEffect(() => {
        loadRoadmapManifest().then(setManifest).catch(() => setStatus('Preview contract loaded; connect the governed API to manage records.'))
    }, [])

    const run = async (action, success) => {
        setError('')
        setStatus('')
        try {
            await action()
            setStatus(success)
        } catch (nextError) {
            setError(nextError.message || 'The governed API request failed.')
        }
    }

    return <div>
        <div className="mb-5 border-b border-[var(--ath-line)] pb-4">
            <p className="editorial-kicker">ROADMAP GOVERNANCE</p>
            <h2 className="mt-1 text-2xl font-semibold text-[var(--ath-text)]">Evidence, agency, and institutional readiness</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--ath-muted)]">The 1–3 year contracts keep source evidence inspectable, agent decisions reversible, and interoperability and privacy explicit.</p>
        </div>
        {(status || error) && <div role={error ? 'alert' : 'status'} className={`mb-5 border-l-2 px-3 py-2 text-sm ${error ? 'border-[var(--ath-danger)] text-[var(--ath-danger)]' : 'border-[var(--ath-success)] text-[var(--ath-success)]'}`}>{error || status}</div>}

        <div className="grid gap-6 lg:grid-cols-3">
            {Object.entries(manifest.horizons || {}).map(([horizon, items]) => <section key={horizon} className="border-t-2 border-[var(--ath-primary-soft)] pt-3">
                <p className="editorial-label">{horizon.replace('_', ' ')}</p>
                <ul className="mt-3 divide-y divide-[var(--ath-line)] border-y border-[var(--ath-line)]">{items.map((item) => <li key={item} className="py-2 text-sm text-[var(--ath-text)]">{item.replaceAll('_', ' ')}</li>)}</ul>
            </section>)}
        </div>

        <section className="mt-8 border-y border-[var(--ath-line)] py-4">
            <p className="editorial-label">Non-autonomous actions</p>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[var(--ath-text)]">{Object.keys(manifest.high_risk_actions || {}).map((action) => <span key={action} className="border-l-2 border-rose-300 pl-2">{action} · human approval</span>)}</div>
        </section>

        <section className="mt-8 border-b border-[var(--ath-line)] pb-4">
            <p className="editorial-label">Institutional adapters</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-4">
                {[
                    ['LTI 1.3', 'OIDC/JWT validation explicit'],
                    ['Caliper', 'course-scoped events'],
                    ['OneRoster', 'privacy-scoped roster'],
                    ['CASE', 'competency statements'],
                ].map(([name, detail]) => <div key={name} className="border-l-2 border-[var(--ath-primary-soft)] pl-3"><p className="text-sm font-semibold text-[var(--ath-text)]">{name}</p><p className="mt-1 text-xs text-[var(--ath-muted)]">{detail}</p></div>)}
            </div>
        </section>

        <div className="mt-8 grid gap-8 xl:grid-cols-3">
            <form onSubmit={(event) => { event.preventDefault(); run(() => registerModel({ ...model, capabilities: model.capabilities.split(',').map((value) => value.trim()).filter(Boolean) }), 'Model registry record saved.') }} className="grid gap-3">
                <div><p className="editorial-label">Model registry</p><p className="mt-1 text-xs text-[var(--ath-muted)]">Production models require an accountable approver and version.</p></div>
                <Field label="Provider" value={model.provider} onChange={(value) => setModel({ ...model, provider: value })} required placeholder="provider" />
                <Field label="Model ID" value={model.model_id} onChange={(value) => setModel({ ...model, model_id: value })} required placeholder="model-id" />
                <Field label="Version" value={model.version} onChange={(value) => setModel({ ...model, version: value })} required placeholder="version" />
                <Field label="Capabilities, comma separated" value={model.capabilities} onChange={(value) => setModel({ ...model, capabilities: value })} placeholder="tutor,assessment" />
                <button className="editorial-button justify-self-start px-4 py-2 text-sm">Register model</button>
            </form>

            <form onSubmit={(event) => { event.preventDefault(); run(() => createIncident(incident), 'Incident opened and ready for triage.') }} className="grid gap-3">
                <div><p className="editorial-label">Incident review</p><p className="mt-1 text-xs text-[var(--ath-muted)]">Open, triage, contain, and resolve with an auditable timeline.</p></div>
                <Field label="Course ID" value={incident.course_id} onChange={(value) => setIncident({ ...incident, course_id: value })} required placeholder="course-id" />
                <label className="grid gap-1 text-xs font-semibold text-[var(--ath-secondary)]">Severity<select value={incident.severity} onChange={(event) => setIncident({ ...incident, severity: event.target.value })} className="editorial-input text-sm"><option>low</option><option>medium</option><option>high</option><option>critical</option></select></label>
                <Field label="Summary" value={incident.summary} onChange={(value) => setIncident({ ...incident, summary: value })} required placeholder="What happened?" />
                <button className="editorial-button justify-self-start px-4 py-2 text-sm">Open incident</button>
            </form>

            <form onSubmit={(event) => { event.preventDefault(); run(() => createEvaluationManifest({ ...evaluation, secondary_outcomes: ['metacognitive_calibration', 'evidence_alignment'] }), 'Evaluation manifest saved as non-causal until preregistration.') }} className="grid gap-3">
                <div><p className="editorial-label">Pilot evaluation</p><p className="mt-1 text-xs text-[var(--ath-muted)]">Define comparison and outcomes before reporting impact.</p></div>
                <Field label="Course ID" value={evaluation.course_id} onChange={(value) => setEvaluation({ ...evaluation, course_id: value })} required placeholder="course-id" />
                <Field label="Intervention" value={evaluation.intervention} onChange={(value) => setEvaluation({ ...evaluation, intervention: value })} required placeholder="Evidence Trail + tutor" />
                <Field label="Comparison" value={evaluation.comparison} onChange={(value) => setEvaluation({ ...evaluation, comparison: value })} required />
                <Field label="Primary outcome" value={evaluation.primary_outcome} onChange={(value) => setEvaluation({ ...evaluation, primary_outcome: value })} required />
                <button className="editorial-button justify-self-start px-4 py-2 text-sm">Create manifest</button>
            </form>
        </div>
    </div>
}
