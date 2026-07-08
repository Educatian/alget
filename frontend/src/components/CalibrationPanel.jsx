import {
    getCalibrationRecordCount,
    getCalibrationSummary,
    MIN_RECORDS_FOR_NUDGE,
} from '../lib/calibration'

/**
 * CalibrationPanel - cumulative per-label calibration table shown at the end
 * of a section (CBM-debriefing table evidence: a simple "how often were you
 * right when you said X" table improves calibration more than trial-by-trial
 * feedback alone). One row per confidence label with times used and % correct
 * when used, over ALL of this course's records; renders nothing until the
 * learner has enough evidence (>= 10 judgments) for stable row percentages.
 */
export default function CalibrationPanel({ sectionId }) {
    const summary = getCalibrationSummary(sectionId)
    if (!summary || summary.rows.length === 0) {
        // Discovery teaser: with 1..9 records the profile exists but is not
        // yet stable enough to show — tell the learner how to unlock it.
        // Stays hidden at 0 records (nothing to tease yet).
        const recordCount = getCalibrationRecordCount(sectionId)
        if (recordCount < 1 || recordCount >= MIN_RECORDS_FOR_NUDGE) return null
        const remaining = MIN_RECORDS_FOR_NUDGE - recordCount
        return (
            <div
                className="mt-5 rounded-2xl border border-dashed border-[var(--ath-line)] bg-[var(--ath-panel)] p-4"
                data-testid="calibration-teaser"
            >
                <p className="text-sm font-semibold text-[var(--ath-text)]">Calibration profile</p>
                <p className="mt-1 text-xs leading-5 text-[var(--ath-muted)]">
                    Answer {remaining} more {remaining === 1 ? 'check' : 'checks'} to unlock your calibration
                    profile — how often you were right at each confidence level.
                </p>
            </div>
        )
    }

    return (
        <div className="mt-5 rounded-2xl border border-[var(--ath-line)] bg-[var(--ath-panel)] p-4" data-testid="calibration-panel">
            <p className="text-sm font-semibold text-[var(--ath-text)]">Your calibration so far</p>
            <p className="mt-1 text-xs leading-5 text-[var(--ath-muted)]">
                Across your last {summary.total} checks in this course: how often you were right at each confidence level.
            </p>
            <table className="mt-3 w-full text-left text-xs">
                <thead>
                    <tr className="text-[var(--ath-secondary)]">
                        <th scope="col" className="pb-1.5 pr-2 font-semibold uppercase tracking-wide">Confidence</th>
                        <th scope="col" className="pb-1.5 pr-2 font-semibold uppercase tracking-wide">Times used</th>
                        <th scope="col" className="pb-1.5 font-semibold uppercase tracking-wide">Correct when used</th>
                    </tr>
                </thead>
                <tbody>
                    {summary.rows.map((row) => (
                        <tr key={row.label} className="border-t border-[var(--ath-line)] text-[var(--ath-text)]">
                            <td className="py-1.5 pr-2 font-medium">{row.label}</td>
                            <td className="py-1.5 pr-2">{row.timesUsed}</td>
                            <td className="py-1.5">{row.pctCorrect}%</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}
