import { useEffect, useState } from 'react'
import { LLM_API_BASE } from '../lib/apiConfig'
import { getAdaptiveRecommendation, recordAdaptiveSignal } from '../lib/knowledgeService'
import { logEvent } from '../lib/loggingService'
import {
    appendInterventionTrace,
    evaluateSupportContent,
    incrementConceptInterventionCount
} from '../lib/researchService'
import WhySupportNow from './WhySupportNow'
import BigALCompanion from './BigALCompanion'

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
    { id: 'teach', label: 'Teach' },
    { id: 'ask', label: 'Ask' }
]

function prettyConcept(conceptId) {
    if (!conceptId) return 'this concept'
    return conceptId.replace(/_/g, ' ')
}

// The pedagogical-audit scorecard ("x/5 — blocked — Severity ...") is a
// research/QA instrument. Learners should see the assist content (or an
// honest offline line), never the internal rubric. No researcher-mode flag
// exists in the frontend, so gate it to dev builds.
const SHOW_SUPPORT_AUDIT = import.meta.env.DEV

const SUPPORT_OFFLINE_MESSAGE = 'Support is offline or unavailable right now. Your reading, checks, and notes all still work — try again in a bit.'

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
    const [teachBack, setTeachBack] = useState('')

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
        logEvent('support_request', 'intel_rail', {
            support_type: 'explain',
            reason: resolvedStuckReason,
            trace_id: activeTraceId,
            concept_ids: recommendation?.primary_recommendation?.focus_concepts || []
        }, resolvedSectionId)
        if (activeTraceId) {
            appendInterventionTrace(activeTraceId, {
                type: 'support_requested',
                status: 'engaged',
                detail: { support_type: 'explain' }
            })
        }
        try {
            const apiKey = localStorage.getItem('gemini_api_key') || ''
            const res = await fetch(`${LLM_API_BASE}/assist/explain`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    section_id: resolvedSectionId,
                    section_title: resolvedSectionTitle,
                    problem_id: context?.problemId,
                    stuck_reason: resolvedStuckReason,
                    api_key: apiKey
                })
            })
            if (!res.ok) throw new Error(`assist_explain_${res.status}`)
            const data = await res.json()
            // A 503/error body ({"detail": ...}) has no explanation string —
            // treat it as offline instead of auditing empty content.
            if (typeof data.explanation !== 'string' || !data.explanation.trim()) {
                throw new Error('assist_explain_empty')
            }
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
            setExplanation(SUPPORT_OFFLINE_MESSAGE)
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
        logEvent('support_request', 'intel_rail', {
            support_type: 'represent',
            representation_type: type,
            trace_id: activeTraceId,
            concept_ids: recommendation?.primary_recommendation?.focus_concepts || []
        }, resolvedSectionId)
        if (activeTraceId) {
            appendInterventionTrace(activeTraceId, {
                type: 'support_requested',
                status: 'engaged',
                detail: { support_type: 'represent', representation_type: type }
            })
        }
        try {
            const apiKey = localStorage.getItem('gemini_api_key') || ''
            const res = await fetch(`${LLM_API_BASE}/assist/represent`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    section_id: resolvedSectionId,
                    section_title: resolvedSectionTitle,
                    representation_type: type,
                    api_key: apiKey
                })
            })
            if (!res.ok) throw new Error(`assist_represent_${res.status}`)
            const data = await res.json()
            if (typeof data.content !== 'string' || !data.content.trim()) {
                throw new Error('assist_represent_empty')
            }
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
            setRepresentation(SUPPORT_OFFLINE_MESSAGE)
        } finally {
            setLoading(false)
        }
    }

    // sendMessage / handleKeyDown removed when the Ask tab became a launcher
    // for the floating ChatWidget. The ChatWidget now owns chat state, history
    // persistence, and the /api/orchestrate call path. Rail dispatches an
    // 'open-chat' CustomEvent which ChatWidget listens for.

    const handleRecommendationAction = (action, coachPrompt = '') => {
        // The learner's click is the explicit accept/decline signal. Opening the
        // suggested support is an acceptance; choosing to keep moving past the
        // recommendation ('advance') is a decline. This is the learner ACTION,
        // which must not be conflated with the recommendation TYPE downstream.
        const accepted = action !== 'advance'
        recordAdaptiveSignal(resolvedSectionId, accepted ? 'intervention_accept' : 'intervention_decline', {
            action,
            accepted
        })
        logEvent('intervention_choice', 'intel_rail', {
            action,
            accepted,
            trace_id: activeTraceId,
            surface: 'recommendation_card'
        }, resolvedSectionId)
        if (activeTraceId) {
            appendInterventionTrace(activeTraceId, {
                type: 'recommendation_action',
                status: accepted ? 'engaged' : 'awaiting_outcome',
                detail: { action, accepted }
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
    const bigALState = activeTab === 'teach'
        ? 'teach'
        : recommendationLoading || loading
            ? 'notice'
            : activeTab === 'represent'
                ? 'mirror'
                : resolvedStuckReason
                    ? 'nudge'
                    : 'rest'

    const submitTeachBack = () => {
        const explanation = teachBack.trim()
        if (!explanation) return
        const focusConcept = prettyConcept(primaryRecommendation?.focus_concepts?.[0])
        const message = `I am teaching you ${focusConcept}. Reconstruct my explanation, cite the claims you used from it, and ask me to correct one possible misunderstanding:\n\n${explanation}`

        recordAdaptiveSignal(resolvedSectionId, 'teach_back_submitted', {
            messageLength: explanation.length,
            concept: primaryRecommendation?.focus_concepts?.[0] || null
        })
        logEvent('support_request', 'intel_rail', {
            support_type: 'teach_back',
            message_length: explanation.length,
            trace_id: activeTraceId,
            surface: 'rail-teach-back'
        }, resolvedSectionId)
        window.dispatchEvent(new CustomEvent('open-chat', { detail: { message } }))
        setTeachBack('')
    }

    // Wires the WhySupportNow contest/accept control to the SAME explicit
    // accepted/declined signal path that Phase 1 added. The learner's judgment of
    // the explanation is the explicit signal; it is not derived from the action
    // type. Declining contests the support without leaving the rail.
    const resolveSupportJudgment = ({ accepted }) => {
        recordAdaptiveSignal(resolvedSectionId, accepted ? 'intervention_accept' : 'intervention_decline', {
            action: primaryRecommendation?.action || null,
            accepted,
            surface: 'why-support-now'
        })
        logEvent('intervention_choice', 'intel_rail', {
            action: primaryRecommendation?.action || null,
            accepted,
            trace_id: activeTraceId,
            surface: 'why-support-now'
        }, resolvedSectionId)
        if (activeTraceId) {
            appendInterventionTrace(activeTraceId, {
                type: 'recommendation_action',
                status: accepted ? 'engaged' : 'awaiting_outcome',
                detail: { action: primaryRecommendation?.action || null, accepted, surface: 'why-support-now' }
            })
        }
    }

    const handleClose = () => {
        logEvent('support_rail_close', 'intel_rail', {
            trace_id: activeTraceId,
            active_tab: activeTab
        }, resolvedSectionId)
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
            <div className="border-b border-[var(--ath-line)] bg-[var(--ath-surface-strong)] p-3">
                <div className="mb-1.5 flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-2.5">
                        <BigALCompanion state={bigALState} size={38} className="shrink-0" />
                        <div className="min-w-0">
                            <p className="editorial-kicker">BigAL · {bigALState}</p>
                            <h2 className="mt-0.5 text-base font-semibold text-[var(--ath-primary-deep)]">Learning pulse</h2>
                            <p className="truncate text-xs text-[var(--ath-muted)]">{resolvedSectionTitle}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        className="editorial-button-secondary px-3 py-1.5 text-xs"
                    >
                        Close
                    </button>
                </div>
                {resolvedStuckReason && (
                    <div className="border-l-2 border-[var(--ath-primary)] px-2 py-1 text-xs leading-5 text-[var(--ath-primary-deep)]">
                        <span className="font-semibold">Detected:</span> {resolvedStuckReason}
                    </div>
                )}
                {context?.question && (
                    <div className="mt-3 border-l-2 border-[var(--ath-line-strong)] px-3 py-1.5 text-sm leading-6 text-[var(--ath-muted)]">
                        <span className="font-semibold text-[var(--ath-text)]">Focus prompt:</span> {context.question}
                    </div>
                )}
            </div>

            <div className="flex border-b border-[var(--ath-line)] bg-[rgba(240,237,230,0.6)]" role="tablist" aria-label="Adaptive support">
                {TABS.map((tab) => (
                    <button
                        key={tab.id}
                        role="tab"
                        id={`intelrail-tab-${tab.id}`}
                        aria-selected={activeTab === tab.id}
                        aria-controls="intelrail-tabpanel"
                        onClick={() => {
                            setActiveTab(tab.id)
                            logEvent('support_tab_select', 'intel_rail', {
                                tab_id: tab.id,
                                trace_id: activeTraceId
                            }, resolvedSectionId)
                        }}
                        className={`flex-1 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] transition-colors ${activeTab === tab.id
                            ? 'border-b-2 border-[var(--ath-primary)] bg-[rgba(255,255,255,0.74)] text-[var(--ath-primary)]'
                            : 'text-[var(--ath-secondary)] hover:text-[var(--ath-text)]'
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="flex-1 overflow-y-auto p-3" role="tabpanel" id="intelrail-tabpanel" aria-labelledby={`intelrail-tab-${activeTab}`}>
                <div className="mb-3 border-l-2 border-[var(--ath-primary)] px-3 py-2">
                    <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                            <p className="editorial-label">Recommended next step</p>
                                <h3 className="mt-1.5 text-base font-semibold text-[var(--ath-text)]">
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
                                <div className="hidden">
                                    {primaryRecommendation.evidence.map((item, index) => (
                                        <p key={`${item}-${index}`} className="text-xs leading-relaxed text-[var(--ath-secondary)]">
                                            {item}
                                        </p>
                                    ))}
                                </div>
                            )}

                            {reasoning && (
                                <details className="hidden">
                                    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[var(--ath-secondary)]">
                                        <span className="font-semibold">Why this | {Math.round((reasoning.confidence || 0) * 100)}% confidence</span>
                                        <span className="transition-transform">&gt;</span>
                                    </summary>
                                    {(reasoning.reason_codes || []).length > 0 && (
                                        <div className="mt-2 flex flex-wrap gap-1.5">
                                            {(reasoning.reason_codes || []).map((code) => (
                                                <span key={code} className="rounded-full bg-[var(--ath-panel)] px-2 py-0.5 text-[10px] font-medium text-[var(--ath-text)]">{prettyConcept(code)}</span>
                                            ))}
                                        </div>
                                    )}
                                    {(reasoning.recommended_because || []).length > 0 && (
                                        <ul className="mt-2 space-y-1 text-[11px] leading-5">
                                            {reasoning.recommended_because.slice(0, 3).map((item, index) => (
                                                <li key={`${item}-${index}`}>- {item}</li>
                                            ))}
                                        </ul>
                                    )}
                                    {actionScores.length > 0 && (
                                        <details className="mt-2 border-t border-[var(--ath-line)] pt-2">
                                            <summary className="cursor-pointer list-none text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--ath-secondary)] hover:text-[var(--ath-text)]">
                                                Policy scores ({reasoning.policy_strategy || 'heuristic_bandit_v2'})
                                            </summary>
                                            <div className="mt-2 space-y-2">
                                                {actionScores.map(([action, score]) => (
                                                    <div key={action}>
                                                        <div className="flex items-center justify-between text-[11px]">
                                                            <span className="font-semibold text-[var(--ath-text)]">{prettyConcept(action)}</span>
                                                            <span>{Math.round(score * 100)}%</span>
                                                        </div>
                                                        <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-[var(--ath-panel-muted)]">
                                                            <div
                                                                className="h-full rounded-full bg-[var(--ath-primary)]"
                                                                style={{ width: `${Math.max(6, Math.round(score * 100))}%` }}
                                                            ></div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </details>
                                    )}
                                </details>
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

                            {primaryRecommendation && (
                                <details className="group mt-3 border-t border-[var(--ath-line)] pt-2">
                                    <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold text-[var(--ath-secondary)]">
                                        <span>Why this support · {Math.round((reasoning?.confidence || 0) * 100)}% confidence</span>
                                        <span className="transition-transform group-open:rotate-90" aria-hidden="true">›</span>
                                    </summary>
                                    <WhySupportNow
                                        decision={recommendation}
                                        onResolve={resolveSupportJudgment}
                                    />
                                </details>
                            )}
                        </>
                    )}
                </div>

                {activeTab === 'explain' && (
                    <div className="space-y-4">
                        {!explanation ? (
                            <button
                                onClick={requestExplanation}
                                disabled={loading}
                                className="editorial-button w-full py-3 text-sm disabled:opacity-50"
                            >
                                {loading ? 'Generating...' : 'Get a simpler explanation'}
                            </button>
                        ) : (
                            <div className="rounded-[1.2rem] border border-[rgba(15,81,103,0.12)] bg-[rgba(200,226,236,0.28)] p-4" role="status" aria-live="polite">
                                <h4 className="mb-2 font-semibold text-[var(--ath-primary-deep)]">Simplified explanation</h4>
                                <p className="whitespace-pre-wrap text-sm leading-6 text-[var(--ath-text)]">{explanation}</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'represent' && (
                    <div className="space-y-4">
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
                            <div className="mt-4 rounded-[1.2rem] border border-[rgba(199,137,67,0.18)] bg-[rgba(255,221,187,0.38)] p-4" role="status" aria-live="polite">
                                <p className="whitespace-pre-wrap text-sm leading-6 text-[var(--ath-text)]">{representation}</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'practice' && (
                    <div className="space-y-4">
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
                                        logEvent('support_request', 'intel_rail', {
                                            support_type: 'ask',
                                            message_length: msg.length,
                                            trace_id: activeTraceId,
                                            surface: 'rail-launcher'
                                        }, resolvedSectionId)
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
                                    logEvent('support_request', 'intel_rail', {
                                        support_type: 'ask',
                                        message_length: msg.length,
                                        trace_id: activeTraceId,
                                        surface: 'rail-launcher'
                                    }, resolvedSectionId)
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

                {SHOW_SUPPORT_AUDIT && supportAudit && (
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
                    <details className="group mt-4 border-t border-[var(--ath-line)] pt-3">
                        <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold text-[var(--ath-secondary)]">
                            <span>Learner-model details</span>
                            <span className="transition-transform group-open:rotate-90" aria-hidden="true">›</span>
                        </summary>
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
                    </details>
                )}

                {activeTab === 'teach' && (
                    <div className="space-y-3">
                        <div>
                            <p className="editorial-label">Teach BigAL</p>
                            <h4 className="mt-1 text-base font-semibold text-[var(--ath-text)]">
                                Explain {prettyConcept(primaryRecommendation?.focus_concepts?.[0])} in your own words.
                            </h4>
                            <p className="mt-1 text-xs leading-5 text-[var(--ath-muted)]">
                                BigAL will reconstruct your reasoning and ask you to correct one possible misunderstanding.
                            </p>
                        </div>
                        <textarea
                            value={teachBack}
                            onChange={(event) => setTeachBack(event.target.value)}
                            rows={6}
                            placeholder="Start with: I think this works because..."
                            className="editorial-input w-full resize-y text-sm leading-6"
                            aria-label="Your explanation for BigAL"
                        />
                        <button
                            onClick={submitTeachBack}
                            disabled={!teachBack.trim()}
                            className="editorial-button w-full py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-45"
                        >
                            Let BigAL reconstruct it
                        </button>
                        <p className="text-xs leading-5 text-[var(--ath-secondary)]">
                            Your explanation stays editable. BigAL may be wrong; you make the final correction.
                        </p>
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
