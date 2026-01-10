import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Hook to handle text selection and highlighting
 */
export function useTextSelection({ sectionId, userId }) {
    const [selection, setSelection] = useState(null)
    const [highlights, setHighlights] = useState([])
    const [popularHighlights, setPopularHighlights] = useState([])

    // Fetch existing highlights for this section
    useEffect(() => {
        if (!sectionId) return

        const fetchHighlights = async () => {
            // Fetch user's own highlights
            if (userId) {
                const { data: userHighlights } = await supabase
                    .from('highlights')
                    .select('*')
                    .eq('section_id', sectionId)
                    .eq('user_id', userId)

                setHighlights(userHighlights || [])
            }

            // Fetch popular highlights (from view)
            const { data: popular } = await supabase
                .from('popular_highlights')
                .select('*')
                .eq('section_id', sectionId)

            setPopularHighlights(popular || [])
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

    // Save highlight to Supabase (or local-only if DB fails)
    const saveHighlight = useCallback(async (text, color = 'yellow') => {
        if (!sectionId || !text) return null

        // Create local highlight object first
        const localHighlight = {
            id: `local-${Date.now()}`,
            user_id: userId,
            section_id: sectionId,
            text_content: text,
            color,
            created_at: new Date().toISOString()
        }

        // Immediately update local state (optimistic update)
        setHighlights(prev => [...prev, localHighlight])
        setSelection(null)
        window.getSelection()?.removeAllRanges()

        // Try to persist to database if userId exists
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
                        color
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

    // Delete highlight (local or from database)
    const deleteHighlight = useCallback(async (highlightId) => {
        // Always remove from local state first
        setHighlights(prev => prev.filter(h => h.id !== highlightId))

        // Only try to delete from database if it's not a local-only highlight
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
        popularHighlights,
        handleSelection,
        saveHighlight,
        deleteHighlight,
        clearSelection: () => setSelection(null)
    }
}
