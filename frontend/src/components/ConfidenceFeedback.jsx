/**
 * ConfidenceFeedback - metacognitive calibration message shown after a
 * KnowledgeCheck or PracticeBlock attempt. Compares the learner's stated
 * confidence (1-5 or 0-1) against the actual outcome and surfaces over-
 * confidence or under-confidence as a learning signal.
 *
 * Pedagogy: calibration training reduces metacognitive bias (Dunning-Kruger
 * effect) and improves study planning. Showing the gap once per attempt is
 * cheap and effective.
 */
export default function ConfidenceFeedback({ confidence, isCorrect }) {
    if (confidence == null) return null

    // Normalize to [0, 1]
    const c = Number(confidence) > 1
        ? Math.min(Math.max(Number(confidence) / 5, 0), 1)
        : Math.min(Math.max(Number(confidence), 0), 1)

    const outcome = isCorrect ? 1 : 0
    const drift = c - outcome
    const absDrift = Math.abs(drift)

    let label = ''
    let tone = ''
    let advice = ''

    if (absDrift < 0.2) {
        label = 'Calibration on point'
        tone = 'border-emerald-200 bg-emerald-50 text-emerald-900'
        advice = 'Your confidence matched the outcome. That metacognitive accuracy is the harder skill - keep noticing what you know.'
    } else if (drift > 0.4) {
        label = 'Overconfident'
        tone = 'border-amber-200 bg-amber-50 text-amber-900'
        advice = 'You said you were confident but the answer was wrong. The most common cause is glossing over a step. Re-read the relevant passage before the next attempt.'
    } else if (drift > 0) {
        label = 'Slightly overconfident'
        tone = 'border-amber-100 bg-amber-50/70 text-amber-900'
        advice = 'You felt slightly more sure than the outcome warrants. Note where the surprise was.'
    } else if (drift < -0.4) {
        label = 'Underconfident'
        tone = 'border-sky-200 bg-sky-50 text-sky-900'
        advice = 'You got it right but said you weren\'t sure. Trust your instinct a little more - but verify on the next problem.'
    } else {
        label = 'Slightly underconfident'
        tone = 'border-sky-100 bg-sky-50/70 text-sky-900'
        advice = 'A little more sure than you reported.'
    }

    return (
        <div className={`mt-3 rounded-xl border px-3 py-2 text-xs leading-5 ${tone}`}>
            <p className="font-semibold">{label}</p>
            <p className="mt-1">
                Confidence: {Math.round(c * 100)}% / Outcome: {isCorrect ? 'correct' : 'incorrect'} / Drift: {drift > 0 ? '+' : ''}{Math.round(drift * 100)}pts
            </p>
            <p className="mt-1">{advice}</p>
        </div>
    )
}
