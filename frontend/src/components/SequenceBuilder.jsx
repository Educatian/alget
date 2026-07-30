import { useId, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, ChevronUp, X } from 'lucide-react'

/**
 * SequenceBuilder - a drag-to-order / match activity for process content.
 *
 * Two modes, both driven from MDX with string props:
 *   <sequence-builder mode="order"
 *     items='["Analysis","Design","Development","Implementation","Evaluation"]' />
 *   <sequence-builder mode="match"
 *     items='[{"term":"Validity","definition":"Measures what it claims to"}, ...]' />
 *
 * In 'order' mode the learner reorders a shuffled list back into the correct
 * sequence. In 'match' mode the learner assigns a definition to each term.
 *
 * Accessibility is mandatory and this is NOT drag-only:
 *  - Up/Down move buttons reorder each item from the keyboard.
 *  - Native HTML5 drag is offered as a progressive enhancement (mouse users)
 *    but every operation it performs is also reachable via the buttons.
 *  - aria-grabbed is announced on the active drag item; a roving listbox-style
 *    structure exposes position ("Step 2 of 5") to screen readers.
 *  - "Check" marks each item correct/incorrect with text + icon (not color
 *    only) and reports an overall result via aria-live.
 *  - Respects prefers-reduced-motion (no transition when the user opts out).
 */
export default function SequenceBuilder({ items, mode = 'order' }) {
    const resolvedMode = mode === 'match' ? 'match' : 'order'
    const correct = useMemo(() => normalizeItems(items, resolvedMode), [items, resolvedMode])
    const baseId = useId()

    if (correct.length === 0) {
        return null
    }

    return resolvedMode === 'match' ? (
        <MatchActivity correct={correct} baseId={baseId} />
    ) : (
        <OrderActivity correct={correct} baseId={baseId} />
    )
}

/* ----------------------------- order mode ----------------------------- */

