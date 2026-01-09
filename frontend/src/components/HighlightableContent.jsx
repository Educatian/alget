import { useState, useRef, useEffect, useCallback } from 'react'
import { useTextSelection } from '../hooks/useTextSelection'

/**
 * Highlightable content wrapper with selection popup and highlighted text rendering
 */
export default function HighlightableContent({
    children,
    sectionId,
    userId,
    onAskBigAL
}) {
    const containerRef = useRef(null)
    const [selectionState, setSelectionState] = useState(null)
    const {
        highlights,
        popularHighlights,
        saveHighlight,
    } = useTextSelection({ sectionId, userId })

    // Handle text selection with improved detection
    const handleMouseUp = useCallback(() => {
        // Small delay to ensure selection is complete
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

            // Check if selection is within our container
            const container = containerRef.current
            if (!container) return

            const range = sel.getRangeAt(0)
            const commonAncestor = range.commonAncestorContainer
            if (!container.contains(commonAncestor)) {
                setSelectionState(null)
                return
            }

            const rect = range.getBoundingClientRect()
            setSelectionState({
                text,
                rect: {
                    top: rect.top,
                    left: rect.left,
                    width: rect.width,
                    height: rect.height
                }
            })
        }, 10)
    }, [])

    // Clear selection on scroll or click outside
    const clearSelection = useCallback(() => {
        setSelectionState(null)
        window.getSelection()?.removeAllRanges()
    }, [])

    // Listen for mouse up on document (more reliable)
    useEffect(() => {
        document.addEventListener('mouseup', handleMouseUp)
        document.addEventListener('scroll', clearSelection, true)

        return () => {
            document.removeEventListener('mouseup', handleMouseUp)
            document.removeEventListener('scroll', clearSelection, true)
        }
    }, [handleMouseUp, clearSelection])

    // Handle highlight action
    const handleHighlight = async (color = 'yellow') => {
        if (selectionState?.text) {
            await saveHighlight(selectionState.text, color)
            clearSelection()
        }
    }

    // Handle ask BigAL
    const handleAskBigAL = () => {
        if (selectionState?.text && onAskBigAL) {
            onAskBigAL(selectionState.text)
            clearSelection()
        }
    }

    // Apply highlights to text
    const applyHighlights = (content) => {
        if (!content || typeof content !== 'string') return content

        let result = content

        // Apply popular highlights (light blue)
        popularHighlights.forEach(ph => {
            const regex = new RegExp(`(${escapeRegex(ph.text_content)})`, 'gi')
            result = result.replace(regex,
                `<mark class="bg-blue-100 cursor-pointer" title="${ph.highlight_count} users highlighted this">$1</mark>`
            )
        })

        // Apply user's own highlights (yellow) - these override popular
        highlights.forEach(h => {
            const regex = new RegExp(`(${escapeRegex(h.text_content)})`, 'gi')
            result = result.replace(regex,
                `<mark class="bg-yellow-200 cursor-pointer">$1</mark>`
            )
        })

        return result
    }

    return (
        <div ref={containerRef} className="relative select-text">
            {/* Content */}
            {children}

            {/* Selection Popup */}
            {selectionState && (
                <div
                    className="fixed z-[100] bg-white rounded-lg shadow-xl border border-gray-200 p-2 flex gap-1"
                    style={{
                        top: selectionState.rect.top - 50,
                        left: Math.max(10, selectionState.rect.left + (selectionState.rect.width / 2) - 100),
                    }}
                >
                    <button
                        onClick={() => handleHighlight('yellow')}
                        className="px-3 py-1.5 text-xs font-medium bg-yellow-100 hover:bg-yellow-200 rounded-md flex items-center gap-1 transition-colors"
                    >
                        <span className="text-yellow-600">✨</span>
                        Highlight
                    </button>
                    <button
                        onClick={handleAskBigAL}
                        className="px-3 py-1.5 text-xs font-medium bg-[#9E1B32]/10 hover:bg-[#9E1B32]/20 text-[#9E1B32] rounded-md flex items-center gap-1 transition-colors"
                    >
                        <span>🐘</span>
                        Ask BigAL
                    </button>
                    <button
                        onClick={clearSelection}
                        className="px-2 py-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* Popular highlights badge (optional floating indicator) */}
            {popularHighlights.length > 0 && (
                <div className="fixed bottom-24 left-6 bg-blue-50 text-blue-700 px-3 py-2 rounded-lg shadow-md text-xs border border-blue-200 z-40">
                    <span className="font-medium">📚 {popularHighlights.length}</span>
                    <span className="ml-1 text-blue-500">popular highlights</span>
                </div>
            )}
        </div>
    )
}


// Utility to escape regex special characters
function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
