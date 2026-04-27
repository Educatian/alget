/**
 * RubricFeedback — exposes the gradeSummary rubric breakdown to the
 * learner so the assessment is transparent. Sub-scores per criterion +
 * brief explanation. Learners can see exactly which dimension cost
 * points instead of staring at a single opaque grade.
 *
 * Pedagogy: rubric transparency improves formative-assessment validity
 * and makes the learner partner in the assessment rather than its subject
 * (Wiggins; Stiggins).
 */
export default function RubricFeedback({ rubric, subScores, contentScore, wordingScore, feedback }) {
    if (!rubric && !subScores && !feedback) return null

    const subEntries = subScores && typeof subScores === 'object'
        ? Object.entries(subScores)
        : []

    return (
        <div className="mt-4 rounded-2xl border border-[var(--ath-line)] bg-white/80 p-4">
            <p className="editorial-kicker">Rubric breakdown</p>

            <div className="mt-3 grid gap-2 text-sm">
                {contentScore != null && (
                    <Bar label="Content accuracy" score={Number(contentScore)} />
                )}
                {wordingScore != null && (
                    <Bar label="Clarity & wording" score={Number(wordingScore)} />
                )}
                {subEntries.map(([key, value]) => (
                    <Bar
                        key={key}
                        label={prettyConcept(key)}
                        score={Number(value)}
                    />
                ))}
            </div>

            {rubric && (
                <details className="mt-3 text-xs text-[var(--ath-muted)]">
                    <summary className="cursor-pointer font-semibold text-[var(--ath-text)]">
                        Show full rubric
                    </summary>
                    <pre className="mt-2 whitespace-pre-wrap rounded bg-[var(--ath-panel)] p-2 leading-5">{rubric}</pre>
                </details>
            )}

            {feedback && (
                <div className="mt-3 rounded-xl bg-[var(--ath-panel)] px-3 py-2 text-xs leading-5 text-[var(--ath-muted)]">
                    <p className="font-semibold text-[var(--ath-text)]">Feedback</p>
                    <p className="mt-1">{feedback}</p>
                </div>
            )}
        </div>
    )
}

function Bar({ label, score }) {
    const pct = Math.max(0, Math.min(1, Number.isFinite(score) ? score : 0)) * 100
    const tone =
        pct >= 80 ? 'bg-emerald-500'
        : pct >= 60 ? 'bg-amber-500'
        : 'bg-rose-500'

    return (
        <div>
            <div className="flex items-baseline justify-between text-xs">
                <span className="font-semibold text-[var(--ath-text)]">{label}</span>
                <span className="text-[var(--ath-muted)]">{Math.round(pct)}%</span>
            </div>
            <div className="mt-1 h-2 w-full rounded-full bg-[var(--ath-line)]">
                <div
                    className={`h-2 rounded-full ${tone}`}
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    )
}

function prettyConcept(id) {
    return String(id || '').replace(/[_-]/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase())
}
