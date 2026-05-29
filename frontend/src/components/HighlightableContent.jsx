import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useTextSelection } from '../hooks/useTextSelection'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { logHighlightCreate } from '../lib/loggingService'
import API_BASE from '../lib/apiConfig'
import { Download, Hash, MessageSquarePlus, Sparkles, Highlighter, X } from 'lucide-react'
import HighlightDiscussion from './HighlightDiscussion'

function getInitials(alias = '') {
    return alias
        .split(' ')
        .filter(Boolean)
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase() || 'R'
}

/**
 * Highlightable content wrapper with selection popup, notes, and collaborative highlights
 */
export default function HighlightableContent({
    children,
    sectionId,
    userId,
    onAskBigAL,
    presenceSummary = null
}) {
    const containerRef = useRef(null)
    const noteInputRef = useRef(null)
    const [selectionState, setSelectionState] = useState(null)
    const [noteInput, setNoteInput] = useState('')
    const [showNoteInput, setShowNoteInput] = useState(false)
    const [editingNoteId, setEditingNoteId] = useState(null)
    const [hoveredHighlight, setHoveredHighlight] = useState(null)
    const [discussionHighlightId, setDiscussionHighlightId] = useState(null)
    const discussionDialogRef = useFocusTrap(Boolean(discussionHighlightId), () => setDiscussionHighlightId(null))

    // Esc-to-close on the discussion modal (a11y).
    useEffect(() => {
        if (!discussionHighlightId) return
        const onKeyDown = (event) => {
            if (event.key === 'Escape') setDiscussionHighlightId(null)
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [discussionHighlightId])

    const {
        highlights,
        peerHighlights,
        popularHighlights,
        saveHighlight,
        updateHighlightNote,
        deleteHighlight,
    } = useTextSelection({ sectionId, userId })

    const livePeerCount = presenceSummary?.peers?.length || 0
    const sameHeadingCount = presenceSummary?.sameHeadingPeers?.length || 0
    const sameConceptCount = presenceSummary?.sameConceptPeers?.length || 0
    const underlinePassageCount = popularHighlights.length
    const underlineReaderCount = popularHighlights.reduce((sum, item) => sum + (item.highlight_count || 0), 0)
    const activeHeading = presenceSummary?.activeHeading || ''

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

        const existingBadges = container.querySelectorAll('[data-collab-badge]')
        existingBadges.forEach((badge) => badge.remove())
        const existingLiveBadges = container.querySelectorAll('[data-live-presence-badge]')
        existingLiveBadges.forEach((badge) => badge.remove())

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
                    mark.title = title || note || ''
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
                        mark.addEventListener('mouseenter', () => {
                            const rect = mark.getBoundingClientRect()
                            onHover({
                                id: highlightId,
                                note,
                                text,
                                isPeer: type === 'peer',
                                isPopular: type === 'popular',
                                label: type === 'popular' && count ? `${count} readers highlighted this passage` : null,
                                x: rect.left + rect.width / 2,
                                y: rect.top - 10
                            })
                        })
                        mark.addEventListener('mouseleave', () => onHover(null))
                    }

                    wrapper.appendChild(mark)

                    // Add count badge for popular highlights
                    if (count && count >= 2) {
                        const badge = document.createElement('span')
                        badge.className = 'absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full border border-white/90 bg-[rgba(15,81,103,0.82)] px-1 text-[9px] font-bold text-white shadow-sm'
                        badge.textContent = count > 9 ? '9+' : String(count)
                        wrapper.appendChild(badge)
                    }

                    fragment.appendChild(wrapper)
                    if (after) fragment.appendChild(document.createTextNode(after))

                    textNode.parentNode.replaceChild(fragment, textNode)

                    if (type === 'popular' && count) {
                        const hostBlock = wrapper.closest('p, li, blockquote')
                        if (hostBlock) {
                            hostBlock.classList.add('relative')
                            const existingBadge = hostBlock.querySelector('[data-collab-badge]')
                            if (existingBadge) {
                                const currentCount = Number(existingBadge.getAttribute('data-reader-count') || '0')
                                const nextCount = currentCount + count
                                existingBadge.setAttribute('data-reader-count', String(nextCount))
                                existingBadge.textContent = nextCount > 9 ? '9+' : String(nextCount)
                                existingBadge.setAttribute('title', `${nextCount} readers highlighted this passage`)
                            } else {
                                const badge = document.createElement('button')
                                badge.type = 'button'
                                badge.className = 'absolute -left-8 top-1.5 hidden h-5 min-w-5 items-center justify-center rounded-full border border-[rgba(15,81,103,0.12)] bg-[rgba(255,255,255,0.92)] px-1.5 text-[10px] font-bold text-[var(--ath-primary)] shadow-sm md:flex'
                                badge.setAttribute('data-collab-badge', 'popular')
                                badge.setAttribute('data-reader-count', String(count))
                                badge.setAttribute('title', `${count} readers highlighted this passage`)
                                badge.textContent = count > 9 ? '9+' : String(count)
                                badge.addEventListener('mouseenter', () => {
                                    const rect = badge.getBoundingClientRect()
                                    setHoveredHighlight({
                                        x: rect.left + rect.width / 2,
                                        y: rect.top - 10,
                                        label: `${count} readers highlighted this passage`,
                                        note: null,
                                        isPopular: true
                                    })
                                })
                                badge.addEventListener('mouseleave', () => setHoveredHighlight(null))
                                hostBlock.appendChild(badge)
                            }
                        }
                    }
                }
            })
        }

        // Apply peer highlights (green)
        if (peerHighlights) {
            peerHighlights.forEach(ph => {
                const isAI = ph.user_id && ph.user_id.startsWith('ai_peer');
                applyHighlight(ph.text_content, {
                    className: `bg-green-100/70 border-b-2 border-green-300 rounded px-0.5 cursor-help`,
                    title: ph.note ? `${isAI ? 'AI peer note' : 'Peer note'}` : 'Peer highlight',
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
                className: 'bg-[rgba(200,226,236,0.22)] border-b-2 border-[rgba(15,81,103,0.55)] rounded px-0.5 cursor-help transition-colors hover:bg-[rgba(200,226,236,0.35)]',
                title: `${ph.highlight_count} readers highlighted this passage`,
                type: 'popular',
                count: ph.highlight_count,
                highlightId: null,
                onClick: null,
                onHover: setHoveredHighlight
            })
        })

        // Apply user's highlights (yellow)
        highlights.forEach(h => {
            applyHighlight(h.text_content, {
                className: `bg-yellow-200 rounded px-0.5 cursor-pointer hover:bg-yellow-300 transition-colors ${h.note ? 'border-b-2 border-yellow-500' : ''}`,
                title: h.note ? `${h.note} (click to edit)` : 'Click to remove or add a note',
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
                        // Open the note editor by default — adding a note is
                        // the lower-stakes action and matches what most learners
                        // want when they click their own un-noted highlight.
                        // Deletion is now an explicit button inside the editor
                        // (see the note-input popover below). The earlier
                        // OK/Cancel-as-delete-vs-note flow was confusing.
                        setEditingNoteId(id)
                        setNoteInput('')
                        setShowNoteInput(true)
                    }
                },
                onHover: setHoveredHighlight
            })
        })

        if (sameHeadingCount > 0) {
            const headings = Array.from(container.querySelectorAll('h1, h2, h3, h4'))
            const normalizedActiveHeading = activeHeading.trim().toLowerCase()
            const liveHost = headings.find((headingNode) => (
                normalizedActiveHeading &&
                headingNode.textContent?.trim().toLowerCase() === normalizedActiveHeading
            )) || headings[0] || container.querySelector('p')

            if (liveHost) {
                const badge = document.createElement('button')
                badge.type = 'button'
                badge.className = 'ml-3 inline-flex translate-y-[-0.1rem] items-center gap-2 rounded-full border border-[rgba(15,81,103,0.12)] bg-[rgba(255,255,255,0.82)] px-2.5 py-1 align-middle text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--ath-primary)] shadow-sm backdrop-blur-xl'
                badge.setAttribute('data-live-presence-badge', 'heading')

                const pulse = document.createElement('span')
                pulse.className = 'inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse'
                badge.appendChild(pulse)

                const stack = document.createElement('span')
                stack.className = 'flex items-center gap-1'
                presenceSummary.sameHeadingPeers.slice(0, 3).forEach((peer) => {
                    const avatar = document.createElement('span')
                    avatar.className = `inline-block h-2.5 w-2.5 rounded-full border border-white/80 bg-linear-to-br ${peer.colorToken || 'from-slate-500 to-slate-400'} shadow-sm`
                    stack.appendChild(avatar)
                })
                badge.appendChild(stack)

                const label = document.createElement('span')
                label.textContent = sameHeadingCount === 1 ? '1 here' : `${sameHeadingCount} here`
                badge.appendChild(label)

                badge.addEventListener('mouseenter', () => {
                    const rect = badge.getBoundingClientRect()
                    const aliasPreview = presenceSummary.sameHeadingPeers.slice(0, 3).map((peer) => peer.alias).join(', ')
                    const remainder = sameHeadingCount > 3 ? ` +${sameHeadingCount - 3} more` : ''
                    setHoveredHighlight({
                        x: rect.left + rect.width / 2,
                        y: rect.top - 10,
                        label: `${sameHeadingCount} reader${sameHeadingCount === 1 ? '' : 's'} in this passage`,
                        note: `${aliasPreview}${remainder}`,
                        isPopular: true
                    })
                })
                badge.addEventListener('mouseleave', () => setHoveredHighlight(null))

                liveHost.appendChild(badge)
            }
        }
    }, [activeHeading, children, deleteHighlight, highlights, peerHighlights, popularHighlights, presenceSummary, sameHeadingCount])

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
        // Cheap early-out on the common case (scrolling with nothing selected),
        // so this capture-phase global scroll handler doesn't do work every frame.
        if (!selectionState && !showNoteInput) return
        // Don't close the selection if the user is actively typing a note
        if (!showNoteInput) {
            clearSelection()
        }
    }, [selectionState, showNoteInput, clearSelection])

    // Focus the note textarea when the note input popup opens (replaces autoFocus for a11y).
    useEffect(() => {
        if (showNoteInput) {
            noteInputRef.current?.focus()
        }
    }, [showNoteInput])

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

            // Stealth AI-as-peer dispatch removed 2026-04-26.
            // The previous behavior posted an AI-generated comment under a
            // fake user_id so it looked like a real peer. That violated
            // ethical-AI disclosure. If reintroduced later, gate behind an
            // explicit opt-in and label every AI contribution in the UI.

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
            alert('No highlights to export yet.')
            return
        }

        const markdown = [
            `# Highlights from ${sectionId}`,
            `*Exported on ${new Date().toLocaleDateString()}*\n`,
            ...highlights.map((h, i) =>
                `## Highlight ${i + 1}\n> ${h.text_content}\n${h.note ? `\n**Note:** ${h.note}\n` : ''}`
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
            {(livePeerCount > 0 || underlinePassageCount > 0 || presenceSummary?.connected) && (
                <div className="pointer-events-none sticky top-4 z-30 mb-4 flex justify-end px-4">
                    <div className="pointer-events-auto inline-flex max-w-full items-center gap-2 rounded-full border border-[var(--ath-line)] bg-[rgba(255,255,255,0.82)] px-2.5 py-2 shadow-[0_12px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl">
                        <div className="flex -space-x-2">
                            {livePeerCount > 0 ? presenceSummary.peers.slice(0, 3).map((peer) => (
                                <span
                                    key={peer.key}
                                    className={`flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-linear-to-br ${peer.colorToken || 'from-slate-500 to-slate-400'} text-[10px] font-bold text-white shadow-sm`}
                                    title={peer.alias}
                                >
                                    {getInitials(peer.alias)}
                                </span>
                            )) : (
                                <span className={`flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold shadow-sm ${presenceSummary?.connected ? 'bg-[var(--ath-primary)] text-white' : 'bg-slate-100 text-slate-500'}`}>
                                    {presenceSummary?.connected ? 'L' : '0'}
                                </span>
                            )}
                        </div>

                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ath-secondary)]">
                                <span>{livePeerCount > 0 ? `${livePeerCount} live` : 'live'}</span>
                                {sameHeadingCount > 0 && <span>{sameHeadingCount} here</span>}
                                {sameConceptCount > 0 && <span>{sameConceptCount} concept</span>}
                            </div>
                            <div className="mt-0.5 hidden flex-wrap items-center gap-2 text-xs text-[var(--ath-muted)] lg:flex">
                                <span className="inline-flex items-center gap-1">
                                    <span className="inline-block h-[2px] w-4 rounded-full bg-[var(--ath-primary)]" />
                                    {underlinePassageCount > 0
                                        ? `${underlineReaderCount} shared / ${underlinePassageCount} passages`
                                        : 'No shared underlines yet'}
                                </span>
                                {sameHeadingCount > 0 && (
                                    <span className="inline-flex items-center gap-1.5">
                                        <span className="flex items-center gap-1">
                                            {presenceSummary.sameHeadingPeers.slice(0, 3).map((peer) => (
                                                <span
                                                    key={peer.key}
                                                    className={`inline-block h-2 w-2 rounded-full bg-linear-to-br ${peer.colorToken || 'from-slate-500 to-slate-400'}`}
                                                    title={peer.alias}
                                                />
                                            ))}
                                        </span>
                                        Same heading
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {children}

            {/* Selection Popup. Portaled to <body> (escapes the reading shell's
                overflow-hidden / transformed ancestors) and clamped to BOTH
                viewport edges: a selection near the right margin no longer pushes
                the toolbar off-screen, and a first-line selection flips the
                toolbar BELOW the text instead of rendering above the top edge. */}
            {selectionState && !showNoteInput && createPortal(
                <div
                    className="fixed z-[120] flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900 p-1 shadow-2xl animate-in fade-in zoom-in-95 duration-200"
                    style={{
                        top: selectionState.rect.top - 60 < 12
                            ? selectionState.rect.bottom + 10
                            : selectionState.rect.top - 60,
                        left: Math.min(
                            Math.max(12, selectionState.rect.left + (selectionState.rect.width / 2) - 76),
                            (typeof window !== 'undefined' ? window.innerWidth : 1280) - 300,
                        ),
                    }}
                >
                    <button
                        onClick={() => handleHighlight('yellow')}
                        className="flex h-9 w-9 items-center justify-center rounded-full text-white transition-colors hover:bg-slate-800 group"
                        aria-label="Highlight"
                        title="Highlight"
                    >
                        <Highlighter className="w-4 h-4 text-yellow-400 group-hover:text-yellow-300" />
                    </button>

                    <div className="w-px h-5 bg-slate-700 mx-1"></div>

                    <button
                        onClick={() => setShowNoteInput(true)}
                        className="flex h-9 w-9 items-center justify-center rounded-full text-white transition-colors hover:bg-slate-800 group"
                        aria-label="Add note"
                        title="Add note"
                    >
                        <MessageSquarePlus className="w-4 h-4 text-emerald-400 group-hover:text-emerald-300" />
                    </button>

                    <div className="w-px h-5 bg-slate-700 mx-1"></div>

                    <button
                        onClick={handleAskBigAL}
                        className="flex h-9 w-9 items-center justify-center rounded-full text-white transition-colors hover:bg-slate-800 group"
                        aria-label="Ask BigAL"
                        title="Ask BigAL"
                    >
                        <Sparkles className="w-4 h-4 text-indigo-400 group-hover:text-indigo-300" />
                    </button>

                    <button
                        onClick={clearSelection}
                        className="ml-1 flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
                        aria-label="Close selection menu"
                        title="Close"
                    >
                        <X className="w-4 h-4" />
                    </button>

                    {/* Triangle pointer */}
                    <div className="absolute left-1/2 -bottom-2 -translate-x-1/2 border-8 border-transparent border-t-slate-900"></div>
                </div>,
                document.body,
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
                        ref={noteInputRef}
                        value={noteInput}
                        onChange={(e) => setNoteInput(e.target.value)}
                        placeholder="Type your note..."
                        className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-yellow-300 resize-none"
                        rows={3}
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

            {/* Note Tooltip on Hover. Portaled to <body> so it escapes the
                reading shell's overflow-hidden + transformed (section-animation)
                ancestors, and clamped to BOTH viewport edges so a highlight near
                the right/bottom margin never renders the popup off-screen. */}
            {(hoveredHighlight?.note || hoveredHighlight?.label || hoveredHighlight?.id) && createPortal(
                <div
                    className="fixed z-[120] w-[min(20rem,calc(100vw-1.5rem))] rounded-xl border border-[var(--ath-line)] bg-[rgba(255,255,255,0.96)] p-3 text-sm shadow-[0_18px_40px_rgba(15,23,42,0.14)] backdrop-blur-xl"
                    style={{
                        left: hoveredHighlight?.x
                            ? Math.min(
                                  Math.max(12, hoveredHighlight.x - 120),
                                  (typeof window !== 'undefined' ? window.innerWidth : 1280) - 332,
                              )
                            : 12,
                        top: hoveredHighlight?.y
                            ? Math.min(
                                  Math.max(12, hoveredHighlight.y - 56),
                                  (typeof window !== 'undefined' ? window.innerHeight : 720) - 160,
                              )
                            : 12,
                    }}
                >
                    {hoveredHighlight?.label && (
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ath-primary)]">
                            {hoveredHighlight.label}
                        </p>
                    )}
                    {hoveredHighlight?.note && (
                        <p className={`text-[var(--ath-muted)] ${hoveredHighlight?.label ? 'mt-2' : ''}`}>{hoveredHighlight.note}</p>
                    )}
                    {hoveredHighlight?.id && (
                        <button
                            type="button"
                            onClick={() => setDiscussionHighlightId(hoveredHighlight.id)}
                            className="mt-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--ath-primary)] text-[0] font-semibold text-white"
                            aria-label="Discuss highlight"
                            title="Discuss"
                        >
                            💬 Discuss this highlight
                        </button>
                    )}
                </div>,
                document.body,
            )}

            {/* Discussion modal: per-highlight reactions + replies (R1) */}
            {discussionHighlightId && (
                /* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events -- dialog backdrop click-to-dismiss; close button provided inside the panel */
                <div
                    className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/40 p-6 backdrop-blur-sm"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Highlight discussion"
                    onClick={(event) => {
                        if (event.target === event.currentTarget) {
                            setDiscussionHighlightId(null)
                        }
                    }}
                >
                    {/* stops backdrop dismissal when interacting inside the panel; not a user-facing control */}
                    {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
                    <div ref={discussionDialogRef} className="w-full max-w-lg" onClick={(event) => event.stopPropagation()}>
                        <HighlightDiscussion
                            highlightId={discussionHighlightId}
                            user={{ id: userId }}
                            onClose={() => setDiscussionHighlightId(null)}
                        />
                    </div>
                </div>
            )}

            {/* Footer with export and stats */}
            {(highlights.length > 0 || popularHighlights.length > 0) && (
                <div className="pointer-events-none sticky bottom-4 z-40 mt-8 flex justify-end gap-2 px-4">
                    {highlights.length > 0 && (
                        <button
                            onClick={exportNotes}
                            className="pointer-events-auto flex h-10 items-center gap-2 rounded-full border border-[var(--ath-line)] bg-[rgba(255,255,255,0.9)] px-3 text-xs font-semibold text-[var(--ath-muted)] shadow-md backdrop-blur-xl hover:bg-[var(--ath-panel)]"
                            aria-label={`Export ${highlights.length} highlights`}
                        >
                            <Download className="h-4 w-4 text-[var(--ath-primary)]" aria-hidden="true" />
                            {highlights.length}
                        </button>
                    )}
                    {popularHighlights.length > 0 && (
                        <div
                            className="pointer-events-auto flex h-10 items-center gap-2 rounded-full border border-[var(--ath-line)] bg-[rgba(255,255,255,0.9)] px-3 text-xs font-semibold text-[var(--ath-muted)] shadow-md backdrop-blur-xl"
                            title={`${popularHighlights.length} popular highlights`}
                        >
                            <Hash className="h-4 w-4 text-[var(--ath-primary)]" aria-hidden="true" />
                            {popularHighlights.length}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
