import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Hook to handle text selection, highlighting, and notes
 */
export function useTextSelection({ sectionId, userId }) {
    const [selection, setSelection] = useState(null)
    const [highlights, setHighlights] = useState([])
    const [popularHighlights, setPopularHighlights] = useState([])
    const [peerHighlights, setPeerHighlights] = useState([])
    const [loading, setLoading] = useState(false)

    // Fetch existing highlights for this section
    useEffect(() => {
        if (!sectionId) return

        const fetchHighlights = async () => {
            setLoading(true)
            try {
                // Fetch user's own highlights
                if (userId) {
                    const { data: userHighlights, error } = await supabase
                        .from('highlights')
                        .select('*')
                        .eq('section_id', sectionId)
                        .eq('user_id', userId)
                        .order('created_at', { ascending: true })

                    if (!error && userHighlights) {
                        setHighlights(userHighlights)
                    }

                    // Fetch peer highlights
                    const { data: others } = await supabase
                        .from('highlights')
                        .select('*')
                        .eq('section_id', sectionId)
                        .neq('user_id', userId)
                        .order('created_at', { ascending: false })
                        .limit(50) // limit so we don't fetch too many

                    if (others) {
                        setPeerHighlights(others)
                    }
                }

                // Fetch popular highlights (from view)
                const { data: popular } = await supabase
                    .from('popular_highlights')
                    .select('*')
                    .eq('section_id', sectionId)

                setPopularHighlights(popular || [])
            } catch (err) {
                console.warn('Error fetching highlights:', err)
            } finally {
                setLoading(false)
            }
        }

        fetchHighlights()
    }, [sectionId, userId])

    // Handle text selection
    const handleSelection = useCallback(() => {
        const sel = window.getSelection()
        if (!sel || sel.isCollapsed) {
            setSelection(null)
            return
        }

        const text = sel.toString().trim()
        if (text.length < 3) {
            setSelection(null)
            return
        }

        const range = sel.getRangeAt(0)
        const rect = range.getBoundingClientRect()

        setSelection({
            text,
            rect: {
                top: rect.top + window.scrollY,
                left: rect.left + window.scrollX,
                width: rect.width,
                height: rect.height
            }
        })
    }, [])

    // Save highlight with optional note
    const saveHighlight = useCallback(async (text, color = 'yellow', note = '') => {
        if (!sectionId || !text) return null

        // Create local highlight object first
        const localHighlight = {
            id: `local-${Date.now()}`,
            user_id: userId,
            section_id: sectionId,
            text_content: text,
            color,
            note: note || null,
            created_at: new Date().toISOString()
        }

        // Immediately update local state (optimistic update)
        setHighlights(prev => [...prev, localHighlight])
        setSelection(null)
        window.getSelection()?.removeAllRanges()

        // Persist to database if userId exists
        if (userId) {
            try {
                const { data, error } = await supabase
                    .from('highlights')
                    .insert({
                        user_id: userId,
                        section_id: sectionId,
                        text_content: text,
                        start_offset: 0,
                        end_offset: text.length,
                        color,
                        note: note || null
                    })
                    .select()
                    .single()

                if (error) {
                    console.warn('Highlight saved locally only (DB error):', error.message)
                } else if (data) {
                    // Replace local highlight with DB version
                    setHighlights(prev => prev.map(h =>
                        h.id === localHighlight.id ? data : h
                    ))
                }
            } catch (err) {
                console.warn('Highlight saved locally only:', err)
            }
        }

        return localHighlight
    }, [userId, sectionId])

    // Update highlight note
    const updateHighlightNote = useCallback(async (highlightId, note) => {
        // Update local state
        setHighlights(prev => prev.map(h =>
            h.id === highlightId ? { ...h, note } : h
        ))

        // Persist to database
        if (highlightId && !String(highlightId).startsWith('local-') && userId) {
            try {
                await supabase
                    .from('highlights')
                    .update({ note })
                    .eq('id', highlightId)
                    .eq('user_id', userId)
            } catch (err) {
                console.warn('Could not update note in database:', err)
            }
        }
    }, [userId])

    // Delete highlight
    const deleteHighlight = useCallback(async (highlightId) => {
        // Always remove from local state first
        setHighlights(prev => prev.filter(h => h.id !== highlightId))

        // Only delete from database if not local-only
        if (highlightId && !String(highlightId).startsWith('local-') && userId) {
            try {
                await supabase
                    .from('highlights')
                    .delete()
                    .eq('id', highlightId)
                    .eq('user_id', userId)
            } catch (err) {
                console.warn('Could not delete from database:', err)
            }
        }
    }, [userId])

    return {
        selection,
        highlights,
        peerHighlights,
        popularHighlights,
        loading,
        handleSelection,
        saveHighlight,
        updateHighlightNote,
        deleteHighlight,
        clearSelection: () => setSelection(null)
    }
}
