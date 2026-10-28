import { lazy, Suspense, useEffect, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import API_BASE from '../lib/apiConfig'
import { getLocalMasteryMap } from '../lib/knowledgeService'
import { dueConcepts } from '../lib/reviewSchedule'

const PracticeBlock = lazy(() => import('./PracticeBlock'))

const MASTERED = 0.95 // the Skillometer convention: mastery is a probability of success, not % correct
const humanize = (id) => String(id).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

function Ring({ value }) {
    const r = 9
    const c = 2 * Math.PI * r
    const mastered = value >= MASTERED
    return (
        <svg viewBox="0 0 24 24" className="h-6 w-6 -rotate-90" aria-hidden="true">
            <circle cx="12" cy="12" r={r} fill="none" stroke="var(--ath-panel-muted)" strokeWidth="3" />
            <circle cx="12" cy="12" r={r} fill="none" strokeWidth="3" strokeLinecap="round"
                stroke={mastered ? '#10b981' : '#3b82f6'} strokeDasharray={`${c * value} ${c}`} />
        </svg>
    )
}

/**
 * Skill meter for this section's concepts plus a quick review of concepts due from earlier
 * sections. Review items are the earlier sections' own practice questions.
 */
export default function SkillReview({ course, sectionId, conceptIds = [] }) {
    const [mastery, setMastery] = useState(() => getLocalMasteryMap())
    const [due] = useState(() => dueConcepts(course, { excludeSectionId: sectionId }))
    const [review, setReview] = useState(null) // { problems, misconceptions } once opened

    // Mastery changes as the reader answers questions on this page.
    useEffect(() => {
        const refresh = () => setMastery(getLocalMasteryMap())
        const id = window.setInterval(refresh, 4000)
        window.addEventListener('focus', refresh)
        return () => { window.clearInterval(id); window.removeEventListener('focus', refresh) }
    }, [])

    const openReview = async () => {
        const bySection = {}
        for (const d of due) (bySection[d.section_id] ||= []).push(d.conceptId)
        const problems = []
        const misconceptions = []
        for (const [sid, concepts] of Object.entries(bySection)) {
            try {
                const data = await (await fetch(`${API_BASE}/book/${sid}`)).json()
                for (const concept of concepts) {
                    const item = (data?.practice?.problems || []).find((p) => p.concept_id === concept)
                    if (item) problems.push({ ...item, review_of: sid })
                }
                misconceptions.push(...(data?.misconceptions || []))
            } catch (err) {
                console.warn('Could not load review items:', err)
            }
        }
        setReview({ problems, misconceptions })
    }

    if (!conceptIds.length && !due.length) return null

    return (
        <section className="not-prose mb-10 rounded-2xl border border-[var(--ath-line)] bg-[var(--ath-panel)] p-4 shadow-sm" aria-label="Your skills and review">
            {conceptIds.length > 0 && (
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--ath-secondary)]">Your skills in this section</p>
                    <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
                        {conceptIds.map((id) => {
                            const p = Number(mastery[id] ?? 0)
                            return (
                                <li key={id} className="flex items-center gap-2 text-sm text-[var(--ath-text)]" title={`Estimated chance you can do this now: ${Math.round(p * 100)}%`}>
                                    <Ring value={p} />
                                    <span>{humanize(id)}</span>
                                    <span className="sr-only">{p >= MASTERED ? 'mastered' : `${Math.round(p * 100)} percent`}</span>
                                </li>
                            )
                        })}
                    </ul>
                </div>
            )}

            {due.length > 0 && (
                <div className={conceptIds.length ? 'mt-4 border-t border-[var(--ath-line)] pt-4' : ''}>
                    {!review ? (
                        <div className="flex flex-wrap items-center gap-3">
                            <RotateCcw className="h-4 w-4 text-[var(--ath-primary)]" aria-hidden="true" />
                            <p className="mr-auto text-sm text-[var(--ath-text)]">
                                <span className="font-semibold">Quick review:</span> {due.map((d) => humanize(d.conceptId)).join(', ')}
                            </p>
                            <button type="button" onClick={openReview} className="editorial-button min-h-[40px] px-4 py-2 text-sm">
                                Review {due.length} {due.length === 1 ? 'question' : 'questions'}
                            </button>
                        </div>
                    ) : review.problems.length ? (
                        <Suspense fallback={null}>
                            <PracticeBlock practice={{ problems: review.problems }} misconceptions={review.misconceptions} sectionId={sectionId} />
                        </Suspense>
                    ) : (
                        <p className="text-sm text-[var(--ath-muted)]">No review questions were found for those concepts.</p>
                    )}
                </div>
            )}
        </section>
    )
}
