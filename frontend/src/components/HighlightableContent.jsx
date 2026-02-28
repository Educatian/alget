import { useState, useRef, useEffect, useCallback } from 'react'
import { useTextSelection } from '../hooks/useTextSelection'
import { logHighlightCreate } from '../lib/loggingService'
import API_BASE from '../lib/apiConfig'
import { MessageSquarePlus, Sparkles, Highlighter, X } from 'lucide-react'

/**
 * Highlightable content wrapper with selection popup, notes, and collaborative highlights
 */
export default function HighlightableContent({
    children,
    sectionId,
    userId,
    onAskBigAL
}) {
    const containerRef = useRef(null)
    const [selectionState, setSelectionState] = useState(null)
    const [noteInput, setNoteInput] = useState('')
    const [showNoteInput, setShowNoteInput] = useState(false)
    const [editingNoteId, setEditingNoteId] = useState(null)
    const [hoveredHighlight, setHoveredHighlight] = useState(null)

    const {
        highlights,
        peerHighlights,
        popularHighlights,
        saveHighlight,
        updateHighlightNote,
        deleteHighlight,
    } = useTextSelection({ sectionId, userId })

    // Apply highlights to DOM after content renders
    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        // Remove existing highlight marks first and normalize
        const existingMarks = container.querySelectorAll('mark[data-highlight]')
        existingMarks.forEach(mark => {
            const parent = mark.parentNode
            if (parent) {
                while (mark.firstChild) {
                    parent.insertBefore(mark.firstChild, mark)
                }
                parent.removeChild(mark)
                parent.normalize()
            }
        })

        // Helper function to apply highlight
        const applyHighlight = (text, options) => {
            if (!text || text.length < 3) return

            const { className, title, type, highlightId, note, count, onClick, onHover } = options

            const walker = document.createTreeWalker(
                container,
                NodeFilter.SHOW_TEXT,
                null,
                false
            )

            const textNodes = []
            let node
            while ((node = walker.nextNode())) {
                if (node.parentElement?.tagName === 'MARK') continue
                if (node.textContent.toLowerCase().includes(text.toLowerCase())) {
                    textNodes.push(node)
                }
            }

            textNodes.forEach(textNode => {
                const nodeText = textNode.textContent
                const searchLower = text.toLowerCase()
                const textLower = nodeText.toLowerCase()
                const index = textLower.indexOf(searchLower)

                if (index !== -1) {
                    const before = nodeText.slice(0, index)
                    const match = nodeText.slice(index, index + text.length)
                    const after = nodeText.slice(index + text.length)

                    const fragment = document.createDocumentFragment()

                    if (before) fragment.appendChild(document.createTextNode(before))

                    const wrapper = document.createElement('span')
                    wrapper.className = 'relative inline'

                    const mark = document.createElement('mark')
                    mark.className = className
                    mark.setAttribute('data-highlight', type)
                    if (highlightId) mark.setAttribute('data-highlight-id', String(highlightId))
                    if (note) mark.setAttribute('data-note', note)
                    mark.title = title || (note ? `📝 ${note}` : '')
                    mark.textContent = match

                    // Click handler
                    if (onClick) {
                        mark.addEventListener('click', (e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            onClick(highlightId, note)
                        })
                    }

                    // Hover for notes
                    if (onHover) {
                        mark.addEventListener('mouseenter', () => onHover({ id: highlightId, note, text, isPeer: type === 'peer' }))
                        mark.addEventListener('mouseleave', () => onHover(null))
                    }

                    wrapper.appendChild(mark)

                    // Add count badge for popular highlights
                    if (count && count >= 2) {
                        const badge = document.createElement('span')
                        badge.className = 'absolute -top-2 -right-2 bg-blue-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center'
                        badge.textContent = count
                        wrapper.appendChild(badge)
                    }

                    fragment.appendChild(wrapper)
                    if (after) fragment.appendChild(document.createTextNode(after))

                    textNode.parentNode.replaceChild(fragment, textNode)
                }
            })
        }

        // Apply peer highlights (green)
        if (peerHighlights) {
            peerHighlights.forEach(ph => {
                const isAI = ph.user_id && ph.user_id.startsWith('ai_peer');
                applyHighlight(ph.text_content, {
                    className: `bg-green-100/70 border-b-2 border-green-300 rounded px-0.5 cursor-help`,
                    title: ph.note ? `${isAI ? '🤖 AI Peer' : '🧑‍🎓 Peer'} Note` : 'Peer Highlight',
                    type: 'peer',
                    highlightId: ph.id,
                    note: ph.note,
                    onClick: null,
                    onHover: setHoveredHighlight
                })
            })
        }

        // Apply popular highlights (blue underline)
        popularHighlights.forEach(ph => {
            applyHighlight(ph.text_content, {
                className: 'bg-blue-50 border-b-2 border-blue-400 rounded px-0.5 cursor-help',
                title: `👥 ${ph.highlight_count} people highlighted this`,
                type: 'popular',
                count: ph.highlight_count,
                highlightId: null,
                onClick: null
            })
        })

        // Apply user's highlights (yellow)
        highlights.forEach(h => {
            applyHighlight(h.text_content, {
                className: `bg-yellow-200 rounded px-0.5 cursor-pointer hover:bg-yellow-300 transition-colors ${h.note ? 'border-b-2 border-yellow-500' : ''}`,
                title: h.note ? `📝 ${h.note}\n(Click to edit)` : 'Click to remove or add note',
                type: 'user',
                highlightId: h.id,
                note: h.note,
                onClick: (id, currentNote) => {
                    if (currentNote) {
                        // Edit note
                        setEditingNoteId(id)
                        setNoteInput(currentNote)
                        setShowNoteInput(true)
                    } else {
                        // Show options
                        const action = confirm('Press OK to delete highlight, or Cancel to add a note')
                        if (action) {
                            deleteHighlight(id)
                        } else {
                            setEditingNoteId(id)
                            setNoteInput('')
                            setShowNoteInput(true)
                        }
                    }
                },
                onHover: setHoveredHighlight
            })
        })
    }, [highlights, popularHighlights, children, deleteHighlight])

    // Ref to persist the selected text even after browser selection clears
    const selectedTextRef = useRef(null)

    // Handle text selection
    const handleMouseUp = useCallback(() => {
        if (showNoteInput) return; // Guard: don't alter selection while modal is open
        setTimeout(() => {
            const sel = window.getSelection()
            if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
                setSelectionState(null)
                return
            }

            const text = sel.toString().trim()
            if (text.length < 3) {
                setSelectionState(null)
                return
            }

            const container = containerRef.current
            if (!container) return

            const range = sel.getRangeAt(0)
            const commonAncestor = range.commonAncestorContainer
            if (!container.contains(commonAncestor)) {
                setSelectionState(null)
                return
            }

            const rect = range.getBoundingClientRect()
            const newState = {
                text,
                rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
            }
            setSelectionState(newState)
            selectedTextRef.current = text // Persist in ref
        }, 10)
    }, [showNoteInput])

    const clearSelection = useCallback(() => {
        setSelectionState(null)
        setShowNoteInput(false)
        setEditingNoteId(null)
        setNoteInput('')
        selectedTextRef.current = null
        window.getSelection()?.removeAllRanges()
    }, [])

    const handleScroll = useCallback(() => {
        // Don't close the selection if the user is actively typing a note
        if (!showNoteInput) {
            clearSelection()
        }
    }, [showNoteInput, clearSelection])

    useEffect(() => {
        document.addEventListener('mouseup', handleMouseUp)
        document.addEventListener('scroll', handleScroll, true)
        return () => {
            document.removeEventListener('mouseup', handleMouseUp)
            document.removeEventListener('scroll', handleScroll, true)
        }
    }, [handleMouseUp, handleScroll])

    // Enhanced Highlight handler with Hybrid AI Peer logic
    const handleHighlight = async (color = 'yellow') => {
        // Use ref for text since browser selection may have been cleared
        const text = selectedTextRef.current || selectionState?.text
        if (text) {
            await saveHighlight(text, color, noteInput)
            logHighlightCreate(text.length, !!noteInput, sectionId)

            // Hybrid AI Peer Logic: If user leaves a note, schedule an AI response
            if (noteInput) {
                try {
                    const apiKey = localStorage.getItem('gemini_api_key') || import.meta.env.VITE_GEMINI_API_KEY || '';
                    fetch(`${API_BASE}/assist/peer_note`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            text: text,
                            user_note: noteInput,
                            section_id: sectionId,
                            supabase_url: import.meta.env.VITE_SUPABASE_URL,
                            supabase_anon_key: import.meta.env.VITE_SUPABASE_ANON_KEY,
                            api_key: apiKey
                        })
                    }).catch(err => console.warn('Failed to schedule peer note:', err));
                } catch (e) {
                    console.warn('Stealth peer dispatch failed', e)
                }
            }

            clearSelection()
        }
    }

    // Save note for existing highlight
    const saveNote = async () => {
        if (editingNoteId) {
            await updateHighlightNote(editingNoteId, noteInput)
            setShowNoteInput(false)
            setEditingNoteId(null)
            setNoteInput('')
        }
    }

    // Handle ask BigAL
    const handleAskBigAL = () => {
        if (selectionState?.text && onAskBigAL) {
            onAskBigAL(selectionState.text)
            clearSelection()
        }
    }

    // Export highlights as Markdown
    const exportNotes = () => {
        if (highlights.length === 0) {
            alert('No highlights to export!')
            return
        }

        const markdown = [
            `# Highlights from ${sectionId}`,
            `*Exported on ${new Date().toLocaleDateString()}*\n`,
            ...highlights.map((h, i) =>
                `## Highlight ${i + 1}\n> ${h.text_content}\n${h.note ? `\n📝 **Note:** ${h.note}\n` : ''}`
            )
        ].join('\n')

        const blob = new Blob([markdown], { type: 'text/markdown' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `highlights-${sectionId.replace(/\//g, '-')}.md`
        a.click()
        URL.revokeObjectURL(url)
    }

    return (
        <div ref={containerRef} className="relative select-text">
            {children}

            {/* Selection Popup */}
            {selectionState && !showNoteInput && (
                <div
                    className="fixed z-[100] flex items-center gap-1 bg-slate-900 border border-slate-700 p-1 rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-200"
                    style={{
                        top: selectionState.rect.top - 60,
                        left: Math.max(10, selectionState.rect.left + (selectionState.rect.width / 2) - 130),
                    }}
                >
                    <button
                        onClick={() => handleHighlight('yellow')}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 rounded-lg transition-colors group"
                    >
                        <Highlighter className="w-4 h-4 text-yellow-400 group-hover:text-yellow-300" />
                        Highlight
                    </button>

                    <div className="w-px h-5 bg-slate-700 mx-1"></div>

                    <button
                        onClick={() => setShowNoteInput(true)}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 rounded-lg transition-colors group"
                    >
                        <MessageSquarePlus className="w-4 h-4 text-emerald-400 group-hover:text-emerald-300" />
                        Add Note
                    </button>

                    <div className="w-px h-5 bg-slate-700 mx-1"></div>

                    <button
                        onClick={handleAskBigAL}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 rounded-lg transition-colors group"
                    >
                        <Sparkles className="w-4 h-4 text-indigo-400 group-hover:text-indigo-300" />
                        Ask AI
                    </button>

                    <button onClick={clearSelection} className="px-2 py-1.5 ml-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors">
                        <X className="w-4 h-4" />
                    </button>

                    {/* Triangle pointer */}
                    <div className="absolute left-1/2 -bottom-2 -translate-x-1/2 border-8 border-transparent border-t-slate-900"></div>
                </div>
            )}

            {/* Note Input Popup */}
            {showNoteInput && (
                <div
                    className="fixed z-[100] bg-white rounded-lg shadow-xl border border-gray-200 p-3 w-80"
                    style={{
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                    }}
                >
                    <p className="text-xs text-gray-500 mb-2">
                        {editingNoteId ? 'Edit note:' : `Add note to highlighted text`}
                    </p>
                    <textarea
                        value={noteInput}
                        onChange={(e) => setNoteInput(e.target.value)}
                        placeholder="Type your note..."
                        className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-yellow-300 resize-none"
                        rows={3}
                        autoFocus
                    />
                    <div className="flex justify-end gap-2 mt-3">
                        <button
                            onClick={clearSelection}
                            className="px-4 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded cursor-pointer pointer-events-auto"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => {
                                if (editingNoteId) {
                                    saveNote();
                                } else {
                                    handleHighlight('yellow');
                                }
                            }}
                            className="px-4 py-1.5 text-xs bg-yellow-400 hover:bg-yellow-500 rounded font-medium cursor-pointer pointer-events-auto shadow-sm"
                        >
                            {editingNoteId ? 'Save Note' : 'Highlight + Note'}
                        </button>
                    </div>
                </div>
            )}

            {/* Note Tooltip on Hover */}
            {hoveredHighlight?.note && (
                <div className="fixed z-50 bg-yellow-50 border border-yellow-300 rounded-lg shadow-lg p-3 max-w-xs text-sm">
                    <p className="text-gray-700">{hoveredHighlight.note}</p>
                </div>
            )}

            {/* Footer with export and stats */}
            {(highlights.length > 0 || popularHighlights.length > 0) && (
                <div className="fixed bottom-24 left-6 flex gap-2 z-40">
                    {highlights.length > 0 && (
                        <button
                            onClick={exportNotes}
                            className="bg-white text-gray-700 px-3 py-2 rounded-lg shadow-md text-xs border border-gray-200 hover:bg-gray-50 flex items-center gap-1"
                        >
                            📥 Export ({highlights.length})
                        </button>
                    )}
                    {popularHighlights.length > 0 && (
                        <div className="bg-blue-50 text-blue-700 px-3 py-2 rounded-lg shadow-md text-xs border border-blue-200">
                            👥 {popularHighlights.length} popular
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
