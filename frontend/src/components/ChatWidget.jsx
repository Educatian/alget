import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import { supabase } from '../lib/supabase'
import { logChatMessage } from '../lib/loggingService'
import API_BASE from '../lib/apiConfig'
import { LearnIntentCard, EvaluateIntentCard, BrainstormIntentCard, ScaffoldingIntentCard, IllustrateIntentCard, SimulateIntentCard } from './IntentCards'

const ChatWidget = forwardRef(function ChatWidget({ context, initialQuestion, onQuestionSent, userId }, ref) {
    const [isOpen, setIsOpen] = useState(false)
    const [messages, setMessages] = useState([])
    const [inputValue, setInputValue] = useState('')
    const [loading, setLoading] = useState(false)
    const [historyLoaded, setHistoryLoaded] = useState(false)
    const messagesEndRef = useRef(null)

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
        open: () => setIsOpen(true),
        sendQuestion: (text) => {
            setInputValue(text)
            setIsOpen(true)
        }
    }))

    // Load chat history from Supabase
    useEffect(() => {
        if (!userId || !context?.sectionId || historyLoaded) return

        const loadHistory = async () => {
            try {
                const { data } = await supabase
                    .from('chat_history')
                    .select('messages')
                    .eq('user_id', userId)
                    .eq('section_id', context.sectionId)
                    .maybeSingle()

                if (data?.messages) {
                    setMessages(data.messages)
                }
            } catch (err) {
                // No history yet, that's fine
            }
            setHistoryLoaded(true)
        }

        loadHistory()
    }, [userId, context?.sectionId, historyLoaded])

    // Listen for global open-chat events
    useEffect(() => {
        const handleOpenChat = (e) => {
            const { message } = e.detail || {};
            if (message) {
                setInputValue(message);
                setIsOpen(true);
            }
        };
        window.addEventListener('open-chat', handleOpenChat);
        return () => window.removeEventListener('open-chat', handleOpenChat);
    }, []);

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

    // Handle initialQuestion from highlight selection - AUTO SEND
    useEffect(() => {
        if (initialQuestion && !loading) {
            const question = `Explain this passage: "${initialQuestion}"`
            setIsOpen(true)

            // Auto-send the question
            setTimeout(() => {
                sendMessageWithText(question)
            }, 100)

            onQuestionSent?.()
        }
    }, [initialQuestion])

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    const sendMessageWithText = async (text) => {
        if (!text.trim() || loading) return

        const userMessage = text.trim()
        const turnNumber = messages.length + 1
        const newMessages = [...messages, { role: 'user', content: userMessage }]
        setMessages(newMessages)
        setInputValue('')
        setLoading(true)

        // Log user message (PII-safe: length only)
        logChatMessage(turnNumber, userMessage.length, true, context?.sectionId)

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
            const assistantMessage = { role: 'assistant', content: data }
            const finalMessages = [...newMessages, assistantMessage]
            setMessages(finalMessages)

            // Log assistant response (just marking a response occurred, as length is now an object)
            logChatMessage(turnNumber + 1, 100, false, context?.sectionId)

            // Save to database
            await saveHistory(finalMessages)

            // ECD Phase 3: Telemetry Fusion - Soft Evidence for Chat Engagement
            // If the user is having a back-and-forth deep chat (turnNumber > 2) and we know the context
            if (turnNumber > 2 && context?.sectionId) {
                // Approximate a conceptId based on context (in a real system, you might ask the LLM what concept this was about)
                const primaryConcept = `concept_from_${context?.sectionId}`;
                fuseTelemetry(primaryConcept, 'chat_engagement', 1.0).catch(console.error);
            }

        } catch (err) {
            console.error(err)
            const errorMessages = [...newMessages, {
                role: 'assistant',
                content: 'Sorry, I encountered an error. Please try again.'
            }]
            setMessages(errorMessages)
        } finally {
            setLoading(false)
        }
    }

    const sendMessage = async () => {
        await sendMessageWithText(inputValue)
    }

    const handleKeyPress = (e) => {
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
                onClick={() => setIsOpen(!isOpen)}
                className={`fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-[0_8px_30px_rgba(158,27,50,0.4)] flex items-center justify-center transition-all duration-300 z-50 hover:scale-110 active:scale-95 ${isOpen
                    ? 'bg-slate-800 hover:bg-slate-900 shadow-[0_8px_30px_rgba(0,0,0,0.3)]'
                    : 'bg-linear-to-br from-[#9E1B32] to-[#C41E3A] hover:shadow-[0_12px_40px_rgba(196,30,58,0.6)]'
                    }`}
            >
                {isOpen ? (
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                ) : (
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                )}
            </button>

            {/* Chat Window */}
            {isOpen && (
                <div className="fixed bottom-24 right-6 w-[420px] h-[600px] glass-panel border border-white/60 shadow-[0_24px_60px_rgba(0,0,0,0.15)] flex flex-col overflow-hidden z-50 animate-fade-in origin-bottom-right">
                    {/* Header */}
                    <div className="bg-linear-to-r from-slate-900 to-slate-800 px-6 py-5 flex items-center justify-between shadow-md relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-40 h-40 bg-[#9E1B32]/30 rounded-full -mr-16 -mt-16 blur-[40px] pointer-events-none animate-float-slow"></div>
                        <div className="flex items-center gap-4 relative z-10">
                            <div className="w-10 h-10 rounded-full bg-linear-to-br from-[#9E1B32] to-[#7A1527] flex items-center justify-center text-xl shadow-inner border border-white/10">
                                🐘
                            </div>
                            <div>
                                <h3 className="text-white font-bold text-lg tracking-tight leading-tight">BigAL Tutor</h3>
                                <p className="text-slate-300 text-xs font-medium tracking-wide">
                                    {context?.course === 'inst-design' ? 'Instructional Design' : 'Bio-Inspired Engineering'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {messages.length > 0 && (
                                <button
                                    onClick={clearHistory}
                                    className="text-white/50 hover:text-white/80 text-xs"
                                    title="Clear history"
                                >
                                    🗑️
                                </button>
                            )}
                            <button
                                onClick={() => setIsOpen(false)}
                                className="text-white/70 hover:text-white p-1"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50 scroll-smooth">
                        {messages.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center text-center px-6 animate-fade-in">
                                <div className="w-16 h-16 mb-4 rounded-2xl bg-white shadow-sm flex items-center justify-center ring-1 ring-slate-100">
                                    <span className="text-3xl">✨</span>
                                </div>
                                <h4 className="text-slate-800 font-bold text-lg mb-2">How can I help you today?</h4>
                                <p className="text-slate-500 text-sm leading-relaxed">
                                    {context?.course === 'inst-design' ? 'Ask me about creating effective learning experiences.' : 'Ask me about bridging biological mechanisms into engineering design.'}
                                </p>
                            </div>
                        )}
                        {messages.map((msg, idx) => {
                            if (msg.role === 'user') {
                                return (
                                    <div key={idx} className="flex justify-end animate-fade-in">
                                        <div className="max-w-[85%] px-4 py-2.5 rounded-2xl text-[0.95rem] bg-linear-to-br from-[#9E1B32] to-[#7A1527] text-white rounded-br-sm shadow-md shadow-red-900/10 leading-relaxed font-medium">
                                            {msg.content}
                                        </div>
                                    </div>
                                )
                            } else {
                                // Assistant messages could be complex objects now
                                const data = typeof msg.content === 'object' ? msg.content : { intent: 'legacy', text: msg.content }

                                return (
                                    <div key={idx} className="flex justify-start animate-fade-in">
                                        <div className="max-w-[92%] px-4 py-3 rounded-2xl text-[0.95rem] bg-white text-slate-800 shadow-sm border border-slate-200/60 rounded-bl-sm leading-relaxed">
                                            {data.intent === 'learn' && <LearnIntentCard data={data} />}
                                            {data.intent === 'evaluate' && <EvaluateIntentCard data={data} />}
                                            {data.intent === 'brainstorm' && <BrainstormIntentCard data={data} />}
                                            {data.intent === 'help' && <ScaffoldingIntentCard data={data} />}
                                            {data.intent === 'illustrate' && <IllustrateIntentCard data={data} />}
                                            {data.intent === 'simulate' && <SimulateIntentCard data={data} />}
                                            {(!['learn', 'evaluate', 'brainstorm', 'help', 'illustrate', 'simulate'].includes(data.intent)) && (
                                                <p className="whitespace-pre-wrap">{data.text || JSON.stringify(data)}</p>
                                            )}
                                        </div>
                                    </div>
                                )
                            }
                        })}
                        {loading && (
                            <div className="flex justify-start animate-fade-in">
                                <div className="bg-white px-5 py-3.5 rounded-2xl rounded-bl-sm shadow-sm border border-slate-200/60">
                                    <div className="flex gap-1.5 items-center h-2">
                                        <span className="w-2 h-2 bg-[#9E1B32]/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                        <span className="w-2 h-2 bg-[#9E1B32]/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                        <span className="w-2 h-2 bg-[#9E1B32] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className="p-4 bg-white/60 backdrop-blur-3xl border-t border-white/80 shadow-[0_-10px_30px_rgba(0,0,0,0.03)] z-10">
                        <div className="flex gap-3 relative">
                            <input
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyPress={handleKeyPress}
                                placeholder="Type your question..."
                                className="flex-1 pl-5 pr-12 py-3 bg-white/80 border border-white focus:bg-white rounded-full text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#9E1B32]/40 shadow-inner transition-all placeholder:text-slate-400"
                            />
                            <button
                                onClick={sendMessage}
                                disabled={!inputValue.trim() || loading}
                                className="absolute right-1.5 top-1.5 bottom-1.5 w-9 h-9 bg-linear-to-br from-[#9E1B32] to-[#7A1527] text-white rounded-full flex items-center justify-center hover:shadow-md hover:shadow-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                <svg className="w-4 h-4 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
