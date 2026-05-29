import { useMemo, useState } from 'react'
import {
    BarChart3,
    CheckCircle2,
    FileText,
    GitBranch,
    GitCompareArrows,
    Lightbulb,
    Presentation,
    ShieldCheck,
} from 'lucide-react'
import { logEvent } from '../lib/loggingService'
import { getAdaptiveRecommendation, recordAdaptiveSignal } from '../lib/knowledgeService'
import { getArtifactDefinition } from '../lib/artifactTaxonomy'
import API_BASE from '../lib/apiConfig'

const SUPPORT_MOVES = [
    {
        id: 'explain',
        label: 'Explain',
        icon: Lightbulb,
        rationale: 'Chosen when the trace is still thin and the learner needs a bounded concept explanation before revising.',
    },
    {
        id: 'compare',
        label: 'Compare',
        icon: GitCompareArrows,
        rationale: 'Chosen when the learner has evidence but needs to contrast weak and strong artifact decisions.',
    },
    {
        id: 'audit',
        label: 'Audit',
        icon: ShieldCheck,
        rationale: 'Chosen when the trace is mostly complete and the learner needs a final quality or risk check.',
    },
]

const RUBRIC_ROWS = [
    { id: 'claim_visibility', label: 'Claim' },
    { id: 'evidence_specificity', label: 'Evidence' },
    { id: 'support_boundary', label: 'Support Boundary' },
    { id: 'revision_quality', label: 'Revision' },
    { id: 'rejection_rationale', label: 'Rejection' },
    { id: 'transfer_constraint', label: 'Transfer' },
]

const JUDGMENT_OPTIONS = [
    { id: 'accept', label: 'Accept' },
    { id: 'modify', label: 'Modify' },
    { id: 'reject', label: 'Reject' },
    { id: 'defer', label: 'Defer' },
]

const STUDIO_MODES = [
    {
        id: 'storyboard',
        icon: Presentation,
        terms: ['storyboard', 'presentation', 'slide', 'frame', 'narration'],
        title: 'Storyboard Studio',
        evidenceLabel: 'Frame Evidence',
        acceptedLabel: 'Accepted Frame Change',
        rejectedLabel: 'Rejected Layout or Narration',
        prompts: [
            'Which frame carries the main claim?',
            'Which signal, segment, or narration choice changed?',
            'What would a second viewer misunderstand?',
        ],
    },
    {
        id: 'spreadsheet',
        icon: BarChart3,
        terms: ['excel', 'spreadsheet', 'pivot', 'chart', 'data'],
        title: 'Data Story Studio',
        evidenceLabel: 'Data Evidence',
        acceptedLabel: 'Accepted Chart or Table Revision',
        rejectedLabel: 'Rejected Visual Choice',
        prompts: [
            'What is the claim-first title?',
            'Which unit, source note, or grouping supports it?',
            'What chart choice would distort the finding?',
        ],
    },
    {
        id: 'resume',
        icon: FileText,
        terms: ['resume', 'portfolio', 'github pages', 'file tree'],
        title: 'Evidence Checker',
        evidenceLabel: 'Role or Portfolio Evidence',
        acceptedLabel: 'Accepted Wording or Structure',
        rejectedLabel: 'Rejected Overclaim',
        prompts: [
            'Which claim is truthful and role-specific?',
            'Which evidence makes the claim verifiable?',
            'Which AI suggestion would overstate ability?',
        ],
    },
    {
        id: 'policy',
        icon: ShieldCheck,
        terms: ['policy', 'privacy', 'ethobot', 'teachgen', 'tension', 'equity'],
        title: 'Judgment Map',
        evidenceLabel: 'Policy, Transcript, or Equity Evidence',
        acceptedLabel: 'Accepted Judgment Move',
        rejectedLabel: 'Rejected Risky Suggestion',
        prompts: [
            'Which value tension is visible?',
            'Which privacy, equity, or consent condition matters?',
            'What classroom context changes the decision?',
        ],
    },
    {
        id: 'traceability',
        icon: GitBranch,
        terms: ['prototype', 'readme', 'cognitive load', 'usability', 'capstone', 'ai-use'],
        title: 'Traceability Studio',
        evidenceLabel: 'Design Evidence',
        acceptedLabel: 'Accepted Prototype Revision',
        rejectedLabel: 'Rejected Design Suggestion',
        prompts: [
            'Which design decision changed?',
            'Which observation, theory, or rubric line caused it?',
            'Which limitation remains after revision?',
        ],
    },
]