function OrderActivity({ correct, baseId }) {
    // correct is an array of { id, label }; initial order is a deterministic
    // shuffle so the activity is non-trivial yet stable across renders/tests.
    const [order, setOrder] = useState(() => stableShuffle(correct))
    const [checked, setChecked] = useState(false)
    const [status, setStatus] = useState('')
    const dragIndexRef = useRef(null)
    const [grabbedIndex, setGrabbedIndex] = useState(null)
    const itemRefs = useRef([])

    const correctById = useMemo(() => {
        const map = new Map()
        correct.forEach((item, index) => map.set(item.id, index))
        return map
    }, [correct])

    const move = (from, to) => {
        if (to < 0 || to >= order.length) return
        setOrder((prev) => {
            const next = prev.slice()
            const [item] = next.splice(from, 1)
            next.splice(to, 0, item)
            return next
        })
        setChecked(false)
        setStatus('')
        // Keep keyboard focus on the moved item after the DOM updates.
        requestAnimationFrame(() => {
            itemRefs.current[to]?.focus()
        })
    }

    const handleCheck = () => {
        const wrong = order.filter((item, index) => correctById.get(item.id) !== index).length
        setChecked(true)
        setStatus(
            wrong === 0
                ? 'Correct. Every step is in the right position.'
                : `${wrong} of ${order.length} ${wrong === 1 ? 'item is' : 'items are'} out of place. Use the move buttons to adjust and check again.`,
        )
    }

    const handleReset = () => {
        setOrder(stableShuffle(correct))
        setChecked(false)
        setStatus('')
    }

    const onDragStart = (index) => (event) => {
        dragIndexRef.current = index
        setGrabbedIndex(index)
        event.dataTransfer.effectAllowed = 'move'
    }
    const onDragOver = (event) => {
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
    }
    const onDrop = (index) => (event) => {
        event.preventDefault()
        const from = dragIndexRef.current
        if (from === null || from === index) return
        move(from, index)
        dragIndexRef.current = null
        setGrabbedIndex(null)
    }
    const onDragEnd = () => {
        dragIndexRef.current = null
        setGrabbedIndex(null)
    }

    const labelId = `${baseId}-order-label`

    return (
        <section
            className="my-6 border-y border-[var(--ath-line)] py-4"
            aria-labelledby={labelId}
        >
            <p className="editorial-kicker">Put the steps in order</p>
            <p id={labelId} className="mt-1 text-sm text-[var(--ath-muted)]">
                Reorder the steps into the correct sequence, then choose Check. Use the up and down
                buttons or drag to rearrange.
            </p>

            <ol className="mt-3 grid gap-2" aria-label="Steps to order">
                {order.map((item, index) => {
                    const isRight = checked && correctById.get(item.id) === index
                    const isWrong = checked && correctById.get(item.id) !== index
                    return (
                        <li key={item.id}>
                            <div
                                ref={(el) => { itemRefs.current[index] = el }}
                                tabIndex={0}
                                role="button"
                                draggable
                                aria-label={`Step ${index + 1} of ${order.length}: ${item.label}${grabbedIndex === index ? ' (grabbed)' : ''}`}
                                onDragStart={onDragStart(index)}
                                onDragOver={onDragOver}
                                onDrop={onDrop(index)}
                                onDragEnd={onDragEnd}
                                onKeyDown={(event) => {
                                    if (event.key === 'ArrowUp') {
                                        event.preventDefault()
                                        move(index, index - 1)
                                    } else if (event.key === 'ArrowDown') {
                                        event.preventDefault()
                                        move(index, index + 1)
                                    }
                                }}
                                className={`flex items-center gap-3 rounded-[var(--ath-radius)] border px-3 py-2 text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--ath-primary)_45%,transparent)] motion-safe:transition-colors ${
                                    isRight
                                        ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                                        : isWrong
                                            ? 'border-rose-300 bg-rose-50 text-rose-900'
                                            : 'border-[var(--ath-line)] bg-[var(--ath-surface-strong)]'
                                }`}
                            >
                                <span className="font-mono text-xs text-[var(--ath-muted)]" aria-hidden="true">
                                    {index + 1}.
                                </span>
                                <span className="flex-1">{item.label}</span>
                                {checked && (
                                    <span className="text-xs font-semibold">
                                        {isRight ? <Check className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" /> : <X className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />}
                                        {isRight ? 'Correct position' : 'Move me'}
                                    </span>
                                )}
                                <span className="flex shrink-0 gap-1">
                                    <button
                                        type="button"
                                        onClick={() => move(index, index - 1)}
                                        disabled={index === 0}
                                        aria-label={`Move ${item.label} up`}
                                        className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--ath-radius)] text-[var(--ath-text)] hover:bg-[var(--ath-panel)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--ath-primary)_45%,transparent)] disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        <ChevronUp className="h-4 w-4" aria-hidden="true" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => move(index, index + 1)}
                                        disabled={index === order.length - 1}
                                        aria-label={`Move ${item.label} down`}
                                        className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--ath-radius)] text-[var(--ath-text)] hover:bg-[var(--ath-panel)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--ath-primary)_45%,transparent)] disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        <ChevronDown className="h-4 w-4" aria-hidden="true" />
                                    </button>
                                </span>
                            </div>
                        </li>
                    )
                })}
            </ol>

            <div className="mt-3 flex flex-wrap gap-2">
                <button
                    type="button"
                    onClick={handleCheck}
                    className="editorial-button min-h-11 px-4 text-xs"
                >
                    Check
                </button>
                <button
                    type="button"
                    onClick={handleReset}
                    className="editorial-button-secondary min-h-11 px-4 text-xs"
                >
                    Reshuffle
                </button>
            </div>

            <p className="sr-only" role="status" aria-live="polite">
                {status}
            </p>
            {status && (
                <p
                    className={`mt-3 rounded-xl px-3 py-2 text-xs leading-5 ${
                        checked && status.startsWith('Correct')
                            ? 'bg-emerald-50 text-emerald-900'
                            : 'bg-[var(--ath-panel)] text-[var(--ath-muted)]'
                    }`}
                    aria-hidden="true"
                >
                    {status}
                </p>
            )}
        </section>
    )
}

/* ----------------------------- match mode ----------------------------- */

