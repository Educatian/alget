import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getEvaluationStatus } from '../lib/researchService'
import { logEvent } from '../lib/loggingService'
import { ALL_COURSE_IDS } from '../lib/courseCatalog'

/**
 * RetentionBanner — surfaces a spaced-retrieval check when a course's
 * post-test was completed at least 7 days ago and a retention quiz is
 * now due. Lives at the top of BookLayout / MainApp; dismissible per
 * session but reappears next session until taken.
 *
 * Pedagogy: spaced retrieval roughly doubles long-term recall (Cepeda
 * et al., 2008). The banner makes the schedule visible to the learner
 * instead of silently waiting for them to discover it.
 */
export default function RetentionBanner({ course = null }) {
    const navigate = useNavigate()
    const [dismissed, setDismissed] = useState(false)

    const dueCourses = useMemo(() => {
        const courses = course ? [course] : ALL_COURSE_IDS
        return courses
            .map((c) => {
                const status = getEvaluationStatus(c)
                return status?.pending?.retention ? c : null
            })
            .filter(Boolean)
    }, [course])

    useEffect(() => {
        if (dueCourses.length > 0 && !dismissed) {
            logEvent('retention_banner_shown', null, { courses: dueCourses })
        }
    }, [dueCourses, dismissed])

    if (dismissed || dueCourses.length === 0) return null

    const primary = dueCourses[0]

    return (
        <div className="mx-auto mb-4 flex max-w-5xl flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1">
                <p className="editorial-kicker text-amber-700">Retention check ready</p>
                <p className="mt-1 text-sm text-amber-900">
                    A 5-minute review of <span className="font-semibold">{primary}</span> is due. Spaced
                    retrieval is the cheapest way to keep what you learned last week.
                </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
                <button
                    type="button"
                    onClick={() => {
                        logEvent('retention_banner_accept', null, { course: primary })
                        navigate(`/diagnostic/${primary}?phase=retention`)
                    }}
                    className="editorial-button px-4 py-2 text-sm"
                >
                    Take check
                </button>
                <button
                    type="button"
                    onClick={() => {
                        logEvent('retention_banner_dismiss', null, { course: primary })
                        setDismissed(true)
                    }}
                    className="text-xs text-amber-700 underline"
                >
                    Later
                </button>
            </div>
        </div>
    )
}