function selectMode(artifact = '') {
    const normalized = artifact.toLowerCase()
    return STUDIO_MODES.find((mode) => mode.terms.some((term) => normalized.includes(term))) || STUDIO_MODES.at(-1)
}

function createSubmissionId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID()
    }
    return `submission-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function fieldMetrics(value = '') {
    const text = String(value || '')
    const words = text.trim() ? text.trim().split(/\s+/).length : 0
    return {
        char_count: text.length,
        word_count: words,
        line_count: text ? text.split(/\r\n|\r|\n/).length : 0,
        present: text.trim().length >= 12,
    }
}

export default function ArtifactStudio({ artifact, course, section, sectionId, conceptIds = [], sectionTitle = '' }) {
    const mode = useMemo(() => selectMode(artifact), [artifact])
    const artifactDefinition = useMemo(() => getArtifactDefinition(artifact), [artifact])
    const submissionSpec = artifactDefinition.submissionSpec
    const ModeIcon = mode.icon
    const [initialDraft, setInitialDraft] = useState('')
    const [claim, setClaim] = useState('')
    const [evidence, setEvidence] = useState('')
    const [accepted, setAccepted] = useState('')
    const [rejected, setRejected] = useState('')
    // AI Feedback Judgment Gate. The judgment starts UNSET so the rationale
    // field stays hidden until the learner makes an explicit accept/modify/
    // reject/defer choice (progressive disclosure against cognitive overload).
    const [judgment, setJudgment] = useState(null)
    const [judgmentRationale, setJudgmentRationale] = useState('')
    const [revisedDraft, setRevisedDraft] = useState('')
    const [transfer, setTransfer] = useState('')
    // supportMove tracks the learner's selected support move. Until the learner
    // explicitly overrides it, it follows the recommended move so the logged
    // value is never frozen to a constant. supportMoveOverridden records whether
    // the learner has made an explicit choice, which we also persist.
    const [selectedSupportMove, setSelectedSupportMove] = useState(null)
    const [supportMoveOverridden, setSupportMoveOverridden] = useState(false)
    const [confidence, setConfidence] = useState(2)
    // BEFORE state: rubric-scored snapshot of the artifact prior to AI-mediated
    // revision. AFTER state lives in `rubric`. The revision delta is derived
    // from the two so the backend policy can read a scored before/after episode.
    const [beforeRubric, setBeforeRubric] = useState(() => RUBRIC_ROWS.reduce((acc, row) => ({ ...acc, [row.id]: 0 }), {}))
    const [rubric, setRubric] = useState(() => RUBRIC_ROWS.reduce((acc, row) => ({ ...acc, [row.id]: 0 }), {}))
    const [revisionScore, setRevisionScore] = useState(null)
    const [adaptiveRecommendation, setAdaptiveRecommendation] = useState(null)
    const [status, setStatus] = useState('idle')
    const [step, setStep] = useState(0)
    const [showRules, setShowRules] = useState(false)

    const traceScore = useMemo(() => {
        return [initialDraft, claim, evidence, accepted, rejected, judgmentRationale, revisedDraft, transfer]
            .filter((value) => value.trim().length >= 12).length
    }, [accepted, claim, evidence, initialDraft, judgmentRationale, rejected, revisedDraft, transfer])

    const artifactQualityScore = useMemo(() => {
        const total = Object.values(rubric).reduce((sum, value) => sum + Number(value || 0), 0)
        return Number((total / (RUBRIC_ROWS.length * 2)).toFixed(3))
    }, [rubric])

    // Scored BEFORE state (pre-revision artifact quality on the same rubric).
    const beforeQualityScore = useMemo(() => {
        const total = Object.values(beforeRubric).reduce((sum, value) => sum + Number(value || 0), 0)
        return Number((total / (RUBRIC_ROWS.length * 2)).toFixed(3))
    }, [beforeRubric])

    // The after-state quality IS the artifact_quality the policy consumes; the
    // gap is its complement. artifactRevisionDelta is the scored before/after
    // movement, broken out per sub-score so the instructor view can audit it.
    const artifactQuality = artifactQualityScore
    const artifactGap = Number(Math.max(0, 1 - artifactQuality).toFixed(3))
    const artifactRevisionDelta = useMemo(() => {
        return Number((artifactQualityScore - beforeQualityScore).toFixed(3))
    }, [artifactQualityScore, beforeQualityScore])
    const rubricDeltas = useMemo(() => {
        return RUBRIC_ROWS.reduce((acc, row) => {
            acc[row.id] = Number(rubric[row.id] || 0) - Number(beforeRubric[row.id] || 0)
            return acc
        }, {})
    }, [beforeRubric, rubric])

    const supportRationale = useMemo(() => {
        if (traceScore <= 3) return SUPPORT_MOVES.find((move) => move.id === 'explain').rationale
        if (traceScore <= 6) return SUPPORT_MOVES.find((move) => move.id === 'compare').rationale
        return SUPPORT_MOVES.find((move) => move.id === 'audit').rationale
    }, [traceScore])

    const recommendedSupportMove = traceScore <= 3 ? 'explain' : traceScore <= 6 ? 'compare' : 'audit'
    // Effective support move: learner override when present, otherwise the
    // recommended move. This replaces the previously frozen 'explain' constant.
    const supportMove = supportMoveOverridden && selectedSupportMove ? selectedSupportMove : recommendedSupportMove
    const completionPercent = Math.round((traceScore / 8) * 100)

    const scoreRevision = async () => {
        const response = await fetch(`${API_BASE}/research/artifact-revision/score`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                course,
                section,
                artifact,
                studio_mode: mode.id,
                initial_draft: initialDraft,
                claim,
                evidence,
                judgment: judgment || 'modify',
                judgment_rationale: judgmentRationale,
                revised_draft: revisedDraft,
                transfer,
            }),
        })

        if (!response.ok) {
            throw new Error(`artifact_revision_score_${response.status}`)
        }

        return response.json()
    }

    const submitTrace = async () => {
        const submissionId = createSubmissionId()
        const sourceTextMetrics = {
            initial_draft: fieldMetrics(initialDraft),
            claim: fieldMetrics(claim),
            evidence: fieldMetrics(evidence),
            accepted: fieldMetrics(accepted),
            rejected: fieldMetrics(rejected),
            judgment_rationale: fieldMetrics(judgmentRationale),
            revised_draft: fieldMetrics(revisedDraft),
            transfer: fieldMetrics(transfer),
        }
        setStatus('scoring')
        let nextRevisionScore = null

        try {
            nextRevisionScore = await scoreRevision()
            setRevisionScore(nextRevisionScore)
        } catch (error) {
            console.warn('[ArtifactStudio] Revision scoring failed:', error)
            nextRevisionScore = {
                validator_pass: false,
                validation_errors: ['artifact_revision_scorer_unavailable'],
                scores: null,
                privacy: { raw_text_persisted: false, policy: 'score-derived-only-v1' },
            }
            setRevisionScore(nextRevisionScore)
        }

        const tracePayload = {
            course,
            section,
            artifact,
            artifact_definition_id: artifactDefinition.id,
            artifact_family: artifactDefinition.family,
            artifact_submission_spec_version: submissionSpec.version,
            artifact_required_files: submissionSpec.requiredFiles,
            artifact_accepted_formats: submissionSpec.acceptedFormats,
            artifact_naming_pattern: submissionSpec.namingPattern,
            artifact_required_sections: submissionSpec.requiredSections,
            support_move: supportMove,
            recommended_support_move: recommendedSupportMove,
            support_move_overridden: supportMoveOverridden,
            support_rationale: supportRationale,
            studio_mode: mode.id,
            trace_score: traceScore,
            trace_denominator: 8,
            artifact_quality_score: artifactQualityScore,
            // Scored BEFORE/AFTER artifact states + revision delta. artifact_quality
            // and artifact_gap are exported as first-class policy inputs so the
            // backend support-selection policy can read them as live signals.
            artifact_quality: artifactQuality,
            artifact_gap: artifactGap,
            before_quality_score: beforeQualityScore,
            after_quality_score: artifactQualityScore,
            artifact_revision_delta: artifactRevisionDelta,
            before_rubric: beforeRubric,
            after_rubric: rubric,
            rubric_deltas: rubricDeltas,
            rubric,
            confidence,
            // AI Feedback Judgment Gate as a first-class trace field. resolved
            // marks whether the learner made an explicit judgment before submit.
            judgment: judgment || 'unresolved',
            ai_feedback_judgment: {
                value: judgment || 'unresolved',
                resolved: Boolean(judgment),
                rationale_length: judgmentRationale.length,
                rationale_present: judgmentRationale.trim().length >= 12,
            },
            submission_id: submissionId,
            source_text_metrics: sourceTextMetrics,
            revision_scores: nextRevisionScore?.scores || null,
            revision_score_validation: {
                validator_pass: Boolean(nextRevisionScore?.validator_pass),
                validation_errors: nextRevisionScore?.validation_errors || [],
                policy_version: nextRevisionScore?.policy_version || 'artifact-revision-scorer-v1',
                privacy: nextRevisionScore?.privacy || { raw_text_persisted: false },
            },
            raw_submission_privacy: {
                raw_text_persisted: false,
                raw_text_sent_to_scorer: true,
                persisted_fields: ['submission_id', 'source_text_metrics', 'lengths', 'rubric', 'scores'],
                policy: 'raw-submission-derived-telemetry-v1',
            },
            initial_draft_length: initialDraft.length,
            claim_length: claim.length,
            evidence_length: evidence.length,
            accepted_length: accepted.length,
            rejected_length: rejected.length,
            judgment_rationale_length: judgmentRationale.length,
            revised_draft_length: revisedDraft.length,
            transfer_length: transfer.length,
        }
        logEvent('artifact_studio_trace', 'artifact_studio', {
            ...tracePayload,
        }, sectionId)
        recordAdaptiveSignal(sectionId, 'artifact_studio_trace', {
            artifact,
            artifactDefinitionId: artifactDefinition.id,
            artifactFamily: artifactDefinition.family,
            artifactSubmissionSpecVersion: submissionSpec.version,
            studioMode: mode.id,
            supportMove,
            recommendedSupportMove,
            supportMoveOverridden,
            artifactQualityScore,
            // First-class scored-revision signals fed INTO the live policy.
            artifactQuality,
            artifactGap,
            beforeQualityScore,
            artifactRevisionDelta,
            traceCompleteness: traceScore / 8,
            confidence,
            judgment: judgment || 'unresolved',
            judgmentResolved: Boolean(judgment),
        })

        setStatus('recommending')
        try {
            const recommendation = await getAdaptiveRecommendation({
                sectionId,
                sectionTitle: sectionTitle || artifact,
                conceptIds,
                currentHeading: mode.title,
                stuckReason: nextRevisionScore?.validator_pass
                    ? `work product revision scored ${Math.round((nextRevisionScore.scores?.overall_revision_quality || 0) * 100)}%`
                    : 'work product revision needs more evidence',
                context: {
                    source: 'work_product_studio',
                    traceScore,
                    artifactQualityScore,
                    artifactQuality,
                    artifactGap,
                    artifactRevisionDelta,
                    revisionScores: nextRevisionScore?.scores || null,
                    judgment: judgment || 'unresolved',
                },
            })
            setAdaptiveRecommendation(recommendation)
        } catch (error) {
            console.warn('[ArtifactStudio] Adaptive recommendation failed:', error)
            setAdaptiveRecommendation(null)
        } finally {
            setStatus('complete')
        }
    }

    const STEPS = [
        { id: 'draft', label: 'Draft' },
        { id: 'evidence', label: 'Evidence' },
        { id: 'judge', label: 'Judge AI' },
        { id: 'revise', label: 'Revise' },
    ]
    const stepValid = [
        initialDraft.trim().length >= 12,
        claim.trim().length >= 12 && evidence.trim().length >= 12,
        accepted.trim().length >= 12 && rejected.trim().length >= 12 && Boolean(judgment) && judgmentRationale.trim().length >= 12,
        revisedDraft.trim().length >= 12,
    ]

    return (
        <section className="my-8 rounded-2xl border border-[var(--ath-line)] bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--ath-panel)] text-[var(--ath-primary)]">
                    <ModeIcon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                    <h3 className="truncate text-base font-semibold tracking-tight text-[var(--ath-text)]" title={mode.title}>{mode.title}</h3>
                    <p className="truncate text-xs text-[var(--ath-muted)]" title={artifact}>{artifact}</p>
                </div>
                <span className="rounded-full bg-[var(--ath-panel)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--ath-secondary)]">
                    {course} {section}
                </span>
                <button
                    type="button"
                    onClick={() => setShowRules((value) => !value)}
                    className="text-xs font-medium text-[var(--ath-muted)] underline-offset-4 hover:text-[var(--ath-text)] hover:underline"
                    aria-expanded={showRules}
                >
                    {showRules ? 'Hide rules' : 'Submission rules'}
                </button>
            </div>

            {showRules && (
                <div className="mt-3 rounded-xl border border-[var(--ath-line)] bg-[var(--ath-panel)] p-3 text-xs leading-6 text-[var(--ath-muted)]">
                    <p className="text-[var(--ath-text)]">{artifactDefinition.definition}</p>
                    <div className="mt-2 grid gap-2 md:grid-cols-3">
                        <p><span className="font-semibold text-[var(--ath-text)]">Accept</span> | {artifactDefinition.submissionForms.join('; ')}</p>
                        <p><span className="font-semibold text-[var(--ath-text)]">Not enough</span> | {artifactDefinition.nonExamples.join('; ')}</p>
                        <p><span className="font-semibold text-[var(--ath-text)]">Quality</span> | {artifactDefinition.qualitySignal}</p>
                    </div>
                    <p className="mt-2">
                        <span className="font-semibold text-[var(--ath-text)]">Files</span> {submissionSpec.requiredFiles.join('; ')} | <span className="font-semibold text-[var(--ath-text)]">Formats</span> {submissionSpec.acceptedFormats.join(', ')} | <span className="font-semibold text-[var(--ath-text)]">Name</span> <code className="rounded bg-white/70 px-1">{submissionSpec.namingPattern}</code>
                    </p>
                    <p className="mt-1"><span className="font-semibold text-[var(--ath-text)]">Required sections</span> | {submissionSpec.requiredSections.join('; ')}</p>
                </div>
            )}

            <ol className="mt-4 flex items-center gap-1 text-[11px] font-semibold text-[var(--ath-secondary)]" aria-label="Studio progress">
                {STEPS.map((stepDef, index) => {
                    const isActive = step === index
                    const isDone = stepValid[index]
                    return (
                        <li key={stepDef.id} className="flex flex-1 items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => setStep(index)}
                                aria-current={isActive ? 'step' : undefined}
                                className={`flex min-w-0 flex-1 items-center gap-1.5 rounded-lg px-2 py-1.5 text-left transition-colors ${
                                    isActive
                                        ? 'bg-[rgba(200,226,236,0.45)] text-[var(--ath-primary)]'
                                        : 'text-[var(--ath-secondary)] hover:bg-[var(--ath-panel)] hover:text-[var(--ath-text)]'
                                }`}
                            >
                                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                                    isActive
                                        ? 'bg-[var(--ath-primary)] text-white'
                                        : isDone
                                            ? 'bg-emerald-100 text-emerald-700'
                                            : 'bg-[var(--ath-panel)] text-[var(--ath-text)]'
                                }`}>
                                    {isDone && !isActive ? <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> : index + 1}
                                </span>
                                <span className="truncate">{stepDef.label}</span>
                            </button>
                            {index < STEPS.length - 1 && <span aria-hidden className="hidden h-px flex-1 bg-[var(--ath-line)] sm:block" />}
                        </li>
                    )
                })}
            </ol>

            <div className="mt-5 space-y-4">
                {step === 0 && (
                    <>
                        <label className="block">
                            <span className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--ath-secondary)]">Initial draft</span>
                            <textarea
                                value={initialDraft}
                                onChange={(event) => setInitialDraft(event.target.value)}
                                className="editorial-input mt-2 min-h-32 text-sm"
                                placeholder="Paste or summarize the current draft before AI critique."
                            />
                        </label>
                        {mode.prompts.length > 0 && (
                            <ul className="grid gap-2 text-xs leading-5 text-[var(--ath-muted)] md:grid-cols-3">
                                {mode.prompts.map((prompt) => (
                                    <li key={prompt} className="rounded-lg border border-[var(--ath-line)] bg-[var(--ath-panel)] px-3 py-2">{prompt}</li>
                                ))}
                            </ul>
                        )}

                        <details className="rounded-xl border border-[var(--ath-line)] bg-[var(--ath-panel)] px-3 py-2 [&[open]>summary>span:last-child]:rotate-90">
                            <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold text-[var(--ath-secondary)]">
                                <span>Score the draft before AI revision | {Math.round(beforeQualityScore * 100)}%</span>
                                <span className="transition-transform">&gt;</span>
                            </summary>
                            <p className="mt-2 text-[11px] leading-5 text-[var(--ath-secondary)]">
                                This baseline lets the studio measure the before/after revision movement, not just the final state.
                            </p>
                            <div className="mt-3 grid gap-2 md:grid-cols-3">
                                {RUBRIC_ROWS.map((row) => (
                                    <label key={row.id} className="rounded-lg border border-[var(--ath-line)] bg-white/80 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ath-secondary)]">
                                        {row.label}
                                        <select
                                            value={beforeRubric[row.id]}
                                            onChange={(event) => setBeforeRubric((current) => ({ ...current, [row.id]: Number(event.target.value) }))}
                                            className="mt-1 w-full rounded border border-[var(--ath-line)] bg-white px-1.5 py-1 text-sm font-medium text-[var(--ath-text)]"
                                        >
                                            <option value={0}>0 missing</option>
                                            <option value={1}>1 partial</option>
                                            <option value={2}>2 strong</option>
                                        </select>
                                    </label>
                                ))}
                            </div>
                        </details>
                    </>
                )}

                {step === 1 && (
                    <div className="grid gap-4 md:grid-cols-2">
                        <label className="block">
                            <span className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--ath-secondary)]">Claim</span>
                            <textarea
                                value={claim}
                                onChange={(event) => setClaim(event.target.value)}
                                className="editorial-input mt-2 min-h-28 text-sm"
                                placeholder="Audience, constraint, and intended action."
                            />
                        </label>
                        <label className="block">
                            <span className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--ath-secondary)]">{mode.evidenceLabel}</span>
                            <textarea
                                value={evidence}
                                onChange={(event) => setEvidence(event.target.value)}
                                className="editorial-input mt-2 min-h-28 text-sm"
                                placeholder="Rubric line, annotation, data check, or observation."
                            />
                        </label>
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <label className="block">
                                <span className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--ath-secondary)]">{mode.acceptedLabel}</span>
                                <textarea
                                    value={accepted}
                                    onChange={(event) => setAccepted(event.target.value)}
                                    className="editorial-input mt-2 min-h-28 text-sm"
                                    placeholder="What did you accept, and why?"
                                />
                            </label>
                            <label className="block">
                                <span className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--ath-secondary)]">{mode.rejectedLabel}</span>
                                <textarea
                                    value={rejected}
                                    onChange={(event) => setRejected(event.target.value)}
                                    className="editorial-input mt-2 min-h-28 text-sm"
                                    placeholder="What did you reject or modify, and why?"
                                />
                            </label>
                        </div>
                        <div className="rounded-xl border border-[var(--ath-line)] bg-[var(--ath-panel)] p-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--ath-secondary)]">AI feedback judgment</span>
                                <div className="flex flex-1 flex-wrap gap-1">
                                    {JUDGMENT_OPTIONS.map((option) => (
                                        <button
                                            key={option.id}
                                            type="button"
                                            aria-pressed={judgment === option.id}
                                            onClick={() => setJudgment(option.id)}
                                            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                                                judgment === option.id
                                                    ? 'bg-[var(--ath-primary)] text-white'
                                                    : 'bg-white text-[var(--ath-muted)] hover:text-[var(--ath-primary)]'
                                            }`}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {/* Progressive disclosure: the rationale field is revealed only
                                after the learner commits to a judgment, so the gate does not
                                present every field at once. */}
                            {judgment ? (
                                <label className="mt-3 block">
                                    <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--ath-secondary)]">Why did you {judgment} it?</span>
                                    <textarea
                                        value={judgmentRationale}
                                        onChange={(event) => setJudgmentRationale(event.target.value)}
                                        className="editorial-input mt-1 min-h-20 text-sm"
                                        placeholder="Name the evidence that drove this judgment."
                                    />
                                </label>
                            ) : (
                                <p className="mt-2 text-[11px] leading-5 text-[var(--ath-secondary)]">
                                    Choose how you judged the AI suggestion to unlock the rationale field.
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {step === 3 && (
                    <div className="space-y-4">
                        <label className="block">
                            <span className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--ath-secondary)]">Revised work product</span>
                            <textarea
                                value={revisedDraft}
                                onChange={(event) => setRevisedDraft(event.target.value)}
                                className="editorial-input mt-2 min-h-32 text-sm"
                                placeholder="Paste or summarize the revised version."
                            />
                        </label>
                        <label className="block">
                            <span className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--ath-secondary)]">Transfer constraint</span>
                            <textarea
                                value={transfer}
                                onChange={(event) => setTransfer(event.target.value)}
                                className="editorial-input mt-2 min-h-20 text-sm"
                                placeholder="Where would this decision change next?"
                            />
                        </label>

                        <details className="rounded-xl border border-[var(--ath-line)] bg-[var(--ath-panel)] px-3 py-2 [&[open]>summary>span:last-child]:rotate-90">
                            <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold text-[var(--ath-secondary)]">
                                <span>Quality after revision | {Math.round(artifactQualityScore * 100)}% ({artifactRevisionDelta >= 0 ? '+' : ''}{Math.round(artifactRevisionDelta * 100)} pts vs before)</span>
                                <span className="transition-transform">&gt;</span>
                            </summary>
                            <div className="mt-3 grid gap-2 md:grid-cols-3">
                                {RUBRIC_ROWS.map((row) => (
                                    <label key={row.id} className="rounded-lg border border-[var(--ath-line)] bg-white/80 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ath-secondary)]">
                                        {row.label}
                                        <select
                                            value={rubric[row.id]}
                                            onChange={(event) => setRubric((current) => ({ ...current, [row.id]: Number(event.target.value) }))}
                                            className="mt-1 w-full rounded border border-[var(--ath-line)] bg-white px-1.5 py-1 text-sm font-medium text-[var(--ath-text)]"
                                        >
                                            <option value={0}>0 missing</option>
                                            <option value={1}>1 partial</option>
                                            <option value={2}>2 strong</option>
                                        </select>
                                    </label>
                                ))}
                            </div>
                        </details>

                        <div className="flex flex-wrap items-center gap-3">
                            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--ath-secondary)]">Confidence</span>
                            <span className="text-[10px] text-[var(--ath-secondary)]">Low</span>
                            <input
                                type="range"
                                min="1"
                                max="5"
                                value={confidence}
                                onChange={(event) => setConfidence(Number(event.target.value))}
                                className="max-w-[12rem] flex-1"
                            />
                            <span className="text-[10px] text-[var(--ath-secondary)]">High</span>
                            <span className="rounded-full bg-[var(--ath-panel)] px-2 py-0.5 text-xs font-semibold text-[var(--ath-text)]">{confidence}</span>
                        </div>

                        <div className="rounded-xl border border-[var(--ath-line)] bg-[var(--ath-panel)] p-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--ath-secondary)]">Support move</span>
                                <div className="flex flex-1 flex-wrap gap-1">
                                    {SUPPORT_MOVES.map((move) => {
                                        const MoveIcon = move.icon
                                        const isSelected = supportMove === move.id
                                        return (
                                            <button
                                                key={move.id}
                                                type="button"
                                                aria-pressed={isSelected}
                                                onClick={() => {
                                                    setSelectedSupportMove(move.id)
                                                    setSupportMoveOverridden(true)
                                                }}
                                                title={move.rationale}
                                                className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                                                    isSelected
                                                        ? 'bg-[var(--ath-primary)] text-white'
                                                        : 'bg-white text-[var(--ath-muted)] hover:text-[var(--ath-primary)]'
                                                }`}
                                            >
                                                <MoveIcon className="h-3 w-3" aria-hidden="true" />
                                                {move.label}
                                            </button>
                                        )
                                    })}
                                </div>
                                <span
                                    className="rounded-full border border-[var(--ath-line)] bg-[rgba(200,226,236,0.3)] px-2.5 py-1 text-[10px] font-semibold text-[var(--ath-primary)]"
                                    title={supportRationale}
                                >
                                    Recommended: {recommendedSupportMove}
                                </span>
                            </div>
                            {supportMoveOverridden && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSupportMoveOverridden(false)
                                        setSelectedSupportMove(null)
                                    }}
                                    className="mt-2 text-[10px] font-semibold text-[var(--ath-secondary)] underline-offset-2 hover:text-[var(--ath-text)] hover:underline"
                                >
                                    Follow recommended move
                                </button>
                            )}
                        </div>

                        {revisionScore?.scores && (
                            <div className="rounded-xl border border-[var(--ath-line)] bg-white p-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--ath-secondary)]">Revision quality</span>
                                    <span className="text-sm font-semibold text-[var(--ath-text)]">{Math.round((revisionScore.scores.overall_revision_quality || 0) * 100)}%</span>
                                </div>
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                    {Object.entries(revisionScore.scores).filter(([key]) => key !== 'overall_revision_quality').map(([key, value]) => (
                                        <span key={key} className="rounded-full bg-[var(--ath-panel)] px-2 py-0.5 text-[10px] font-medium text-[var(--ath-text)]">
                                            {key.replace(/_/g, ' ')} {Math.round(Number(value || 0) * 100)}%
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {adaptiveRecommendation?.primary_action && (
                            <div className="rounded-xl border border-[var(--ath-line)] bg-[rgba(200,226,236,0.22)] px-3 py-2 text-xs leading-6 text-[var(--ath-text)]">
                                <span className="font-semibold">Next: {adaptiveRecommendation.primary_action}</span>
                                {' | '}{adaptiveRecommendation.recommended_because?.[0] || adaptiveRecommendation.evidence?.[0] || 'Based on current learner and artifact evidence.'}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-[var(--ath-line)] pt-4">
                <button
                    type="button"
                    onClick={() => setStep((value) => Math.max(0, value - 1))}
                    disabled={step === 0}
                    className="text-xs font-semibold text-[var(--ath-secondary)] hover:text-[var(--ath-text)] disabled:opacity-30"
                >
                    Back
                </button>
                <span className="text-xs text-[var(--ath-secondary)]">{traceScore}/8 fields | {completionPercent}%</span>
                {step < STEPS.length - 1 ? (
                    <button
                        type="button"
                        onClick={() => setStep((value) => Math.min(STEPS.length - 1, value + 1))}
                        className="editorial-button px-4 py-2 text-sm"
                    >
                        Next
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={submitTrace}
                        disabled={status === 'scoring' || status === 'recommending'}
                        className="editorial-button px-4 py-2 text-sm"
                    >
                        <CheckCircle2 className="h-4 w-4" />
                        {status === 'scoring' ? 'Scoring...' : status === 'recommending' ? 'Recommending...' : 'Submit'}
                    </button>
                )}
            </div>
        </section>
    )
}