function MatchActivity({ correct, baseId }) {
    // correct: array of { id, label (term), definition }. The learner assigns
    // one definition to each term via a labeled <select> (fully keyboard
    // operable and screen-reader friendly, no drag dependency).
    const definitions = useMemo(
        () => stableShuffle(correct.map((item) => ({ id: item.id, definition: item.definition }))),
        [correct],
    )
    const [assignments, setAssignments] = useState(() => correct.map(() => ''))
    const [checked, setChecked] = useState(false)
    const [status, setStatus] = useState('')

    const handleSelect = (rowIndex) => (event) => {
        const value = event.target.value
        setAssignments((prev) => {
            const next = prev.slice()
            next[rowIndex] = value
            return next
        })
        setChecked(false)
        setStatus('')
    }

    const handleCheck = () => {
        const wrong = correct.filter((item, index) => assignments[index] !== item.id).length
        setChecked(true)
        setStatus(
            wrong === 0
                ? 'Correct. Every term is matched to its definition.'
                : `${wrong} of ${correct.length} ${wrong === 1 ? 'match is' : 'matches are'} incorrect. Adjust and check again.`,
        )
    }

    const handleReset = () => {
        setAssignments(correct.map(() => ''))
        setChecked(false)
        setStatus('')
    }

    const labelId = `${baseId}-match-label`

    return (
        <section
            className="my-6 border-y border-[var(--ath-line)] py-4"
            aria-labelledby={labelId}
        >
            <p className="editorial-kicker">Match each term to its definition</p>
            <p id={labelId} className="mt-1 text-sm text-[var(--ath-muted)]">
                Choose the definition that fits each term, then choose Check.
            </p>

            <ul className="mt-3 grid gap-3" aria-label="Terms to match">
                {correct.map((item, index) => {
                    const selectId = `${baseId}-match-${index}`
                    const isRight = checked && assignments[index] === item.id
                    const isWrong = checked && assignments[index] !== item.id
                    return (
                        <li
                            key={item.id}
                            className={`rounded-xl border px-3 py-2 ${
                                isRight
                                    ? 'border-emerald-300 bg-emerald-50'
                                    : isWrong
                                        ? 'border-rose-300 bg-rose-50'
                                        : 'border-[var(--ath-line)] bg-[var(--ath-surface-strong)]'
                            }`}
                        >
                            <label htmlFor={selectId} className="block text-sm font-semibold text-[var(--ath-text)]">
                                {item.label}
                            </label>
                            <select
                                id={selectId}
                                value={assignments[index]}
                                onChange={handleSelect(index)}
                                className="mt-1 min-h-11 w-full rounded-[var(--ath-radius)] border border-[var(--ath-line)] bg-[var(--ath-surface-strong)] px-3 py-2 text-sm text-[var(--ath-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--ath-primary)_45%,transparent)]"
                            >
                                <option value="">Select a definition</option>
                                {definitions.map((def) => (
                                    <option key={def.id} value={def.id}>
                                        {def.definition}
                                    </option>
                                ))}
                            </select>
                            {checked && (
                                <p className={`mt-1 text-xs font-semibold ${isRight ? 'text-emerald-900' : 'text-rose-900'}`}>
                                    {isRight ? <Check className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" /> : <X className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />}
                                    {isRight ? 'Correct match' : 'Not the right definition'}
                                </p>
                            )}
                        </li>
                    )
                })}
            </ul>

            <div className="mt-3 flex flex-wrap gap-2">
                <button
                    type="button"
                    onClick={handleCheck}
                    className="editorial-button min-h-11 px-4 text-xs"
                >
                    Check
                </button>
                <button
                    type="button"
                    onClick={handleReset}
                    className="editorial-button-secondary min-h-11 px-4 text-xs"
                >
                    Clear
                </button>
            </div>

            <p className="sr-only" role="status" aria-live="polite">
                {status}
            </p>
            {status && (
                <p
                    className={`mt-3 rounded-xl px-3 py-2 text-xs leading-5 ${
                        checked && status.startsWith('Correct')
                            ? 'bg-emerald-50 text-emerald-900'
                            : 'bg-[var(--ath-panel)] text-[var(--ath-muted)]'
                    }`}
                    aria-hidden="true"
                >
                    {status}
                </p>
            )}
        </section>
    )
}

/* ------------------------------ helpers ------------------------------ */

// Normalize MDX string/array props into a canonical [{ id, label, definition? }]
// in CORRECT order. Accepts: JSON array of strings (order), JSON array of
// objects {term/label/text, definition} (match), or a live array.
function normalizeItems(items, mode) {
    const raw = typeof items === 'string' ? safeParse(items) : items
    if (!Array.isArray(raw)) return []

    return raw
        .map((entry, index) => {
            if (entry && typeof entry === 'object') {
                const label = entry.term ?? entry.label ?? entry.text ?? ''
                const definition = entry.definition ?? entry.def ?? ''
                if (mode === 'match' && (!label || !definition)) return null
                if (!label) return null
                return { id: `seq-${index}`, label: String(label), definition: String(definition) }
            }
            const label = String(entry ?? '').trim()
            if (!label) return null
            return { id: `seq-${index}`, label, definition: '' }
        })
        .filter(Boolean)
}

// Deterministic order-reversing shuffle: guarantees the initial arrangement is
// not already the solution (for length >= 2) without relying on Math.random,
// keeping renders and tests stable.
function stableShuffle(list) {
    if (list.length < 2) return list.slice()
    const reversed = list.slice().reverse()
    // Reversing a 2-item list still differs from the original; for longer lists
    // a single adjacent swap on top of the reverse avoids accidental symmetry.
    if (reversed.length > 2) {
        const tmp = reversed[0]
        reversed[0] = reversed[1]
        reversed[1] = tmp
    }
    return reversed
}

function safeParse(raw) {
    try {
        return JSON.parse(raw)
    } catch {
        return []
    }
}
