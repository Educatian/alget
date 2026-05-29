import { AlertTriangle, Info, Key, Lightbulb } from 'lucide-react'

/**
 * Callout - a typed SEMANTIC content node carrying a Torus-style PURPOSE
 * vocabulary (item 6). Instead of presentational blockquotes, authors mark the
 * pedagogical role of an aside so it renders consistently and is machine-legible.
 *
 * MDX usage:
 *   <callout purpose="warning" title="Watch out">
 *     Specification gaming can satisfy the metric while defeating the goal.
 *   </callout>
 *
 * Purpose vocabulary (Torus element vocabulary): note | warning | tip | key.
 *
 * Accessibility: each purpose carries an icon AND a text label (never color
 * alone), an aria-label naming the purpose, and role="note" so it is announced
 * as an aside. A "warning" uses role="alert"-adjacent semantics via an explicit
 * label rather than interrupting the reading flow.
 */
const PURPOSES = {
    note: {
        label: 'Note',
        Icon: Info,
        accent: 'var(--ath-primary)',
        tint: 'rgba(15,81,103,0.06)',
    },
    warning: {
        label: 'Warning',
        Icon: AlertTriangle,
        accent: '#b45309',
        tint: 'rgba(180,83,9,0.08)',
    },
    tip: {
        label: 'Tip',
        Icon: Lightbulb,
        accent: '#047857',
        tint: 'rgba(4,120,87,0.07)',
    },
    key: {
        label: 'Key idea',
        Icon: Key,
        accent: '#6d28d9',
        tint: 'rgba(109,40,217,0.07)',
    },
}

function resolvePurpose(purpose) {
    const normalized = String(purpose || 'note').toLowerCase().trim()
    return PURPOSES[normalized] || PURPOSES.note
}

export default function Callout({ purpose, title, children }) {
    const normalizedPurpose = String(purpose || 'note').toLowerCase().trim()
    const { label, Icon, accent, tint } = resolvePurpose(normalizedPurpose)
    const heading = title || label

    return (
        <aside
            className="reading-breakout not-prose my-6 rounded-2xl border border-[var(--ath-line)] p-4 shadow-sm"
            style={{ borderLeft: `4px solid ${accent}`, background: tint }}
            role="note"
            aria-label={`${label}${title ? `: ${title}` : ''}`}
            data-semantic-node="callout"
            data-callout-purpose={normalizedPurpose}
            data-analytics-region="callout"
        >
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: accent }}>
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{heading}</span>
            </p>
            <div className="mt-1.5 text-sm leading-6 text-[var(--ath-text)]">{children}</div>
        </aside>
    )
}
