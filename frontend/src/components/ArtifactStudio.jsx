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
    const [judgment, setJudgment] = useState('modify')
    const [judgmentRationale, setJudgmentRationale] = useState('')
    const [revisedDraft, setRevisedDraft] = useState('')
    const [transfer, setTransfer] = useState('')
    const [supportMove, setSupportMove] = useState('explain')
    const [confidence, setConfidence] = useState(2)
    const [rubric, setRubric] = useState(() => RUBRIC_ROWS.reduce((acc, row) => ({ ...acc, [row.id]: 0 }), {}))
    const [revisionScore, setRevisionScore] = useState(null)
    const [adaptiveRecommendation, setAdaptiveRecommendation] = useState(null)
    const [status, setStatus] = useState('idle')

    const traceScore = useMemo(() => {
        return [initialDraft, claim, evidence, accepted, rejected, judgmentRationale, revisedDraft, transfer]
            .filter((value) => value.trim().length >= 12).length
    }, [accepted, claim, evidence, initialDraft, judgmentRationale, rejected, revisedDraft, transfer])

    const artifactQualityScore = useMemo(() => {
        const total = Object.values(rubric).reduce((sum, value) => sum + Number(value || 0), 0)
        return Number((total / (RUBRIC_ROWS.length * 2)).toFixed(3))
    }, [rubric])

    const supportRationale = useMemo(() => {
        if (traceScore <= 3) return SUPPORT_MOVES.find((move) => move.id === 'explain').rationale
        if (traceScore <= 6) return SUPPORT_MOVES.find((move) => move.id === 'compare').rationale
        return SUPPORT_MOVES.find((move) => move.id === 'audit').rationale
    }, [traceScore])

    const recommendedSupportMove = traceScore <= 3 ? 'explain' : traceScore <= 6 ? 'compare' : 'audit'
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
                judgment,
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
            support_rationale: supportRationale,
            studio_mode: mode.id,
            trace_score: traceScore,
            trace_denominator: 8,
            artifact_quality_score: artifactQualityScore,
            rubric,
            confidence,
            judgment,
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
            artifactQualityScore,
            traceCompleteness: traceScore / 8,
            confidence,
            judgment,
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
                    revisionScores: nextRevisionScore?.scores || null,
                    judgment,
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

    return (
        <section className="my-8 rounded-[1.75rem] border border-[var(--ath-line)] bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 border-b border-[var(--ath-line)] pb-4 md:flex-row md:items-start md:justify-between">
                <div>
                    <p className="editorial-kicker">Work Product Studio</p>
                    <div className="mt-2 flex items-center gap-2">
                        <ModeIcon className="h-5 w-5 text-[var(--ath-primary)]" />
                        <h3 className="text-xl font-semibold tracking-tight text-[var(--ath-text)]">{mode.title}</h3>
                    </div>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--ath-muted)]">{artifact}</p>
                    <p className="mt-1 text-sm text-[var(--ath-muted)]">{course} {section}</p>
                </div>
                <div className="flex gap-2">
                    {SUPPORT_MOVES.map((move) => {
                        const Icon = move.icon
                        return (
                            <button
                                key={move.id}
                                type="button"
                                title={`${move.label} support`}
                                onClick={() => setSupportMove(move.id)}
                                className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition-colors ${supportMove === move.id
                                    ? 'border-[var(--ath-primary)] bg-[rgba(200,226,236,0.5)] text-[var(--ath-primary)]'
                                    : 'border-[var(--ath-line)] bg-[var(--ath-panel)] text-[var(--ath-muted)] hover:text-[var(--ath-primary)]'
                                    }`}
                            >
                                <Icon className="h-4 w-4" />
                            </button>
                        )
                    })}
                </div>
            </div>

            <div className="mt-5 rounded-2xl border border-[var(--ath-line)] bg-[rgba(255,255,255,0.76)] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--ath-secondary)]">Artifact Definition</p>
                <p className="mt-2 text-sm leading-6 text-[var(--ath-text)]">{artifactDefinition.definition}</p>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ath-secondary)]">Acceptable submissions</p>
                        <p className="mt-1 text-sm leading-6 text-[var(--ath-muted)]">{artifactDefinition.submissionForms.join('; ')}</p>
                    </div>
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ath-secondary)]">Not enough</p>
                        <p className="mt-1 text-sm leading-6 text-[var(--ath-muted)]">{artifactDefinition.nonExamples.join('; ')}</p>
                    </div>
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ath-secondary)]">Quality signal</p>
                        <p className="mt-1 text-sm leading-6 text-[var(--ath-muted)]">{artifactDefinition.qualitySignal}</p>
                    </div>
                </div>
                <div className="mt-4 rounded-xl border border-[var(--ath-line)] bg-white/80 p-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ath-secondary)]">File Specification</p>
                    <div className="mt-2 grid gap-3 md:grid-cols-2">
                        <p className="text-sm leading-6 text-[var(--ath-muted)]">
                            <strong className="text-[var(--ath-text)]">Files:</strong> {submissionSpec.requiredFiles.join('; ')}
                        </p>
                        <p className="text-sm leading-6 text-[var(--ath-muted)]">
                            <strong className="text-[var(--ath-text)]">Formats:</strong> {submissionSpec.acceptedFormats.join(', ')}
                        </p>
                        <p className="text-sm leading-6 text-[var(--ath-muted)]">
                            <strong className="text-[var(--ath-text)]">Name:</strong> {submissionSpec.namingPattern}
                        </p>
                        <p className="text-sm leading-6 text-[var(--ath-muted)]">
                            <strong className="text-[var(--ath-text)]">Minimum:</strong> {submissionSpec.minimumContent}
                        </p>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[var(--ath-muted)]">
                        <strong className="text-[var(--ath-text)]">Required sections:</strong> {submissionSpec.requiredSections.join('; ')}
                    </p>
                </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-4">
                {[
                    ['1', 'Draft'],
                    ['2', 'Evidence'],
                    ['3', 'Judge AI'],
                    ['4', 'Revise'],
                ].map(([step, label]) => (
                    <div key={step} className="rounded-2xl border border-[var(--ath-line)] bg-[rgba(255,255,255,0.72)] px-4 py-3">
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--ath-secondary)]">Checkpoint {step}</p>
                        <p className="mt-1 text-sm font-semibold text-[var(--ath-text)]">{label}</p>
                    </div>
                ))}
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
                {mode.prompts.map((prompt) => (
                    <div key={prompt} className="rounded-2xl border border-[var(--ath-line)] bg-[var(--ath-panel)] px-4 py-3 text-sm font-medium leading-6 text-[var(--ath-text)]">
                        {prompt}
                    </div>
                ))}
            </div>

            <div className="mt-5 rounded-2xl border border-[var(--ath-line)] bg-[rgba(200,226,236,0.22)] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--ath-secondary)]">Why This Support Now</p>
                <p className="mt-2 text-sm leading-6 text-[var(--ath-text)]">
                    Recommended move: <strong>{recommendedSupportMove}</strong>. {supportRationale}
                </p>
                {adaptiveRecommendation?.primary_action && (
                    <div className="mt-3 rounded-xl border border-[var(--ath-line)] bg-white/75 p-3 text-sm leading-6 text-[var(--ath-text)]">
                        Backend policy recommends <strong>{adaptiveRecommendation.primary_action}</strong>: {adaptiveRecommendation.recommended_because?.[0] || adaptiveRecommendation.evidence?.[0] || 'Recommendation generated from current learner and artifact evidence.'}
                    </div>
                )}
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <label className="block lg:col-span-2">
                    <span className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--ath-secondary)]">Initial Work Product Draft</span>
                    <textarea
                        value={initialDraft}
                        onChange={(event) => setInitialDraft(event.target.value)}
                        className="editorial-input mt-2 min-h-24 text-sm"
                        placeholder="Paste or summarize the current draft before AI critique or revision."
                    />
                </label>
                <label className="block">
                    <span className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--ath-secondary)]">Artifact Claim</span>
                    <textarea
                        value={claim}
                        onChange={(event) => setClaim(event.target.value)}
                        className="editorial-input mt-2 min-h-24 text-sm"
                        placeholder="Name the audience, constraint, and intended action."
                    />
                </label>
                <label className="block">
                    <span className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--ath-secondary)]">{mode.evidenceLabel}</span>
                    <textarea
                        value={evidence}
                        onChange={(event) => setEvidence(event.target.value)}
                        className="editorial-input mt-2 min-h-24 text-sm"
                        placeholder="Rubric line, annotation, data check, transcript segment, or usability observation."
                    />
                </label>
                <label className="block">
                    <span className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--ath-secondary)]">{mode.acceptedLabel}</span>
                    <textarea
                        value={accepted}
                        onChange={(event) => setAccepted(event.target.value)}
                        className="editorial-input mt-2 min-h-24 text-sm"
                        placeholder="What changed, and why was the change justified?"
                    />
                </label>
                <label className="block">
                    <span className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--ath-secondary)]">{mode.rejectedLabel}</span>
                    <textarea
                        value={rejected}
                        onChange={(event) => setRejected(event.target.value)}
                        className="editorial-input mt-2 min-h-24 text-sm"
                        placeholder="What did you reject or modify, and why?"
                    />
                </label>
                <div className="lg:col-span-2 rounded-2xl border border-[var(--ath-line)] bg-[var(--ath-panel)] p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--ath-secondary)]">AI Feedback Judgment Gate</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-4">
                        {JUDGMENT_OPTIONS.map((option) => (
                            <button
                                key={option.id}
                                type="button"
                                onClick={() => setJudgment(option.id)}
                                className={`rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${judgment === option.id
                                    ? 'border-[var(--ath-primary)] bg-[rgba(200,226,236,0.5)] text-[var(--ath-primary)]'
                                    : 'border-[var(--ath-line)] bg-white text-[var(--ath-muted)] hover:text-[var(--ath-primary)]'
                                    }`}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                    <label className="mt-4 block">
                        <span className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--ath-secondary)]">Judgment Rationale</span>
                        <textarea
                            value={judgmentRationale}
                            onChange={(event) => setJudgmentRationale(event.target.value)}
                            className="editorial-input mt-2 min-h-20 text-sm"
                            placeholder="Explain why the AI suggestion was accepted, modified, rejected, or deferred."
                        />
                    </label>
                </div>
                <label className="block lg:col-span-2">
                    <span className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--ath-secondary)]">Revised Work Product</span>
                    <textarea
                        value={revisedDraft}
                        onChange={(event) => setRevisedDraft(event.target.value)}
                        className="editorial-input mt-2 min-h-24 text-sm"
                        placeholder="Paste or summarize the revised version after critique and judgment."
                    />
                </label>
                <label className="block lg:col-span-2">
                    <span className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--ath-secondary)]">Transfer Constraint</span>
                    <textarea
                        value={transfer}
                        onChange={(event) => setTransfer(event.target.value)}
                        className="editorial-input mt-2 min-h-20 text-sm"
                        placeholder="Name the next audience, class setting, tool, dataset, or role where this decision would need to change."
                    />
                </label>
            </div>

            <div className="mt-5 rounded-2xl border border-[var(--ath-line)] bg-[var(--ath-panel)] p-4">
                <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--ath-secondary)]">Artifact Quality Rubric</p>
                        <p className="mt-1 text-sm text-[var(--ath-muted)]">Score each trace dimension from 0 to 2.</p>
                    </div>
                    <p className="text-sm font-semibold text-[var(--ath-text)]">Quality {Math.round(artifactQualityScore * 100)}%</p>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                    {RUBRIC_ROWS.map((row) => (
                        <label key={row.id} className="rounded-xl border border-[var(--ath-line)] bg-white/72 px-3 py-2 text-xs font-semibold text-[var(--ath-muted)]">
                            {row.label}
                            <select
                                value={rubric[row.id]}
                                onChange={(event) => setRubric((current) => ({ ...current, [row.id]: Number(event.target.value) }))}
                                className="mt-2 w-full rounded-lg border border-[var(--ath-line)] bg-white px-2 py-1 text-sm text-[var(--ath-text)]"
                            >
                                <option value={0}>0 missing</option>
                                <option value={1}>1 partial</option>
                                <option value={2}>2 strong</option>
                            </select>
                        </label>
                    ))}
                </div>
            </div>

            {revisionScore?.scores && (
                <div className="mt-5 rounded-2xl border border-[var(--ath-line)] bg-white p-4">
                    <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--ath-secondary)]">Revision Quality</p>
                            <p className="mt-1 text-sm text-[var(--ath-muted)]">Server-scored from draft and revision; raw text is not persisted in telemetry.</p>
                        </div>
                        <p className="text-sm font-semibold text-[var(--ath-text)]">
                            Overall {Math.round((revisionScore.scores.overall_revision_quality || 0) * 100)}%
                        </p>
                    </div>
                    <div className="mt-4 grid gap-2 md:grid-cols-3">
                        {Object.entries(revisionScore.scores).filter(([key]) => key !== 'overall_revision_quality').map(([key, value]) => (
                            <div key={key} className="rounded-xl border border-[var(--ath-line)] bg-[var(--ath-panel)] px-3 py-2">
                                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ath-secondary)]">{key.replace(/_/g, ' ')}</p>
                                <p className="mt-1 text-sm font-semibold text-[var(--ath-text)]">{Math.round(Number(value || 0) * 100)}%</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="mt-5 flex flex-col gap-4 border-t border-[var(--ath-line)] pt-4 md:flex-row md:items-center md:justify-between">
                <div className="rounded-full border border-[var(--ath-line)] bg-[rgba(255,255,255,0.84)] px-4 py-2 text-sm font-semibold text-[var(--ath-muted)]">
                    Trace completeness <span className="text-[var(--ath-text)]">{completionPercent}%</span>
                </div>
                <label className="flex flex-1 items-center gap-3 text-sm font-semibold text-[var(--ath-muted)]">
                    Confidence
                    <input
                        type="range"
                        min="1"
                        max="5"
                        value={confidence}
                        onChange={(event) => setConfidence(Number(event.target.value))}
                        className="max-w-xs flex-1"
                    />
                    <span className="w-5 text-center text-[var(--ath-text)]">{confidence}</span>
                </label>
                <button
                    type="button"
                    onClick={submitTrace}
                    disabled={status === 'scoring' || status === 'recommending'}
                    className="editorial-button px-4 py-2 text-sm"
                >
                    <CheckCircle2 className="h-4 w-4" />
                    {status === 'scoring' ? 'Scoring...' : status === 'recommending' ? 'Recommending...' : `Log Trace ${traceScore}/8`}
                </button>
            </div>
        </section>
    )
}
