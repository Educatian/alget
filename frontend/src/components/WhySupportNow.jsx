import { useMemo, useState } from 'react'

// Human-readable affordances for the policy reason_codes. The backend emits the
// machine codes (server.py); this lexicon renders each as a short learner-facing
// "why this fired" line. Unknown codes degrade to a humanized fallback so a new
// backend code never breaks the panel.
const REASON_CODE_AFFORDANCES = {
    unit_mismatch: 'A unit or definition mismatch showed up, so a direct concept repair was prioritized.',
    idle_reengagement: 'You paused for a while, so this is a lighter way back into the work.',
    low_mastery: 'Mastery here is still below the fluent-application band.',
    high_friction: 'Recent stuck moments and wrong attempts pointed to real friction.',
    retrieval_risk: 'This concept is at risk of fading, so a retrieval-supportive move was chosen.',
    calibration_gap: 'Your confidence and your accuracy were drifting apart.',
    misconception_pattern: 'The same misconception kept recurring, so the frame is being corrected.',
    annotation_friction: 'Your reading annotations carried question or confusion signals.',
    artifact_quality_gap: 'Your work-product trace was still thin, so unsupported advancement was held back.',
    artifact_annotation_momentum: 'Your annotations and artifact revisions showed enough momentum to push forward.',
    transfer_ready: 'Transfer readiness is strong, so an application-oriented move was favored.',
    balanced_profile: 'No single risk dominated, so the best overall move was chosen.',
}

// Evidence-snapshot keys worth surfacing to the learner, with the formatting
// each value should use. Anything not listed is ignored so the panel stays
// focused and is robust to snapshot shape drift.
const EVIDENCE_LABELS = [
    { key: 'average_mastery', label: 'Average mastery', kind: 'percent' },
    { key: 'forgetting_risk', label: 'Forgetting risk', kind: 'percent' },
    { key: 'calibration_drift', label: 'Calibration drift', kind: 'percent' },
    { key: 'transfer_readiness', label: 'Transfer readiness', kind: 'percent' },
    { key: 'artifact_quality', label: 'Artifact quality', kind: 'percent' },
    { key: 'artifact_gap', label: 'Artifact gap', kind: 'percent' },
    { key: 'annotation_friction', label: 'Annotation friction', kind: 'percent' },
    { key: 'predicted_next_correct', label: 'Predicted next success', kind: 'percent' },
]

function humanizeCode(code) {
    return String(code || '').replace(/_/g, ' ')
}

function affordanceFor(code) {
    return REASON_CODE_AFFORDANCES[code] || `Signal: ${humanizeCode(code)}.`
}

function formatEvidenceValue(value, kind) {
    if (value === null || value === undefined) return null
    if (kind === 'percent') {
        const numeric = Number(value)
        if (!Number.isFinite(numeric)) return null
        return `${Math.round(numeric * 100)}%`
    }
    return String(value)
}

/**
 * WhySupportNow renders an auditable, learner-facing explanation of a fired
 * support recommendation: the reason_codes as readable affordances and the
 * evidence snapshot the policy used. It also lets the learner contest or accept
 * the support, wiring the explicit accepted/declined signal the policy persists.
 *
 * decision is the recommendation object returned by the policy endpoint. It is
 * tolerant of either a flat shape (decision_id/reason_codes/evidence_snapshot)
 * or the full adaptive-recommendation shape (client_trace_id + reasoning.*),
 * and renders nothing when no recommendation is present.
 */
export default function WhySupportNow({ decision, onResolve }) {
    const [resolved, setResolved] = useState(null)

    const model = useMemo(() => {
        if (!decision) return null
        const reasoning = decision.reasoning || {}
        const decisionId = decision.decision_id || decision.client_trace_id || decision.trace_id || null
        const reasonCodes = decision.reason_codes || reasoning.reason_codes || []
        const evidenceSnapshot = decision.evidence_snapshot || reasoning.evidence_snapshot || {}
        const primaryAction = decision.primary_recommendation?.action || decision.chosen_action || decision.action || null
        const confidence = Number(reasoning.confidence ?? decision.confidence ?? 0)
        return { decisionId, reasonCodes, evidenceSnapshot, primaryAction, confidence }
    }, [decision])

    if (!model) return null

    const { decisionId, reasonCodes, evidenceSnapshot, primaryAction, confidence } = model

    const evidenceRows = EVIDENCE_LABELS
        .map((entry) => ({ ...entry, value: formatEvidenceValue(evidenceSnapshot[entry.key], entry.kind) }))
        .filter((entry) => entry.value !== null)

    const resolve = (accepted) => {
        setResolved(accepted ? 'accepted' : 'declined')
        onResolve?.({ accepted, decisionId, action: primaryAction })
    }

    return (
        <section className="mt-5 rounded-[1.2rem] border border-[rgba(15,81,103,0.18)] bg-[rgba(200,226,236,0.22)] p-4" aria-label="Why this support now">
            <div className="flex items-center justify-between gap-3">
                <p className="editorial-label">Why this support now</p>
                {confidence > 0 && (
                    <span className="editorial-chip">{Math.round(confidence * 100)}% confidence</span>
                )}
            </div>

            {reasonCodes.length > 0 ? (
                <ul className="mt-3 space-y-2">
                    {reasonCodes.map((code) => (
                        <li key={code} className="flex items-start gap-2 text-xs leading-6 text-[var(--ath-text)]">
                            <span className="mt-0.5 rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--ath-primary)]">
                                {humanizeCode(code)}
                            </span>
                            <span>{affordanceFor(code)}</span>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="mt-3 text-xs leading-6 text-[var(--ath-secondary)]">
                    This support was chosen from your overall learner and artifact evidence.
                </p>
            )}

            {evidenceRows.length > 0 && (
                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-[var(--ath-muted)]">
                    {evidenceRows.map((entry) => (
                        <div key={entry.key} className="rounded-lg border border-[var(--ath-line)] bg-white/70 px-2.5 py-1.5">
                            <p className="font-semibold text-[var(--ath-text)]">{entry.label}</p>
                            <p className="mt-0.5">{entry.value}</p>
                        </div>
                    ))}
                </div>
            )}

            {resolved ? (
                <p className="mt-3 text-xs font-semibold text-[var(--ath-primary)]">
                    {resolved === 'accepted'
                        ? 'Thanks. This support is marked as useful for you.'
                        : 'Noted. We logged that this support did not fit, which helps tune future suggestions.'}
                </p>
            ) : (
                <div className="mt-4 flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={() => resolve(true)}
                        className="editorial-button px-3 py-2 text-xs"
                    >
                        This fits, keep it
                    </button>
                    <button
                        type="button"
                        onClick={() => resolve(false)}
                        className="editorial-button-secondary px-3 py-2 text-xs"
                    >
                        Contest this support
                    </button>
                </div>
            )}
        </section>
    )
}
