import { useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { logEvent } from '../lib/loggingService'

/**
 * Glossary - hover/click definition for a technical term inline in the
 * narrative. Reduces the cognitive cost of an unfamiliar term without
 * forcing the learner out of the reading flow (Mayer pre-training,
 * UDL multiple means of representation).
 *
 * MDX usage:
 *   <glossary term="setae">setae</glossary>
 * The component looks the term up in the static glossary database and
 * renders a tooltip on hover/focus.
 */

// Minimal in-component glossary; can be migrated to a JSON asset later.
const GLOSSARY = {
    setae: 'Microscopic hair-like structures on a gecko\'s foot that produce van der Waals adhesion.',
    addie: 'A widely used instructional-design process model: Analysis, Design, Development, Implementation, Evaluation.',
    bloom_taxonomy: 'A hierarchy of cognitive demand: Remember, Understand, Apply, Analyze, Evaluate, Create.',
    abcd: 'Mager\'s objective format: Audience, Behavior, Condition, Degree.',
    ferpa: 'Family Educational Rights and Privacy Act (US, 1974) - governs disclosure of student educational records.',
    coppa: 'Children\'s Online Privacy Protection Act (US, 1998) - governs commercial collection of personal information from children under 13.',
    rlhf: 'Reinforcement Learning from Human Feedback - a technique to align LLMs with human preferences.',
    fbd: 'Free-Body Diagram - a sketch of all external forces acting on an isolated body, the foundation of equilibrium analysis.',
    moment_of_inertia: 'A geometric (area) or mass-weighted (mass) measure of resistance to bending or rotation about an axis.',
    bkt: 'Bayesian Knowledge Tracing - a probabilistic model of a learner\'s mastery of a concept, updated by attempt outcomes.',
    udl: 'Universal Design for Learning - a framework for proactively designing flexible learning environments around variability.',
    arcs: 'Keller\'s motivational design framework: Attention, Relevance, Confidence, Satisfaction.',
    zpd: 'Zone of Proximal Development (Vygotsky) - the gap between what a learner can do alone and with guidance.',
    spec_gaming: 'Specification gaming - when an AI optimizer satisfies its specified objective in unintended ways.',
    differential_privacy: 'A formal privacy guarantee that bounds how much any single individual\'s data can affect the output of an analysis.',
}

function normalizeKey(term) {
    return String(term || '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
}

export default function Glossary({ term, children }) {
    const [open, setOpen] = useState(false)
    const key = normalizeKey(term || (typeof children === 'string' ? children : ''))
    const definition = GLOSSARY[key]
    const display = children || term || ''

    if (!definition) {
        // Term not in glossary - render plain text. Logged so the catalog
        // can be expanded over time.
        return <span>{display}</span>
    }

    // Radix Popover.Portal renders the tooltip at the document root with
    // viewport collision handling, so it is never clipped by the reading
    // surface's overflow-hidden ancestors (book shell / scroll panes).
    return (
        <Popover.Root open={open} onOpenChange={setOpen}>
            <Popover.Trigger asChild>
                <button
                    type="button"
                    className="cursor-help border-b border-dotted border-[var(--ath-primary)] text-[var(--ath-text)] underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--ath-primary)_45%,transparent)]"
                    onMouseEnter={() => setOpen(true)}
                    onMouseLeave={() => setOpen(false)}
                    onFocus={() => {
                        setOpen(true)
                        logEvent('glossary_open', null, { term: key })
                    }}
                    onBlur={() => setOpen(false)}
                    aria-label={`Definition of ${display}`}
                >
                    {display}
                </button>
            </Popover.Trigger>
            <Popover.Portal>
                <Popover.Content
                    side="top"
                    align="center"
                    sideOffset={6}
                    collisionPadding={12}
                    role="tooltip"
                    onOpenAutoFocus={(e) => e.preventDefault()}
                    aria-label={`Definition of ${display}`}
                    className="z-[80] w-[min(18rem,calc(100vw-1.5rem))] rounded-xl border border-[var(--ath-line)] bg-white/95 p-3 text-xs leading-5 text-[var(--ath-muted)] shadow-[0_12px_28px_rgba(15,23,42,0.12)] backdrop-blur-xl"
                >
                    <span className="block font-semibold text-[var(--ath-text)]">{display}</span>
                    <span className="mt-1 block">{definition}</span>
                    <Popover.Arrow className="fill-white/95" />
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    )
}
