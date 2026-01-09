import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'

const API_BASE = '/api'

const ChatWidget = forwardRef(function ChatWidget({ context, initialQuestion, onQuestionSent }, ref) {
    const [isOpen, setIsOpen] = useState(false)
    const [messages, setMessages] = useState([])
    const [inputValue, setInputValue] = useState('')
    const [loading, setLoading] = useState(false)
    const messagesEndRef = useRef(null)

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
        open: () => setIsOpen(true),
        sendQuestion: (text) => {
            setInputValue(text)
            setIsOpen(true)
        }
    }))

    // Handle initialQuestion from highlight selection
    useEffect(() => {
        if (initialQuestion) {
            setInputValue(`About this text: "${initialQuestion}"`)
            setIsOpen(true)
            onQuestionSent?.()
        }
    }, [initialQuestion, onQuestionSent])

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    const sendMessage = async () => {
        if (!inputValue.trim() || loading) return

        const userMessage = inputValue.trim()
        setInputValue('')
        setMessages(prev => [...prev, { role: 'user', content: userMessage }])
        setLoading(true)

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
            setMessages(prev => [...prev, { role: 'assistant', content: data.response }])
        } catch (err) {
            console.error(err)
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: 'Sorry, I encountered an error. Please try again.'
            }])
        } finally {
            setLoading(false)
        }
    }

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            sendMessage()
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
                        <button
                            onClick={() => setIsOpen(false)}
                            className="text-white/70 hover:text-white p-1"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
                        {messages.length === 0 && (
                            <div className="text-center text-gray-400 py-12">
                                <span className="text-5xl block mb-3">🐘</span>
                                <p className="text-sm font-medium text-gray-600">Hi! I'm BigAL</p>
                                <p className="text-xs mt-1">Ask me about Statics or Dynamics!</p>
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
