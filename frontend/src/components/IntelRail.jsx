import { useEffect, useState } from 'react'
import API_BASE from '../lib/apiConfig'
import { getAdaptiveRecommendation, recordAdaptiveSignal } from '../lib/knowledgeService'
import {
    appendInterventionTrace,
    evaluateSupportContent,
    incrementConceptInterventionCount
} from '../lib/researchService'

const ACTION_TO_TAB = {
    explain: 'explain',
    represent: 'represent',
    practice: 'practice',
    ask: 'ask',
    advance: 'explain'
}

const TABS = [
    { id: 'explain', label: 'Explain' },
    { id: 'represent', label: 'Reframe' },
    { id: 'practice', label: 'Practice' },
    { id: 'ask', label: 'Ask' }
]

function prettyConcept(conceptId) {
    if (!conceptId) return 'this concept'
    return conceptId.replace(/_/g, ' ')
}

export default function IntelRail({ context, stuckEvent, sectionInfo, onClose }) {
    const [activeTab, setActiveTab] = useState('explain')
    const [loading, setLoading] = useState(false)
    const [recommendationLoading, setRecommendationLoading] = useState(false)
    const [recommendation, setRecommendation] = useState(null)
    const [explanation, setExplanation] = useState(null)
    const [representation, setRepresentation] = useState(null)
    const [supportAudit, setSupportAudit] = useState(null)
    const [activeTraceId, setActiveTraceId] = useState(null)

    // Free-form chat lives in the floating ChatWidget. Rail keeps only the
    // launcher input here (Ask tab), so we no longer track messages or
    // chat-loading state in this component.
    const [inputValue, setInputValue] = useState('')

    const resolvedSectionId = context?.sectionId || sectionInfo?.sectionId || 'general'
    const resolvedSectionTitle = sectionInfo?.sectionTitle || resolvedSectionId
    const conceptKey = (sectionInfo?.conceptIds || []).join('|')
    const resolvedHeading = sectionInfo?.currentHeading || resolvedSectionTitle
    const resolvedStuckReason = context?.reason || stuckEvent?.reason || null
    const preferredTab = context?.preferredTab || null

    useEffect(() => {
        if (!preferredTab) return
        setActiveTab(ACTION_TO_TAB[preferredTab] || preferredTab)
    }, [preferredTab])

    useEffect(() => {
        let cancelled = false

        const loadRecommendation = async () => {
            setRecommendationLoading(true)
            const nextRecommendation = await getAdaptiveRecommendation({
                sectionId: resolvedSectionId,
                sectionTitle: resolvedSectionTitle,
                conceptIds: conceptKey ? conceptKey.split('|') : [],
                currentHeading: resolvedHeading,
                stuckReason: resolvedStuckReason,
                context
            })

            if (cancelled) return

            setRecommendation(nextRecommendation)
            setActiveTraceId(nextRecommendation?.client_trace_id || null)
            setSupportAudit(null)

            const suggestedAction = nextRecommendation?.primary_recommendation?.action
            if (suggestedAction && ACTION_TO_TAB[suggestedAction]) {
                setActiveTab(ACTION_TO_TAB[suggestedAction])
                if (suggestedAction === 'ask' && nextRecommendation.primary_recommendation.coach_prompt) {
                    setInputValue(nextRecommendation.primary_recommendation.coach_prompt)
                }
            }

            if (nextRecommendation?.primary_recommendation?.focus_concepts?.length > 0) {
                nextRecommendation.primary_recommendation.focus_concepts.forEach((conceptId) => {
                    incrementConceptInterventionCount(conceptId)
                })
            }

            setRecommendationLoading(false)
        }

        loadRecommendation()

        return () => {
            cancelled = true
        }
    }, [
        conceptKey,
        resolvedHeading,
        resolvedSectionId,
        resolvedSectionTitle,
        resolvedStuckReason,
        context,
    ])

    const requestExplanation = async () => {
        if (!resolvedSectionId) return
        setLoading(true)
        recordAdaptiveSignal(resolvedSectionId, 'explanation_request', {
            reason: resolvedStuckReason
        })
        if (activeTraceId) {
            appendInterventionTrace(activeTraceId, {
                type: 'support_requested',
                status: 'engaged',
                detail: { support_type: 'explain' }
            })
        }
        try {
            const apiKey = localStorage.getItem('gemini_api_key') || import.meta.env.VITE_GEMINI_API_KEY || ''
            const res = await fetch(`${API_BASE}/assist/explain`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    section_id: resolvedSectionId,
                    problem_id: context?.problemId,
                    stuck_reason: resolvedStuckReason,
                    api_key: apiKey
                })
            })
            const data = await res.json()
            setExplanation(data.explanation)
            setSupportAudit(
                evaluateSupportContent({
                    sectionId: resolvedSectionId,
                    supportType: 'explain',
                    content: data.explanation,
                    focusConcepts: recommendation?.primary_recommendation?.focus_concepts || [],
                    traceId: activeTraceId
                })
            )
        } catch (error) {
            console.error(error)
            setExplanation('Unable to generate explanation. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    const requestRepresentation = async (type) => {
        if (!resolvedSectionId) return
        setLoading(true)
        recordAdaptiveSignal(resolvedSectionId, 'representation_request', {
            representationType: type
        })
        if (activeTraceId) {
            appendInterventionTrace(activeTraceId, {
                type: 'support_requested',
                status: 'engaged',
                detail: { support_type: 'represent', representation_type: type }
            })
        }
        try {
            const apiKey = localStorage.getItem('gemini_api_key') || import.meta.env.VITE_GEMINI_API_KEY || ''
            const res = await fetch(`${API_BASE}/assist/represent`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    section_id: resolvedSectionId,
                    representation_type: type,
                    api_key: apiKey
                })
            })
            const data = await res.json()
            setRepresentation(data.content)
            setSupportAudit(
                evaluateSupportContent({
                    sectionId: resolvedSectionId,
                    supportType: `represent:${type}`,
                    content: data.content,
                    focusConcepts: recommendation?.primary_recommendation?.focus_concepts || [],
                    traceId: activeTraceId
                })
            )
        } catch (error) {
            console.error(error)
            setRepresentation('Unable to generate representation.')
        } finally {
            setLoading(false)
        }
    }

    // sendMessage / handleKeyDown removed when the Ask tab became a launcher
    // for the floating ChatWidget. The ChatWidget now owns chat state, history
    // persistence, and the /api/orchestrate call path. Rail dispatches an
    // 'open-chat' CustomEvent which ChatWidget listens for.

    const handleRecommendationAction = (action, coachPrompt = '') => {
        recordAdaptiveSignal(resolvedSectionId, action === 'advance' ? 'intervention_decline' : 'intervention_accept', {
            action
        })
        if (activeTraceId) {
            appendInterventionTrace(activeTraceId, {
                type: 'recommendation_action',
                status: action === 'advance' ? 'awaiting_outcome' : 'engaged',
                detail: { action }
            })
        }

        if (action === 'advance') {
            onClose?.()
            return
        }

        const nextTab = ACTION_TO_TAB[action] || 'explain'
        setActiveTab(nextTab)

        if (action === 'ask' && coachPrompt) {
            setInputValue((current) => current || coachPrompt)
        }
    }

    const primaryRecommendation = recommendation?.primary_recommendation
    const learnerState = recommendation?.learner_state
    const reasoning = recommendation?.reasoning
    const learnerProfile = recommendation?.learner_profile
    const actionScores = Object.entries(reasoning?.action_scores || {})
        .sort((left, right) => right[1] - left[1])
        .slice(0, 5)

    const handleClose = () => {
        if (activeTraceId) {
            appendInterventionTrace(activeTraceId, {
                type: 'rail_closed',
                status: 'awaiting_outcome',
                detail: {
                    active_tab: activeTab
                }
            })
        }
        onClose?.()
    }

    return (
        <div className="flex h-full flex-col">
            <div className="border-b border-[var(--ath-line)] bg-[linear-gradient(180deg,rgba(248,246,241,0.98),rgba(240,237,230,0.92))] p-5">
                <div className="mb-2 flex items-start justify-between gap-4">
                    <div>
                        <p className="editorial-kicker">Reading Panel</p>
                        <h2 className="mt-2 text-2xl font-semibold text-[var(--ath-primary-deep)]">BigAL Support Rail</h2>
                        <p className="mt-1 text-sm text-[var(--ath-muted)]">{resolvedSectionTitle}</p>
                    </div>
                    <button
                        onClick={handleClose}
                        className="editorial-button-secondary px-3 py-1.5 text-xs"
                    >
                        Close
                    </button>
                </div>
                {resolvedStuckReason && (
                    <div className="rounded-[1rem] border border-[rgba(15,81,103,0.12)] bg-[rgba(200,226,236,0.34)] px-3 py-2 text-sm text-[var(--ath-primary-deep)]">
                        <span className="font-semibold">Detected:</span> {resolvedStuckReason}
                    </div>
                )}
                {context?.question && (
                    <div className="mt-3 rounded-[1rem] border border-[var(--ath-line)] bg-white/70 px-3 py-3 text-sm leading-6 text-[var(--ath-muted)]">
                        <span className="font-semibold text-[var(--ath-text)]">Focus prompt:</span> {context.question}
                    </div>
                )}
            </div>

            <div className="flex border-b border-[var(--ath-line)] bg-[rgba(240,237,230,0.6)]">
                {TABS.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 py-3 text-xs font-semibold uppercase tracking-[0.16em] transition-colors ${activeTab === tab.id
                            ? 'border-b-2 border-[var(--ath-primary)] bg-[rgba(255,255,255,0.74)] text-[var(--ath-primary)]'
                            : 'text-[var(--ath-secondary)] hover:text-[var(--ath-text)]'
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4">
                <div className="mb-4 rounded-[1.5rem] border border-[var(--ath-line)] bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(240,237,230,0.64))] p-4 shadow-sm">
                    <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                            <p className="editorial-label">Recommended next step</p>
                            <h3 className="mt-2 text-lg font-semibold text-[var(--ath-text)]">
                                {recommendationLoading
                                    ? 'Building a recommendation...'
                                    : primaryRecommendation?.title || 'We are gathering enough evidence to guide the next move.'}
                            </h3>
                        </div>
                        {learnerState && (
                            <span className="editorial-chip">
                                {learnerState.confidence_signal}
                            </span>
                        )}
                    </div>

                    {recommendationLoading ? (
                        <p className="text-sm text-[var(--ath-muted)]">
                            Looking at mastery, recent friction, and engagement signals for this section.
                        </p>
                    ) : (
                        <>
                            <p className="text-sm leading-relaxed text-[var(--ath-muted)]">
                                {primaryRecommendation?.rationale || 'Open a help tab to get targeted support for this section.'}
                            </p>

                            {primaryRecommendation?.focus_concepts?.length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {primaryRecommendation.focus_concepts.map((concept) => (
                                        <span
                                            key={concept}
                                            className="editorial-chip"
                                        >
                                            {prettyConcept(concept)}
                                        </span>
                                    ))}
                                </div>
                            )}

                            {primaryRecommendation?.evidence?.length > 0 && (
                                <div className="mt-3 space-y-2">
                                    {primaryRecommendation.evidence.map((item, index) => (
                                        <p key={`${item}-${index}`} className="text-xs leading-relaxed text-[var(--ath-secondary)]">
                                            {item}
                                        </p>
                                    ))}
                                </div>
                            )}

                            {reasoning && (
                                <div className="mt-4 rounded-[1rem] border border-[var(--ath-line)] bg-white/75 p-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <p className="editorial-label">Why this was chosen</p>
                                        <span className="editorial-chip">confidence {Math.round((reasoning.confidence || 0) * 100)}%</span>
                                    </div>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {(reasoning.reason_codes || []).map((code) => (
                                            <span key={code} className="editorial-chip">{prettyConcept(code)}</span>
                                        ))}
                                    </div>
                                    {(reasoning.recommended_because || []).length > 0 && (
                                        <div className="mt-4 space-y-2">
                                            {reasoning.recommended_because.map((item, index) => (
                                                <p key={`${item}-${index}`} className="text-xs leading-6 text-[var(--ath-muted)]">{item}</p>
                                            ))}
                                        </div>
                                    )}
                                    {(reasoning.not_recommended_because || []).length > 0 && (
                                        <div className="mt-4 border-t border-[var(--ath-line)] pt-3">
                                            <p className="editorial-label">Why other actions were not first</p>
                                            <div className="mt-2 space-y-2">
                                                {reasoning.not_recommended_because.map((item, index) => (
                                                    <p key={`${item}-${index}`} className="text-xs leading-6 text-[var(--ath-secondary)]">{item}</p>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {actionScores.length > 0 && (
                                        <div className="mt-4 border-t border-[var(--ath-line)] pt-3">
                                            <div className="flex items-center justify-between gap-3">
                                                <p className="editorial-label">Action score board</p>
                                                <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--ath-secondary)]">
                                                    {reasoning.policy_strategy || 'heuristic_bandit_v2'}
                                                </span>
                                            </div>
                                            <div className="mt-3 space-y-3">
                                                {actionScores.map(([action, score]) => (
                                                    <div key={action}>
                                                        <div className="flex items-center justify-between text-xs text-[var(--ath-muted)]">
                                                            <span className="font-semibold text-[var(--ath-text)]">{prettyConcept(action)}</span>
                                                            <span>{Math.round(score * 100)}%</span>
                                                        </div>
                                                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--ath-panel-muted)]">
                                                            <div
                                                                className="h-full rounded-full bg-[linear-gradient(90deg,var(--ath-primary),var(--ath-primary-deep))]"
                                                                style={{ width: `${Math.max(6, Math.round(score * 100))}%` }}
                                                            ></div>
                                                        </div>
                                                        {reasoning.predicted_outcomes?.[action] && (
                                                            <p className="mt-1 text-[11px] text-[var(--ath-secondary)]">
                                                                Success {Math.round((reasoning.predicted_outcomes[action].success_rate || 0) * 100)}% /
                                                                retention {Math.round((reasoning.predicted_outcomes[action].retention_lift || 0) * 100)}%
                                                            </p>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="mt-4 flex flex-wrap gap-2">
                                <button
                                    onClick={() => handleRecommendationAction(primaryRecommendation?.action, primaryRecommendation?.coach_prompt)}
                                    className="editorial-button px-3 py-2 text-sm"
                                >
                                    {primaryRecommendation?.action === 'advance' ? 'Keep moving' : 'Open suggested support'}
                                </button>
                                {recommendation?.secondary_recommendations?.slice(0, 2).map((item) => (
                                    <button
                                        key={item.action}
                                        onClick={() => handleRecommendationAction(item.action, item.coach_prompt)}
                                        className="editorial-button-secondary px-3 py-2 text-sm"
                                    >
                                        {item.title}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {activeTab === 'explain' && (
                    <div className="space-y-4">
                        <p className="text-sm leading-6 text-[var(--ath-muted)]">
                            Ask for a simpler explanation tied to the exact section where the learner is slowing down.
                        </p>

                        {!explanation ? (
                            <button
                                onClick={requestExplanation}
                                disabled={loading}
                                className="editorial-button w-full py-3 text-sm disabled:opacity-50"
                            >
                                {loading ? 'Generating...' : 'Get a simpler explanation'}
                            </button>
                        ) : (
                            <div className="rounded-[1.2rem] border border-[rgba(15,81,103,0.12)] bg-[rgba(200,226,236,0.28)] p-4">
                                <h4 className="mb-2 font-semibold text-[var(--ath-primary-deep)]">Simplified explanation</h4>
                                <p className="whitespace-pre-wrap text-sm leading-6 text-[var(--ath-text)]">{explanation}</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'represent' && (
                    <div className="space-y-4">
                        <p className="text-sm leading-6 text-[var(--ath-muted)]">
                            Switch the mental model. A fresh representation often unlocks the next step faster than repeating the same wording.
                        </p>

                        <div className="grid grid-cols-2 gap-2">
                            {[
                                { type: 'mindmap', label: 'Mind map' },
                                { type: 'analogy', label: 'Analogy' },
                                { type: 'visual', label: 'Visual' },
                                { type: 'formula', label: 'Formula' }
                            ].map((option) => (
                                <button
                                    key={option.type}
                                    onClick={() => requestRepresentation(option.type)}
                                    disabled={loading}
                                    className="editorial-button-secondary p-3 text-center text-sm disabled:opacity-50"
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>

                        {representation && (
                            <div className="mt-4 rounded-[1.2rem] border border-[rgba(199,137,67,0.18)] bg-[rgba(255,221,187,0.38)] p-4">
                                <p className="whitespace-pre-wrap text-sm leading-6 text-[var(--ath-text)]">{representation}</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'practice' && (
                    <div className="space-y-4">
                        <p className="text-sm leading-6 text-[var(--ath-muted)]">
                            The best practice move lives in the section practice block, where mastery updates and stuck detection are already tracked.
                        </p>

                        <div className="rounded-[1.2rem] border border-emerald-200 bg-emerald-50/70 p-4">
                            <h4 className="font-semibold text-emerald-800">Recommended focus</h4>
                            <p className="mt-2 text-sm leading-relaxed text-emerald-700">
                                Return to the practice problems and focus on {prettyConcept(primaryRecommendation?.focus_concepts?.[0])}.
                                If the next attempt still feels shaky, come back here and open Explain or Ask.
                            </p>
                        </div>

                        <button
                            onClick={handleClose}
                            className="editorial-button-secondary w-full py-3 text-sm"
                        >
                            Close rail and continue practicing
                        </button>
                    </div>
                )}

                {activeTab === 'ask' && (
                    <div className="space-y-4">
                        <div className="rounded-[1.2rem] border border-[var(--ath-line)] bg-[var(--ath-panel)] p-4 text-sm leading-6 text-[var(--ath-muted)]">
                            Short supports stay here. Longer questions move to chat.
                        </div>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={inputValue}
                                onChange={(event) => setInputValue(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' && !event.shiftKey) {
                                        event.preventDefault()
                                        const msg = inputValue.trim()
                                        if (!msg) return
                                        if (activeTraceId) {
                                            appendInterventionTrace(activeTraceId, {
                                                type: 'support_requested',
                                                status: 'engaged',
                                                detail: { support_type: 'ask', message_length: msg.length, surface: 'rail-launcher' }
                                            })
                                        }
                                        recordAdaptiveSignal(resolvedSectionId, 'chat_engagement', { messageLength: msg.length })
                                        window.dispatchEvent(new CustomEvent('open-chat', { detail: { message: msg } }))
                                        setInputValue('')
                                    }
                                }}
                                placeholder="Type your question, press Enter to launch the tutor chat..."
                                className="editorial-input flex-1 text-sm"
                            />
                            <button
                                onClick={() => {
                                    const msg = inputValue.trim()
                                    if (activeTraceId) {
                                        appendInterventionTrace(activeTraceId, {
                                            type: 'support_requested',
                                            status: 'engaged',
                                            detail: { support_type: 'ask', message_length: msg.length, surface: 'rail-launcher' }
                                        })
                                    }
                                    if (msg) {
                                        recordAdaptiveSignal(resolvedSectionId, 'chat_engagement', { messageLength: msg.length })
                                    }
                                    window.dispatchEvent(new CustomEvent('open-chat', { detail: { message: msg || undefined } }))
                                    setInputValue('')
                                }}
                                className="editorial-button px-4 py-2 text-sm"
                            >
                                Open chat
                            </button>
                        </div>
                        <p className="text-xs text-[var(--ath-secondary)]">
                            Same thread, same history.
                        </p>
                    </div>
                )}

                {supportAudit && (
                    <div className="mt-5 rounded-[1.2rem] border border-[var(--ath-line)] bg-[rgba(255,255,255,0.72)] p-4">
                        <div className="flex items-center justify-between gap-3">
                            <p className="editorial-label">Pedagogical audit</p>
                            <div className="flex items-center gap-2">
                                <span className="editorial-chip">{supportAudit.overall}/5</span>
                                <span className={`editorial-chip ${supportAudit.release_status === 'blocked' ? 'border-rose-200 bg-rose-50 text-rose-700' : supportAudit.release_status === 'review' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                                    {supportAudit.release_status}
                                </span>
                            </div>
                        </div>
                        <p className="mt-2 text-xs leading-6 text-[var(--ath-secondary)]">
                            Severity: {supportAudit.severity}. Validator {supportAudit.validator_pass ? 'passed' : 'flagged for review'}.
                        </p>
                        <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-[var(--ath-muted)]">
                            {Object.entries(supportAudit.rubric || {}).map(([key, value]) => (
                                <div key={key} className="rounded-xl border border-[var(--ath-line)] bg-white/70 px-3 py-2">
                                    <p className="font-semibold text-[var(--ath-text)]">{prettyConcept(key)}</p>
                                    <p className="mt-1">{value}/5</p>
                                </div>
                            ))}
                        </div>
                        {supportAudit.metrics && (
                            <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-[var(--ath-secondary)]">
                                <div className="rounded-xl border border-[var(--ath-line)] bg-white/70 px-3 py-2">
                                    <p className="font-semibold text-[var(--ath-text)]">Concept coverage</p>
                                    <p className="mt-1">{Math.round((supportAudit.metrics.concept_coverage || 0) * 100)}%</p>
                                </div>
                                <div className="rounded-xl border border-[var(--ath-line)] bg-white/70 px-3 py-2">
                                    <p className="font-semibold text-[var(--ath-text)]">Retrieval support</p>
                                    <p className="mt-1">{Math.round((supportAudit.metrics.retrieval_support || 0) * 100)}%</p>
                                </div>
                            </div>
                        )}
                        {(supportAudit.notes || []).length > 0 && (
                            <div className="mt-3 space-y-2">
                                {supportAudit.notes.map((note) => (
                                    <p key={note} className="text-xs leading-6 text-[var(--ath-secondary)]">{note}</p>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {(learnerState || learnerProfile) && (
                    <div className="mt-5 rounded-[1.2rem] border border-[var(--ath-line)] bg-[rgba(240,237,230,0.56)] p-4">
                        <p className="editorial-label">Learner-model snapshot</p>
                        <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-[var(--ath-muted)]">
                            <div className="rounded-xl bg-white/75 px-3 py-2">
                                <p className="font-semibold text-[var(--ath-text)]">Forgetting risk</p>
                                <p className="mt-1">{Math.round(((learnerState?.forgetting_risk ?? learnerProfile?.forgetting_risk ?? 0) * 100))}%</p>
                            </div>
                            <div className="rounded-xl bg-white/75 px-3 py-2">
                                <p className="font-semibold text-[var(--ath-text)]">Calibration drift</p>
                                <p className="mt-1">{Math.round(((learnerState?.calibration_drift ?? learnerProfile?.calibration_drift ?? 0) * 100))}%</p>
                            </div>
                            <div className="rounded-xl bg-white/75 px-3 py-2">
                                <p className="font-semibold text-[var(--ath-text)]">Transfer readiness</p>
                                <p className="mt-1">{Math.round(((learnerState?.transfer_readiness ?? learnerProfile?.transfer_readiness ?? 0) * 100))}%</p>
                            </div>
                            <div className="rounded-xl bg-white/75 px-3 py-2">
                                <p className="font-semibold text-[var(--ath-text)]">Dominant misconception</p>
                                <p className="mt-1">{prettyConcept(learnerState?.dominant_misconception || learnerProfile?.misconception_patterns?.[0]?.type || 'none flagged')}</p>
                            </div>
                            <div className="rounded-xl bg-white/75 px-3 py-2">
                                <p className="font-semibold text-[var(--ath-text)]">Predicted next success</p>
                                <p className="mt-1">{Math.round(((learnerProfile?.predicted_next_correct ?? reasoning?.evidence_snapshot?.predicted_next_correct ?? 0) * 100))}%</p>
                            </div>
                            <div className="rounded-xl bg-white/75 px-3 py-2">
                                <p className="font-semibold text-[var(--ath-text)]">Predicted retention</p>
                                <p className="mt-1">{Math.round(((learnerProfile?.predicted_retention ?? reasoning?.evidence_snapshot?.predicted_retention ?? 0) * 100))}%</p>
                            </div>
                            <div className="rounded-xl bg-white/75 px-3 py-2">
                                <p className="font-semibold text-[var(--ath-text)]">Stability index</p>
                                <p className="mt-1">{Math.round(((learnerProfile?.stability_index ?? reasoning?.evidence_snapshot?.stability_index ?? 0) * 100))}%</p>
                            </div>
                            <div className="rounded-xl bg-white/75 px-3 py-2">
                                <p className="font-semibold text-[var(--ath-text)]">Misconception pressure</p>
                                <p className="mt-1">{Math.round(((learnerProfile?.misconception_pressure ?? reasoning?.evidence_snapshot?.misconception_pressure ?? 0) * 100))}%</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {activeTab !== 'ask' && (
                <div className="border-t border-[var(--ath-line)] bg-[rgba(240,237,230,0.56)] p-4">
                    <p className="text-center text-xs text-[var(--ath-secondary)]">
                        Adaptive support blends mastery, practice friction, and learner feedback for this section.
                    </p>
                </div>
            )}
        </div>
    )
}
