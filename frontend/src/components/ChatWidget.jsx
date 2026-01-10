import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import { supabase } from '../lib/supabase'
import { logChatMessage } from '../lib/loggingService'
import API_BASE from '../lib/apiConfig'

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
                    .single()

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

        try {
            const res = await fetch(`${API_BASE}/assist/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userMessage,
                    section_id: context?.sectionId || 'general',
                    page_content: context?.pageContent || '',
                    section_title: context?.sectionTitle || '',
                    history: messages.slice(-6)
                })
            })
            const data = await res.json()
            const assistantMessage = { role: 'assistant', content: data.response }
            const finalMessages = [...newMessages, assistantMessage]
            setMessages(finalMessages)

            // Log assistant response (PII-safe: length only)
            logChatMessage(turnNumber + 1, data.response.length, false, context?.sectionId)

            // Save to database
            await saveHistory(finalMessages)
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
                className={`fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 z-50 ${isOpen
                    ? 'bg-gray-600 hover:bg-gray-700'
                    : 'bg-[#9E1B32] hover:bg-[#7A1527]'
                    }`}
            >
                {isOpen ? (
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                ) : (
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                )}
            </button>

            {/* Chat Window */}
            {isOpen && (
                <div className="fixed bottom-24 right-6 w-96 h-[500px] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden z-50 border border-gray-200">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-[#9E1B32] to-[#7A1527] px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-2xl">🐘</span>
                            <div>
                                <h3 className="text-white font-bold text-sm">BigAL</h3>
                                <p className="text-white/70 text-xs">Your Engineering Tutor</p>
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
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
                        {messages.length === 0 && (
                            <div className="text-center text-gray-400 py-12">
                                <span className="text-5xl block mb-3">🐘</span>
                                <p className="text-sm font-medium text-gray-600">Hi! I'm BigAL</p>
                                <p className="text-xs mt-1">Ask me about Statics or Dynamics!</p>
                                <p className="text-xs mt-3 text-gray-400">
                                    💡 Tip: Select text and click "Ask BigAL"
                                </p>
                            </div>
                        )}
                        {messages.map((msg, idx) => (
                            <div
                                key={idx}
                                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${msg.role === 'user'
                                        ? 'bg-[#9E1B32] text-white rounded-br-md'
                                        : 'bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-md'
                                        }`}
                                >
                                    {msg.content}
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className="flex justify-start">
                                <div className="bg-white px-4 py-2 rounded-2xl rounded-bl-md shadow-sm border border-gray-100">
                                    <div className="flex gap-1">
                                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className="p-3 bg-white border-t border-gray-100">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyPress={handleKeyPress}
                                placeholder="Type your question..."
                                className="flex-1 px-4 py-2.5 bg-gray-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-[#9E1B32]/20"
                            />
                            <button
                                onClick={sendMessage}
                                disabled={!inputValue.trim() || loading}
                                className="w-10 h-10 bg-[#9E1B32] text-white rounded-full flex items-center justify-center hover:bg-[#7A1527] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
})

export default ChatWidget
