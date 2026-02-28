import { useState, useRef, useEffect, useCallback } from 'react'
import { MessageSquarePlus, Sparkles, X } from 'lucide-react'

// Internal component for handling the highlighted text and its tooltip logic
export default function TextAnnotator({ content, onAskAi, onAddNote }) {
    const containerRef = useRef(null)
    const [selection, setSelection] = useState(null)

    // Handle text selection
    const handleMouseUp = useCallback(() => {
        const sel = window.getSelection()
        const text = sel.toString().trim()

        if (text && text.length > 5) { // Only trigger on meaningful selections
            const range = sel.getRangeAt(0)
            const rect = range.getBoundingClientRect()
            const containerRect = containerRef.current.getBoundingClientRect()

            // Calculate position relative to container
            setSelection({
                text,
                top: rect.top - containerRect.top - 50, // 50px above the selection
                left: rect.left - containerRect.left + (rect.width / 2),
                range,
                timestamp: Date.now()
            })
        } else {
            setSelection(null)
        }
    }, [])

    // Clear selection on click outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setSelection(null)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    return (
        <div
            ref={containerRef}
            className="relative"
            onMouseUp={handleMouseUp}
        >
            {/* The actual markdown content comes as children usually, but we inject it here to wrap it */}
            <div className="markdown-content-wrapper">
                {content}
            </div>

            {/* Floating Action Menu for Selected Text */}
            {selection && (
                <div
                    className="absolute z-50 flex items-center gap-1 bg-slate-900 border border-slate-700 p-1 rounded-xl shadow-2xl animate-in zoom-in-95 duration-200"
                    style={{
                        top: `${selection.top}px`,
                        left: `${selection.left}px`,
                        transform: 'translateX(-50%)'
                    }}
                >
                    <button
                        onClick={() => {
                            const latencyMs = Date.now() - selection.timestamp;
                            onAskAi(selection.text, latencyMs);
                            setSelection(null)
                            window.getSelection().removeAllRanges()
                        }}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 rounded-lg transition-colors group"
                    >
                        <Sparkles className="w-4 h-4 text-indigo-400 group-hover:text-indigo-300" />
                        Ask AI
                    </button>

                    <div className="w-px h-5 bg-slate-700 mx-1"></div>

                    <button
                        onClick={() => {
                            onAddNote(selection.text)
                            setSelection(null)
                            window.getSelection().removeAllRanges()
                        }}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 rounded-lg transition-colors group"
                    >
                        <MessageSquarePlus className="w-4 h-4 text-emerald-400 group-hover:text-emerald-300" />
                        Add Note
                    </button>

                    {/* Triangle pointer */}
                    <div className="absolute left-1/2 -bottom-2 -translate-x-1/2 border-8 border-transparent border-t-slate-900"></div>
                </div>
            )}
        </div>
    )
}
