import { useEffect, useRef, useState } from 'react'
import API_BASE from '../lib/apiConfig'
import { getAdaptiveRecommendation, recordAdaptiveSignal } from '../lib/knowledgeService'

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

    const [messages, setMessages] = useState([])
    const [inputValue, setInputValue] = useState('')
    const [chatLoading, setChatLoading] = useState(false)
    const messagesEndRef = useRef(null)

    const resolvedSectionId = context?.sectionId || sectionInfo?.sectionId || 'general'
    const resolvedSectionTitle = sectionInfo?.sectionTitle || resolvedSectionId
    const conceptKey = (sectionInfo?.conceptIds || []).join('|')
    const resolvedHeading = sectionInfo?.currentHeading || resolvedSectionTitle
    const resolvedStuckReason = context?.reason || stuckEvent?.reason || null

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    useEffect(() => {
        let cancelled = false

        const loadRecommendation = async () => {
            setRecommendationLoading(true)
            const nextRecommendation = await getAdaptiveRecommendation({
                sectionId: resolvedSectionId,
                sectionTitle: resolvedSectionTitle,
                conceptIds: conceptKey ? conceptKey.split('|') : [],
                currentHeading: resolvedHeading,
                stuckReason: resolvedStuckReason
            })

            if (cancelled) return

            setRecommendation(nextRecommendation)

            const suggestedAction = nextRecommendation?.primary_recommendation?.action
            if (suggestedAction && ACTION_TO_TAB[suggestedAction]) {
                setActiveTab(ACTION_TO_TAB[suggestedAction])
                if (suggestedAction === 'ask' && nextRecommendation.primary_recommendation.coach_prompt) {
                    setInputValue(nextRecommendation.primary_recommendation.coach_prompt)
                }
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
        resolvedStuckReason
    ])

    const requestExplanation = async () => {
        if (!resolvedSectionId) return
        setLoading(true)
        recordAdaptiveSignal(resolvedSectionId, 'explanation_request', {
            reason: resolvedStuckReason
        })
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
        } catch (error) {
            console.error(error)
            setRepresentation('Unable to generate representation.')
        } finally {
            setLoading(false)
        }
    }

    const sendMessage = async () => {
        if (!inputValue.trim() || chatLoading) return

        const userMessage = inputValue.trim()
        setInputValue('')
        setMessages((previous) => [...previous, { role: 'user', content: userMessage }])
        setChatLoading(true)
        recordAdaptiveSignal(resolvedSectionId, 'chat_engagement', {
            messageLength: userMessage.length
        })

        try {
            const apiKey = localStorage.getItem('gemini_api_key') || import.meta.env.VITE_GEMINI_API_KEY || ''
            const res = await fetch(`${API_BASE}/assist/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userMessage,
                    section_id: resolvedSectionId,
                    page_content: sectionInfo?.pageContent || '',
                    section_title: resolvedSectionTitle,
                    history: messages.slice(-6),
                    api_key: apiKey
                })
            })
            const data = await res.json()
            setMessages((previous) => [...previous, { role: 'assistant', content: data.response }])
        } catch (error) {
            console.error(error)
            setMessages((previous) => [
                ...previous,
                {
                    role: 'assistant',
                    content: 'Sorry, I encountered an error. Please try again.'
                }
            ])
        } finally {
            setChatLoading(false)
        }
    }

    const handleKeyDown = (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            sendMessage()
        }
    }

    const handleRecommendationAction = (action, coachPrompt = '') => {
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

    return (
        <div className="flex h-full flex-col">
            <div className="border-b border-gray-200 bg-gradient-to-r from-[#9E1B32] to-[#7A1527] p-4">
                <div className="mb-2 flex items-center justify-between">
                    <div>
                        <h2 className="font-bold text-white">BigAL Support Rail</h2>
                        <p className="text-xs text-white/75">{resolvedSectionTitle}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-sm text-white/75 transition-colors hover:text-white"
                    >
                        Close
                    </button>
                </div>
                {resolvedStuckReason && (
                    <div className="rounded-lg bg-white/10 px-3 py-2 text-sm text-white/90">
                        <span className="font-semibold">Detected:</span> {resolvedStuckReason}
                    </div>
                )}
            </div>

            <div className="flex border-b border-gray-200 bg-gray-50">
                {TABS.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${activeTab === tab.id
                            ? 'border-b-2 border-[#9E1B32] bg-white text-[#9E1B32]'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4">
                <div className="mb-4 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 shadow-sm">
                    <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                                Recommended next step
                            </p>
                            <h3 className="mt-1 text-base font-semibold text-slate-900">
                                {recommendationLoading
                                    ? 'Building a recommendation...'
                                    : primaryRecommendation?.title || 'We are gathering enough evidence to guide the next move.'}
                            </h3>
                        </div>
                        {learnerState && (
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                                {learnerState.confidence_signal}
                            </span>
                        )}
                    </div>

                    {recommendationLoading ? (
                        <p className="text-sm text-slate-500">
                            Looking at mastery, recent friction, and engagement signals for this section.
                        </p>
                    ) : (
                        <>
                            <p className="text-sm leading-relaxed text-slate-600">
                                {primaryRecommendation?.rationale || 'Open a help tab to get targeted support for this section.'}
                            </p>

                            {primaryRecommendation?.focus_concepts?.length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {primaryRecommendation.focus_concepts.map((concept) => (
                                        <span
                                            key={concept}
                                            className="rounded-full bg-[#9E1B32]/7 px-3 py-1 text-xs font-medium text-[#9E1B32]"
                                        >
                                            {prettyConcept(concept)}
                                        </span>
                                    ))}
                                </div>
                            )}

                            {primaryRecommendation?.evidence?.length > 0 && (
                                <div className="mt-3 space-y-2">
                                    {primaryRecommendation.evidence.map((item, index) => (
                                        <p key={`${item}-${index}`} className="text-xs leading-relaxed text-slate-500">
                                            {item}
                                        </p>
                                    ))}
                                </div>
                            )}

                            <div className="mt-4 flex flex-wrap gap-2">
                                <button
                                    onClick={() => handleRecommendationAction(primaryRecommendation?.action, primaryRecommendation?.coach_prompt)}
                                    className="rounded-lg bg-[#9E1B32] px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#7A1527]"
                                >
                                    {primaryRecommendation?.action === 'advance' ? 'Keep moving' : 'Open suggested support'}
                                </button>
                                {recommendation?.secondary_recommendations?.slice(0, 2).map((item) => (
                                    <button
                                        key={item.action}
                                        onClick={() => handleRecommendationAction(item.action, item.coach_prompt)}
                                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
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
                        <p className="text-sm text-gray-600">
                            Ask for a simpler explanation tied to the exact section where the learner is slowing down.
                        </p>

                        {!explanation ? (
                            <button
                                onClick={requestExplanation}
                                disabled={loading}
                                className="w-full rounded-lg bg-[#9E1B32] py-3 font-medium text-white transition-colors hover:bg-[#7A1527] disabled:opacity-50"
                            >
                                {loading ? 'Generating...' : 'Get a simpler explanation'}
                            </button>
                        ) : (
                            <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
                                <h4 className="mb-2 font-semibold text-blue-800">Simplified explanation</h4>
                                <p className="whitespace-pre-wrap text-sm text-blue-700">{explanation}</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'represent' && (
                    <div className="space-y-4">
                        <p className="text-sm text-gray-600">
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
                                    className="rounded-lg border border-gray-200 p-3 text-center text-sm font-medium text-slate-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>

                        {representation && (
                            <div className="mt-4 rounded-lg border border-amber-100 bg-amber-50 p-4">
                                <p className="whitespace-pre-wrap text-sm text-amber-800">{representation}</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'practice' && (
                    <div className="space-y-4">
                        <p className="text-sm text-gray-600">
                            The best practice move lives in the section practice block, where mastery updates and stuck detection are already tracked.
                        </p>

                        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                            <h4 className="font-semibold text-emerald-800">Recommended focus</h4>
                            <p className="mt-2 text-sm leading-relaxed text-emerald-700">
                                Return to the practice problems and focus on {prettyConcept(primaryRecommendation?.focus_concepts?.[0])}.
                                If the next attempt still feels shaky, come back here and open Explain or Ask.
                            </p>
                        </div>

                        <button
                            onClick={onClose}
                            className="w-full rounded-lg border border-emerald-200 bg-white py-3 font-medium text-emerald-700 transition-colors hover:bg-emerald-50"
                        >
                            Close rail and continue practicing
                        </button>
                    </div>
                )}

                {activeTab === 'ask' && (
                    <div className="flex h-full flex-col -m-4">
                        <div className="flex-1 space-y-3 overflow-y-auto p-4">
                            {messages.length === 0 && (
                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                                    Ask about the exact step that feels unstable. Short, diagnostic questions usually work best here.
                                </div>
                            )}

                            {messages.map((message, index) => (
                                <div
                                    key={`${message.role}-${index}`}
                                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div
                                        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${message.role === 'user'
                                            ? 'bg-[#9E1B32] text-white'
                                            : 'bg-gray-100 text-gray-800'
                                            }`}
                                    >
                                        {message.content}
                                    </div>
                                </div>
                            ))}

                            {chatLoading && (
                                <div className="flex justify-start">
                                    <div className="rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-500">
                                        Thinking...
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        <div className="border-t border-gray-200 bg-white p-3">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={inputValue}
                                    onChange={(event) => setInputValue(event.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Ask BigAL about the next step..."
                                    className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#9E1B32] focus:outline-none"
                                />
                                <button
                                    onClick={sendMessage}
                                    disabled={!inputValue.trim() || chatLoading}
                                    className="rounded-lg bg-[#9E1B32] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#7A1527] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    Send
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {activeTab !== 'ask' && (
                <div className="border-t border-gray-200 bg-gray-50 p-4">
                    <p className="text-center text-xs text-gray-500">
                        Adaptive support blends mastery, practice friction, and learner feedback for this section.
                    </p>
                </div>
            )}
        </div>
    )
}
