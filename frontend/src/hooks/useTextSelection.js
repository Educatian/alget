import { useState, useEffect, useCallback } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { useToast } from '../lib/toastContext'
import { readLocalHighlights, writeLocalHighlights } from '../lib/localAnnotations'

const SHOW_PEER_HIGHLIGHTS = false
// Without Supabase (static preview, local dev) highlights live in this browser only.
const LOCAL_ONLY = !isSupabaseConfigured

/**
 * Hook to handle text selection, highlighting, and notes
 */
export function useTextSelection({ sectionId, userId }) {
    const toast = useToast()
    const [selection, setSelection] = useState(null)
    const [highlights, setHighlights] = useState([])
    const [popularHighlights, setPopularHighlights] = useState([])
    const [peerHighlights, setPeerHighlights] = useState([])
    const [loading, setLoading] = useState(false)
    const [loadedSection, setLoadedSection] = useState(null)

    // Fetch existing highlights for this section
    useEffect(() => {
        if (!sectionId) return

        if (LOCAL_ONLY) {
            setHighlights(readLocalHighlights(sectionId))
            setLoadedSection(sectionId)
            return
        }

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

                    // Other learners' highlights are not shown (study privacy):
                    // each participant only sees their own notes.
                    const others = SHOW_PEER_HIGHLIGHTS ? (await supabase
                        .from('highlights')
                        .select('*')
                        .eq('section_id', sectionId)
                        .neq('user_id', userId)
                        .order('created_at', { ascending: false })
                        .limit(50)).data : null

                    if (others) {
                        setPeerHighlights(others)
                    }
                }

                // Popular highlights aggregate other learners' highlights; off for the study.
                const popular = SHOW_PEER_HIGHLIGHTS ? (await supabase
                    .from('popular_highlights')
                    .select('*')
                    .eq('section_id', sectionId)).data : []

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

    // Local-only mode: every change is written straight back to this browser. The section check
    // stops the previous section's list being written under a new section during navigation.
    useEffect(() => {
        if (LOCAL_ONLY && sectionId && loadedSection === sectionId) writeLocalHighlights(sectionId, highlights)
    }, [highlights, loadedSection, sectionId])

    // Save highlight with optional note. `anchor` ({exact, prefix, suffix, start, end}) pins it
    // to one place in the text; see lib/annotationAnchor.js.
    const saveHighlight = useCallback(async (text, color = 'yellow', note = '', anchor = null) => {
        if (!sectionId || !text) return null

        // Create local highlight object first
        const localHighlight = {
            id: `local-${Date.now()}`,
            user_id: userId,
            section_id: sectionId,
            text_content: anchor?.exact || text,
            color,
            note: note || null,
            anchor,
            created_at: new Date().toISOString()
        }

        // Immediately update local state (optimistic update)
        setHighlights(prev => [...prev, localHighlight])
        setSelection(null)
        window.getSelection()?.removeAllRanges()

        // Persist to database if userId exists
        if (userId && !LOCAL_ONLY) {
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
                    toast.warning('Highlight saved offline only - will sync when connection returns.')
                } else if (data) {
                    // Replace local highlight with DB version (the table has no anchor column)
                    setHighlights(prev => prev.map(h =>
                        h.id === localHighlight.id ? { ...data, anchor } : h
                    ))
                }
            } catch (err) {
                console.warn('Highlight saved locally only:', err)
                toast.warning('Highlight saved offline only - will sync when connection returns.')
            }
        }

        return localHighlight
    }, [userId, sectionId, toast])

    // Change a highlight's colour tag (Insight / Question / Confusion / Connection)
    const updateHighlightColor = useCallback(async (highlightId, color) => {
        setHighlights(prev => prev.map(h => (h.id === highlightId ? { ...h, color } : h)))
        if (highlightId && !String(highlightId).startsWith('local-') && userId && !LOCAL_ONLY) {
            try {
                await supabase.from('highlights').update({ color }).eq('id', highlightId).eq('user_id', userId)
            } catch (err) {
                console.warn('Could not update highlight colour:', err)
            }
        }
    }, [userId])

    // Update highlight note
    const updateHighlightNote = useCallback(async (highlightId, note) => {
        // Update local state
        setHighlights(prev => prev.map(h =>
            h.id === highlightId ? { ...h, note } : h
        ))

        // Persist to database
        if (highlightId && !String(highlightId).startsWith('local-') && userId && !LOCAL_ONLY) {
            try {
                await supabase
                    .from('highlights')
                    .update({ note })
                    .eq('id', highlightId)
                    .eq('user_id', userId)
            } catch (err) {
                console.warn('Could not update note in database:', err)
                toast.error('Could not save note. Try again in a moment.')
            }
        }
    }, [userId, toast])

    // Delete highlight
    const deleteHighlight = useCallback(async (highlightId) => {
        // Always remove from local state first
        setHighlights(prev => prev.filter(h => h.id !== highlightId))

        // Only delete from database if not local-only
        if (highlightId && !String(highlightId).startsWith('local-') && userId && !LOCAL_ONLY) {
            try {
                await supabase
                    .from('highlights')
                    .delete()
                    .eq('id', highlightId)
                    .eq('user_id', userId)
            } catch (err) {
                console.warn('Could not delete from database:', err)
                toast.error('Could not delete highlight. It will retry on next session.')
            }
        }
    }, [userId, toast])

    return {
        selection,
        highlights,
        peerHighlights,
        popularHighlights,
        loading,
        handleSelection,
        saveHighlight,
        updateHighlightNote,
        updateHighlightColor,
        deleteHighlight,
        clearSelection: () => setSelection(null)
    }
}
