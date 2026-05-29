import { useState, useRef, useEffect, forwardRef, useImperativeHandle, useEffectEvent } from 'react'
import { supabase } from '../lib/supabase'
import { logChatMessage } from '../lib/loggingService'
import { fuseTelemetry, recordAdaptiveSignal } from '../lib/knowledgeService'
import API_BASE from '../lib/apiConfig'
import { LearnIntentCard, EvaluateIntentCard, BrainstormIntentCard, ScaffoldingIntentCard, IllustrateIntentCard, SimulateIntentCard, ErrorIntentCard } from './IntentCards'

// Stable per-message id so React keys and the read-aloud "which bubble is
// speaking" state survive list mutations (history load replacing optimistic
// messages). Keying by array index mismapped both.
let _msgSeq = 0
const nextMsgId = () =>
    (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `m${++_msgSeq}`)
const withMsgId = (msg) => (msg && msg.id ? msg : { ...msg, id: nextMsgId() })

const ChatWidget = forwardRef(function ChatWidget({ context, initialQuestion, onQuestionSent, userId }, ref) {
    const [isOpen, setIsOpen] = useState(false)
    const [messages, setMessages] = useState([])
    const [inputValue, setInputValue] = useState('')
    const [loading, setLoading] = useState(false)
    const [historyLoaded, setHistoryLoaded] = useState(false)
    const [speakingId, setSpeakingId] = useState(null)
    const messagesEndRef = useRef(null)
    const lastAutoQuestionRef = useRef(null)
    const inputRef = useRef(null)
    const launcherRef = useRef(null)
    const wasOpenRef = useRef(false)

    const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window

    // Read-aloud (UDL multiple means of representation). Browser-native, no backend.
    const speakText = (text, id) => {
        if (!speechSupported || !text) return
        const synth = window.speechSynthesis
        // Toggle: clicking the speaking message stops it.
        if (speakingId === id) {
            synth.cancel()
            setSpeakingId(null)
            return
        }
        synth.cancel()
        const utterance = new SpeechSynthesisUtterance(String(text))
        utterance.onend = () => setSpeakingId(null)
        utterance.onerror = () => setSpeakingId(null)
        setSpeakingId(id)
        synth.speak(utterance)
    }

    // Stop any ongoing narration when the widget unmounts or the section changes.
    useEffect(() => {
        return () => {
            if (speechSupported) window.speechSynthesis.cancel()
        }
    }, [speechSupported])

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
        open: () => setIsOpen(true),
        sendQuestion: (text) => {
            setInputValue(text)
            setIsOpen(true)
        }
    }))

    useEffect(() => {
        setMessages([])
        setInputValue('')
        setLoading(false)
        setHistoryLoaded(false)
        lastAutoQuestionRef.current = null
        if (speechSupported) window.speechSynthesis.cancel()
        setSpeakingId(null)
    }, [context?.sectionId, speechSupported])

    // Manage focus for the chat dialog (WCAG 2.4.3 focus order):
    // move focus into the input when it opens, restore it to the launcher on close.
    useEffect(() => {
        if (isOpen) {
            const id = setTimeout(() => inputRef.current?.focus(), 0)
            wasOpenRef.current = true
            return () => clearTimeout(id)
        }
        if (wasOpenRef.current) {
            launcherRef.current?.focus()
            wasOpenRef.current = false
            if (speechSupported) window.speechSynthesis.cancel()
            setSpeakingId(null)
        }
    }, [isOpen, speechSupported])

    // Load chat history from Supabase
    useEffect(() => {
        if (!userId || !context?.sectionId || historyLoaded) return

        let cancelled = false
        const loadHistory = async () => {
            try {
                const { data } = await supabase
                    .from('chat_history')
                    .select('messages')
                    .eq('user_id', userId)
                    .eq('section_id', context.sectionId)
                    .maybeSingle()

                if (!cancelled && data?.messages) {
                    setMessages(data.messages.map(withMsgId))
                }
            } catch {
                // No history yet, that's fine
            }
            if (!cancelled) setHistoryLoaded(true)
        }

        loadHistory()
        return () => {
            cancelled = true
        }
    }, [userId, context?.sectionId, historyLoaded])

    // Listen for global open-chat events.
    // Detail shape: { message?: string, autoSend?: boolean (default true) }
    //   - no message  → just open the widget
    //   - message + autoSend=false → open and prefill input (user can edit)
    //   - message + autoSend=true (default) → open and send immediately,
    //     so the rail launcher feels like one continuous chat thread
    const handleOpenChatEvent = useEffectEvent((detail) => {
        const { message, autoSend = true } = detail || {}
        setIsOpen(true)
        if (!message) return
        if (autoSend) {
            void sendMessageWithText(message)
        } else {
            setInputValue(message)
        }
    })

    useEffect(() => {
        const handler = (event) => handleOpenChatEvent(event.detail)
        window.addEventListener('open-chat', handler)
        return () => window.removeEventListener('open-chat', handler)
    }, [])

    // Save chat history to Supabase
    const saveHistory = async (newMessages) => {
        if (!userId || !context?.sectionId) return

        try {
            await supabase
                .from('chat_history')
                .upsert({
                    user_id: userId,
                    section_id: context.sectionId,
                    messages: newMessages,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'user_id,section_id'
                })
        } catch (err) {
            console.warn('Could not save chat history:', err)
        }
    }

    const sendInitialQuestion = useEffectEvent((question) => {
        setIsOpen(true)
        void sendMessageWithText(question)
        onQuestionSent?.()
    })

    // Handle initialQuestion from highlight selection - AUTO SEND
    useEffect(() => {
        if (!initialQuestion || loading) return

        const question = `Explain this passage: "${initialQuestion}"`
        if (lastAutoQuestionRef.current === question) return

        lastAutoQuestionRef.current = question
        const timerId = setTimeout(() => {
            sendInitialQuestion(question)
        }, 100)

        return () => clearTimeout(timerId)
    }, [initialQuestion, loading])

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    const sendMessageWithText = async (text) => {
        if (!text.trim() || loading) return

        const userMessage = text.trim()
        const turnNumber = messages.length + 1
        const newMessages = [...messages, withMsgId({ role: 'user', content: userMessage })]
        setMessages(newMessages)
        setInputValue('')
        setLoading(true)

        // Log user message (PII-safe: length only)
        logChatMessage(turnNumber, userMessage.length, true, context?.sectionId)
        recordAdaptiveSignal(context?.sectionId, 'chat_engagement', {
            messageLength: userMessage.length,
            conceptId: context?.conceptIds?.[0] || null
        })

        const isHighlight = userMessage.startsWith('Explain this passage:');
        try {
            const apiKey = localStorage.getItem('gemini_api_key') || '';
            const res = await fetch(`${API_BASE}/orchestrate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: userMessage,
                    course: context?.course || "bio-inspired",
                    current_content: context?.pageContent ? context.pageContent.substring(0, 2000) : "",
                    history: messages.slice(-10), // Send more history for better context
                    is_highlight: isHighlight,
                    api_key: apiKey
                })
            })
            const data = await res.json()

            // The new API returns an intent object, not just a text string
            const assistantMessage = withMsgId({ role: 'assistant', content: data })
            const finalMessages = [...newMessages, assistantMessage]
            setMessages(finalMessages)

            // Log assistant response (just marking a response occurred, as length is now an object)
            logChatMessage(turnNumber + 1, 100, false, context?.sectionId)

            // Save to database
            await saveHistory(finalMessages)

            // ECD Phase 3: Telemetry Fusion - Soft Evidence for Chat Engagement
            if (turnNumber > 2 && context?.conceptIds?.[0]) {
                fuseTelemetry(context.conceptIds[0], 'chat_engagement', 1.0).catch(console.error)
            }

        } catch (err) {
            console.error(err)
            const errorMessages = [...newMessages, withMsgId({
                role: 'assistant',
                content: 'Sorry, I encountered an error. Please try again.'
            })]
            setMessages(errorMessages)
        } finally {
            setLoading(false)
        }
    }

    const sendMessage = async () => {
        await sendMessageWithText(inputValue)
    }

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            sendMessage()
        }
    }

    const clearHistory = async () => {
        if (confirm('Clear all chat history for this section?')) {
            setMessages([])
            if (userId && context?.sectionId) {
                await supabase
                    .from('chat_history')
                    .delete()
                    .eq('user_id', userId)
                    .eq('section_id', context.sectionId)
            }
        }
    }

    return (
        <>
            {/* Floating Bubble Button */}
            <button
                ref={launcherRef}
                onClick={() => setIsOpen(!isOpen)}
                aria-label={isOpen ? 'Close BigAL tutor chat' : 'Open BigAL tutor chat'}
                aria-expanded={isOpen}
                aria-haspopup="dialog"
                data-onboarding="chat-widget-button"
                className={`fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-[0_8px_30px_color-mix(in_srgb,var(--ath-primary)_34%,transparent)] transition-all duration-300 hover:scale-110 active:scale-95 ${isOpen
                    ? 'bg-[var(--ath-panel-muted)] hover:bg-[var(--ath-panel)]'
                    : 'bg-[var(--ath-primary)] hover:shadow-[0_12px_40px_color-mix(in_srgb,var(--ath-primary)_42%,transparent)]'
                    }`}
            >
                {isOpen ? (
                    <svg aria-hidden="true" className="h-6 w-6 text-[var(--ath-background)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                ) : (
                    <svg aria-hidden="true" className="h-6 w-6 text-[var(--ath-background)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                )}
            </button>

            {/* Chat Window */}
            {isOpen && (
                /* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- dialog captures Escape to close per WAI-ARIA dialog pattern */
                <div
                    role="dialog"
                    aria-modal="false"
                    aria-label="BigAL tutor chat"
                    onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                            e.stopPropagation()
                            setIsOpen(false)
                        }
                    }}
                    className="glass-panel fixed bottom-24 right-3 left-3 z-50 flex h-[min(600px,calc(100dvh-7rem))] w-auto origin-bottom-right animate-fade-in flex-col overflow-hidden border border-[var(--ath-line)] bg-[var(--ath-surface-strong)] shadow-[0_24px_60px_rgba(0,0,0,0.28)] sm:left-auto sm:right-6 sm:w-[min(420px,calc(100vw-2rem))]">
                    {/* Header */}
                    <div className="relative flex items-center justify-between overflow-hidden bg-[var(--ath-panel-muted)] px-6 py-5 shadow-md">
                        <div className="flex items-center gap-4 relative z-10">
                            <div aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--ath-line)] bg-[var(--ath-primary)] text-xl text-[var(--ath-background)] shadow-inner">
                                🐘
                            </div>
                            <div>
                                <h3 className="text-lg font-bold leading-tight tracking-tight text-[var(--ath-text)]">BigAL Tutor</h3>
                                <p className="text-xs font-medium tracking-wide text-[var(--ath-muted)]">
                                    {context?.course === 'inst-design' ? 'Instructional Design' : 'Bio-Inspired Engineering'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {messages.length > 0 && (
                                <button
                                    onClick={clearHistory}
                                    aria-label="Clear chat history for this section"
                                    className="flex h-11 w-11 items-center justify-center rounded-full text-base text-[var(--ath-muted)] hover:text-[var(--ath-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--ath-primary)_45%,transparent)]"
                                    title="Clear history"
                                >
                                    <span aria-hidden="true">🗑️</span>
                                </button>
                            )}
                            <button
                                onClick={() => setIsOpen(false)}
                                aria-label="Close BigAL tutor chat"
                                className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--ath-muted)] hover:text-[var(--ath-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--ath-primary)_45%,transparent)]"
                            >
                                <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Messages */}
                    <div
                        role="log"
                        aria-live="polite"
                        aria-relevant="additions"
                        aria-label="Conversation with BigAL tutor"
                        className="flex-1 space-y-6 overflow-y-auto bg-[var(--ath-panel-muted)] p-6 scroll-smooth"
                    >
                        {messages.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center text-center px-6 animate-fade-in">
                                <div aria-hidden="true" className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--ath-surface-strong)] shadow-sm ring-1 ring-[var(--ath-line)]">
                                    <span className="text-3xl">✨</span>
                                </div>
                                <h4 className="mb-2 text-lg font-bold text-[var(--ath-text)]">How can I help you today?</h4>
                                <p className="text-sm leading-relaxed text-[var(--ath-muted)]">
                                    {context?.course === 'inst-design' ? 'Ask me about creating effective learning experiences.' : 'Ask me about bridging biological mechanisms into engineering design.'}
                                </p>
                            </div>
                        )}
                        {messages.map((msg, idx) => {
                            const msgKey = msg.id || idx
                            if (msg.role === 'user') {
                                return (
                                    <div key={msgKey} className="flex justify-end animate-fade-in">
                                        <div className="max-w-[85%] break-words rounded-2xl rounded-br-sm bg-[var(--ath-primary)] px-3.5 py-2 text-[13px] font-medium leading-6 text-[var(--ath-background)] shadow-md">
                                            {msg.content}
                                        </div>
                                    </div>
                                )
                            } else {
                                // Assistant messages could be complex objects now
                                const data = typeof msg.content === 'object' ? msg.content : { intent: 'legacy', text: msg.content }
                                // Plain-text distillation of the response for read-aloud (UDL 1).
                                const spokenText = [data.summary, data.text, data.error, data.explanation]
                                    .filter((v) => typeof v === 'string' && v.trim())
                                    .join('. ')
                                    || (typeof msg.content === 'string' ? msg.content : '')
                                const isSpeaking = speakingId === msgKey

                                return (
                                    <div key={msgKey} className="flex justify-start animate-fade-in">
                                        <div className="max-w-[92%] rounded-2xl rounded-bl-sm border border-[var(--ath-line)] bg-[var(--ath-surface-strong)] px-3.5 py-2.5 text-[13px] leading-6 text-[var(--ath-text)] shadow-sm">
                                            {data.intent === 'learn' && <LearnIntentCard data={data} />}
                                            {data.intent === 'evaluate' && <EvaluateIntentCard data={data} />}
                                             {data.intent === 'brainstorm' && <BrainstormIntentCard data={data} />}
                                             {data.intent === 'help' && <ScaffoldingIntentCard data={data} />}
                                             {data.intent === 'illustrate' && <IllustrateIntentCard data={data} />}
                                             {data.intent === 'simulate' && <SimulateIntentCard data={data} />}
                                             {data.intent === 'error' && <ErrorIntentCard data={data} />}
                                             {(!['learn', 'evaluate', 'brainstorm', 'help', 'illustrate', 'simulate', 'error'].includes(data.intent)) && (
                                                 <p className="whitespace-pre-wrap break-words">{data.error || data.text || data.summary || JSON.stringify(data)}</p>
                                             )}
                                            {speechSupported && spokenText.trim() && (
                                                <div className="mt-2 flex justify-end">
                                                    <button
                                                        type="button"
                                                        onClick={() => speakText(spokenText, msgKey)}
                                                        aria-label={isSpeaking ? 'Stop reading this response aloud' : 'Read this response aloud'}
                                                        aria-pressed={isSpeaking}
                                                        className="inline-flex items-center gap-1 rounded-full border border-[var(--ath-line)] px-2 py-0.5 text-[11px] font-medium text-[var(--ath-muted)] transition-colors hover:text-[var(--ath-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--ath-primary)_45%,transparent)]"
                                                    >
                                                        <span aria-hidden="true">{isSpeaking ? '■' : '🔊'}</span>
                                                        <span>{isSpeaking ? 'Stop' : 'Listen'}</span>
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                            }
                        })}
                        {loading && (
                            <div className="flex justify-start animate-fade-in">
                                <div className="rounded-2xl rounded-bl-sm border border-[var(--ath-line)] bg-[var(--ath-surface-strong)] px-5 py-3.5 shadow-sm">
                                    <div aria-hidden="true" className="flex gap-1.5 items-center h-2">
                                        <span className="h-2 w-2 animate-bounce rounded-full bg-[color-mix(in_srgb,var(--ath-primary)_40%,transparent)]" style={{ animationDelay: '0ms' }}></span>
                                        <span className="h-2 w-2 animate-bounce rounded-full bg-[color-mix(in_srgb,var(--ath-primary)_65%,transparent)]" style={{ animationDelay: '150ms' }}></span>
                                        <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--ath-primary)]" style={{ animationDelay: '300ms' }}></span>
                                    </div>
                                    <span className="sr-only">BigAL is responding</span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className="z-10 border-t border-[var(--ath-line)] bg-[var(--ath-surface-strong)] p-4 shadow-[0_-10px_30px_rgba(0,0,0,0.08)] backdrop-blur-3xl">
                        <div className="flex gap-3 relative">
                            <input
                                ref={inputRef}
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={handleKeyDown}
                                aria-label="Type your question for BigAL"
                                placeholder="Type your question..."
                                className="min-h-[44px] flex-1 rounded-full border border-[var(--ath-line)] bg-[var(--ath-panel)] py-3 pl-5 pr-14 text-sm font-medium text-[var(--ath-text)] shadow-inner transition-all placeholder:text-[var(--ath-secondary)] focus:bg-[var(--ath-surface-strong)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--ath-primary)_34%,transparent)]"
                            />
                            <button
                                onClick={sendMessage}
                                aria-label="Send message to BigAL"
                                disabled={!inputValue.trim() || loading}
                                className="absolute bottom-1 right-1 top-1 flex w-11 items-center justify-center rounded-full bg-[var(--ath-primary)] text-[var(--ath-background)] transition-all hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--ath-primary)_45%,transparent)] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <svg aria-hidden="true" className="w-4 h-4 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div >
            )}
        </>
    )
})

export default ChatWidget
