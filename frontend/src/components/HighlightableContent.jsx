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
                // Normalize to merge adjacent text nodes
                parent.normalize()
            }
        })

        // Helper function to apply highlight with click handler
        const applyHighlight = (text, options) => {
            if (!text || text.length < 3) return

            const { className, title, type, highlightId, onClick } = options

            // Find all text nodes
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

                    const mark = document.createElement('mark')
                    mark.className = className
                    mark.setAttribute('data-highlight', type)
                    if (highlightId) mark.setAttribute('data-highlight-id', String(highlightId))
                    if (title) mark.title = title
                    mark.textContent = match

                    // Bind click handler directly
                    if (onClick) {
                        mark.addEventListener('click', (e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            onClick(highlightId)
                        })
                    }

                    fragment.appendChild(mark)
                    if (after) fragment.appendChild(document.createTextNode(after))

                    textNode.parentNode.replaceChild(fragment, textNode)
                }
            })
        }

        // Apply popular highlights (light blue)
        popularHighlights.forEach(ph => {
            applyHighlight(ph.text_content, {
                className: 'bg-blue-100 rounded px-0.5 cursor-pointer',
                title: `${ph.highlight_count} users highlighted this`,
                type: 'popular',
                highlightId: null,
                onClick: null
            })
        })

        // Apply user's highlights (yellow)
        highlights.forEach(h => {
            applyHighlight(h.text_content, {
                className: 'bg-yellow-200 rounded px-0.5 cursor-pointer hover:bg-yellow-300 transition-colors',
                title: 'Click to remove highlight',
                type: 'user',
                highlightId: h.id,
                onClick: (id) => {
                    if (confirm('Remove this highlight?')) {
                        deleteHighlight(id)
                    }
                }
            })
        })
    }, [highlights, popularHighlights, children, deleteHighlight])

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

    return (
        <div ref={containerRef} className="relative select-text">
            {/* Content */}
            {children}

            {/* Selection Popup */}
            {selectionState && (
                <div
                    className="fixed z-100 bg-white rounded-lg shadow-xl border border-gray-200 p-2 flex gap-1"
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
    if (!string) return ''
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Highlight text within a container by wrapping matches in <mark> tags
 * Uses TreeWalker for efficient DOM traversal
 */
function highlightTextInContainer(container, searchText, options = {}) {
    if (!container || !searchText || searchText.length < 3) return

    const { className = 'bg-yellow-200', title = '', type = 'user', highlightId = null } = options

    // Create a TreeWalker to iterate over text nodes
    const walker = document.createTreeWalker(
        container,
        NodeFilter.SHOW_TEXT,
        null,
        false
    )

    const textNodes = []
    let node
    while ((node = walker.nextNode())) {
        // Skip nodes already inside a mark tag
        if (node.parentElement?.tagName === 'MARK') continue
        textNodes.push(node)
    }

    // Search for matches in text nodes
    textNodes.forEach(textNode => {
        const text = textNode.textContent
        const searchLower = searchText.toLowerCase()
        const textLower = text.toLowerCase()
        const index = textLower.indexOf(searchLower)

        if (index !== -1) {
            const before = text.slice(0, index)
            const match = text.slice(index, index + searchText.length)
            const after = text.slice(index + searchText.length)

            // Create elements
            const fragment = document.createDocumentFragment()

            if (before) {
                fragment.appendChild(document.createTextNode(before))
            }

            const mark = document.createElement('mark')
            mark.className = className
            mark.setAttribute('data-highlight', type)
            if (highlightId) mark.setAttribute('data-highlight-id', highlightId)
            if (title) mark.title = title
            mark.textContent = match
            fragment.appendChild(mark)

            if (after) {
                fragment.appendChild(document.createTextNode(after))
            }

            // Replace the text node with the fragment
            textNode.parentNode.replaceChild(fragment, textNode)
        }
    })
}
