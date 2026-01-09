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

    // Save highlight to Supabase
    const saveHighlight = useCallback(async (text, color = 'yellow') => {
        if (!userId || !sectionId || !text) return null

        const { data, error } = await supabase
            .from('highlights')
            .insert({
                user_id: userId,
                section_id: sectionId,
                text_content: text,
                start_offset: 0,  // Simplified - using text matching instead
                end_offset: text.length,
                color
            })
            .select()
            .single()

        if (error) {
            console.error('Error saving highlight:', error)
            return null
        }

        setHighlights(prev => [...prev, data])
        setSelection(null)
        window.getSelection()?.removeAllRanges()
        return data
    }, [userId, sectionId])

    // Delete highlight
    const deleteHighlight = useCallback(async (highlightId) => {
        const { error } = await supabase
            .from('highlights')
            .delete()
            .eq('id', highlightId)
            .eq('user_id', userId)

        if (!error) {
            setHighlights(prev => prev.filter(h => h.id !== highlightId))
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
