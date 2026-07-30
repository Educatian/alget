const STATE_LABELS = {
    rest: 'BigAL is available',
    notice: 'BigAL is reviewing the current context',
    nudge: 'BigAL has one suggested next move',
    mirror: 'BigAL is helping you reframe your thinking',
    teach: 'BigAL is ready to learn from your explanation'
}

export default function BigALCompanion({ state = 'rest', size = 40, className = '' }) {
    const resolvedState = STATE_LABELS[state] ? state : 'rest'

    return (
        <span
            className={`bigal-companion bigal-companion--${resolvedState} ${className}`.trim()}
            style={{ '--bigal-size': `${size}px` }}
            role="img"
            aria-label={STATE_LABELS[resolvedState]}
            data-state={resolvedState}
        >
            <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
                {resolvedState === 'notice' && (
                    <circle className="bigal-accent bigal-notice-ring" cx="24" cy="23" r="18" />
                )}
                {resolvedState === 'mirror' && (
                    <path
                        className="bigal-accent bigal-mirror"
                        d="M15 36C19 13 24 8 28 8c4 0 7 11 10 28M20 27h15M38 10v26h7"
                    />
                )}
                {resolvedState === 'teach' && (
                    <path
                        className="bigal-accent bigal-brackets"
                        d="M9 10c-4 0-4 5-4 10v8c0 5 0 10 4 10M39 10c4 0 4 5 4 10v8c0 5 0 10-4 10"
                    />
                )}
                <path
                    className="bigal-glyph"
                    d="M11 36C15 13 20 8 24 8c4 0 7 11 10 28M16 27h15M34 10v26h7"
                />
                {resolvedState === 'nudge' && <circle className="bigal-accent bigal-nudge-dot" cx="43" cy="23" r="3" />}
            </svg>
        </span>
    )
}
