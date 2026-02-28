import { useState, useRef, useEffect } from 'react'
import API_BASE from '../lib/apiConfig'

export default function IntelRail({ context, stuckEvent, onClose }) {
    const [activeTab, setActiveTab] = useState('explain')
    const [loading, setLoading] = useState(false)
    const [explanation, setExplanation] = useState(null)
    const [representation, setRepresentation] = useState(null)

    // Chat state
    const [messages, setMessages] = useState([])
    const [inputValue, setInputValue] = useState('')
    const [chatLoading, setChatLoading] = useState(false)
    const messagesEndRef = useRef(null)

    // Auto-scroll to bottom of chat
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    // Request easier explanation
    const requestExplanation = async () => {
        if (!context) return
        setLoading(true)
        try {
            const apiKey = localStorage.getItem('gemini_api_key') || '';
            const res = await fetch(`${API_BASE}/assist/explain`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    section_id: context.sectionId,
                    problem_id: context.problemId,
                    stuck_reason: context.reason,
                    api_key: apiKey
                })
            })
            const data = await res.json()
            setExplanation(data.explanation)
        } catch (err) {
            console.error(err)
            setExplanation('Unable to generate explanation. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    // Request different representation
    const requestRepresentation = async (type) => {
        if (!context) return
        setLoading(true)
        try {
            const apiKey = localStorage.getItem('gemini_api_key') || '';
            const res = await fetch(`${API_BASE}/assist/represent`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    section_id: context.sectionId,
                    representation_type: type,
                    api_key: apiKey
                })
            })
            const data = await res.json()
            setRepresentation(data.content)
        } catch (err) {
            console.error(err)
            setRepresentation('Unable to generate representation.')
        } finally {
            setLoading(false)
        }
    }

    // Send chat message
    const sendMessage = async () => {
        if (!inputValue.trim() || chatLoading) return

        const userMessage = inputValue.trim()
        setInputValue('')
        setMessages(prev => [...prev, { role: 'user', content: userMessage }])
        setChatLoading(true)

        try {
            const apiKey = localStorage.getItem('gemini_api_key') || '';
            const res = await fetch(`${API_BASE}/assist/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userMessage,
                    section_id: context?.sectionId || 'general',
                    history: messages.slice(-6), // Last 6 messages for context
                    api_key: apiKey
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
            setChatLoading(false)
        }
    }

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            sendMessage()
        }
    }

    const tabs = [
        { id: 'explain', icon: '💡', label: 'Explain' },
        { id: 'represent', icon: '🔄', label: 'View' },
        { id: 'practice', icon: '✏️', label: 'Practice' }
    ]

    return (
        <div className="h-full flex flex-col">
            {/* Rail Header */}
            <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-[#9E1B32] to-[#7A1527]">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-white font-bold">🐘 BigAL</h2>
                    <button
                        onClick={onClose}
                        className="text-white/70 hover:text-white"
                    >
                        ✕
                    </button>
                </div>
                {stuckEvent && (
                    <div className="bg-white/10 rounded-lg px-3 py-2 text-white/90 text-sm">
                        <span className="font-medium">Detected:</span> {stuckEvent.reason}
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 bg-gray-50">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 py-2.5 text-xs font-medium transition-colors ${activeTab === tab.id
                            ? 'bg-white text-[#9E1B32] border-b-2 border-[#9E1B32]'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <span className="block text-base mb-0.5">{tab.icon}</span>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-4">
                {/* Easier Explanation Tab */}
                {activeTab === 'explain' && (
                    <div className="space-y-4">
                        <p className="text-sm text-gray-600">
                            Having trouble? Get a simpler explanation of the current concept.
                        </p>

                        {!explanation ? (
                            <button
                                onClick={requestExplanation}
                                disabled={loading}
                                className="w-full py-3 bg-[#9E1B32] text-white rounded-lg font-medium hover:bg-[#7A1527] transition-colors disabled:opacity-50"
                            >
                                {loading ? '⏳ Generating...' : '💡 Get Easier Explanation'}
                            </button>
                        ) : (
                            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                                <h4 className="font-semibold text-blue-800 mb-2">Simplified Explanation</h4>
                                <p className="text-sm text-blue-700 whitespace-pre-wrap">{explanation}</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Different Representation Tab */}
                {activeTab === 'represent' && (
                    <div className="space-y-4">
                        <p className="text-sm text-gray-600">
                            See the concept in a different way.
                        </p>

                        <div className="grid grid-cols-2 gap-2">
                            {[
                                { type: 'mindmap', icon: '🗺️', label: 'Mind Map' },
                                { type: 'analogy', icon: '🎯', label: 'Analogy' },
                                { type: 'visual', icon: '📊', label: 'Visual' },
                                { type: 'formula', icon: '📐', label: 'Formula' }
                            ].map(opt => (
                                <button
                                    key={opt.type}
                                    onClick={() => requestRepresentation(opt.type)}
                                    disabled={loading}
                                    className="p-3 border border-gray-200 rounded-lg text-center hover:bg-gray-50 transition-colors disabled:opacity-50"
                                >
                                    <span className="block text-2xl mb-1">{opt.icon}</span>
                                    <span className="text-xs text-gray-600">{opt.label}</span>
                                </button>
                            ))}
                        </div>

                        {representation && (
                            <div className="bg-amber-50 border border-amber-100 rounded-lg p-4 mt-4">
                                <p className="text-sm text-amber-800 whitespace-pre-wrap">{representation}</p>
                            </div>
                        )}
                    </div>
                )}

                {/* More Practice Tab */}
                {activeTab === 'practice' && (
                    <div className="space-y-4">
                        <p className="text-sm text-gray-600">
                            Get additional practice problems on this topic.
                        </p>

                        <button
                            className="w-full py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors"
                        >
                            ✏️ Generate Practice Problem
                        </button>

                        <div className="text-center text-gray-400 text-sm py-8">
                            <span className="text-3xl block mb-2">🔜</span>
                            Coming soon
                        </div>
                    </div>
                )}

                {/* Ask Chat Tab */}
                {activeTab === 'ask' && (
                    <div className="flex flex-col h-full -m-4">
                        {/* Chat Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {messages.length === 0 && (
                                <div className="text-center text-gray-400 py-8">
                                    <span className="text-4xl block mb-2">💬</span>
                                    <p className="text-sm">Ask me anything about this section!</p>
                                    <p className="text-xs mt-1">I'm here to help you understand.</p>
                                </div>
                            )}
                            {messages.map((msg, idx) => (
                                <div
                                    key={idx}
                                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div
                                        className={`max-w-[85%] px-3 py-2 rounded-lg text-sm ${msg.role === 'user'
                                            ? 'bg-[#9E1B32] text-white'
                                            : 'bg-gray-100 text-gray-800'
                                            }`}
                                    >
                                        {msg.content}
                                    </div>
                                </div>
                            ))}
                            {chatLoading && (
                                <div className="flex justify-start">
                                    <div className="bg-gray-100 px-3 py-2 rounded-lg text-sm text-gray-500">
                                        <span className="animate-pulse">Thinking...</span>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Chat Input */}
                        <div className="border-t border-gray-200 p-3 bg-white">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyPress={handleKeyPress}
                                    placeholder="Ask a question..."
                                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#9E1B32]"
                                />
                                <button
                                    onClick={sendMessage}
                                    disabled={!inputValue.trim() || chatLoading}
                                    className="px-4 py-2 bg-[#9E1B32] text-white rounded-lg text-sm font-medium hover:bg-[#7A1527] disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Send
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Rail Footer - hide on chat tab */}
            {activeTab !== 'ask' && (
                <div className="p-4 border-t border-gray-200 bg-gray-50">
                    <p className="text-xs text-gray-500 text-center">
                        Powered by Google Gemini AI
                    </p>
                </div>
            )}
        </div>
    )
}
