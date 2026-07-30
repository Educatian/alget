import { useEffect, useMemo, useState } from 'react'
import { ShieldAlert } from 'lucide-react'
import { draftIntervention, loadInterventions, reviewIntervention } from '../lib/agenticLmsService'

export default function InstructorInterventionQueue({ user, hotSpots = [], courseId = 'cohort' }) {
    const [items, setItems] = useState([])
    const [busy, setBusy] = useState('')
    const [error, setError] = useState('')

    useEffect(() => {
        let cancelled = false
        loadInterventions()
            .then((rows) => { if (!cancelled) setItems(rows) })
            .catch((nextError) => { if (!cancelled) setError(nextError.message) })
        return () => { cancelled = true }
    }, [])

    const pending = useMemo(() => items.filter((item) => item.status === 'awaiting_approval'), [items])

    const createDraft = async (entry) => {
        setBusy(`draft-${entry.concept_id}`)
        setError('')
        try {
            const created = await draftIntervention({
                userId: user?.id || 'demo-instructor',
                courseId: entry.courseId || courseId,
                conceptId: entry.concept_id,
                learnerCount: entry.learnerCount,
                averageMastery: entry.average,
                targetUserIds: entry.userIds || [],
            })
            setItems((rows) => [created, ...rows])
        } catch (nextError) {
            setError(nextError.message || 'Could not draft the intervention')
        } finally {
            setBusy('')
        }
    }

    const review = async (item, decision) => {
        setBusy(`${decision}-${item.id}`)
        setError('')
        try {
            const updated = await reviewIntervention(item.id, decision, '', user?.id || 'demo-instructor')
            setItems((rows) => rows.map((entry) => entry.id === updated.id ? { ...entry, ...updated } : entry))
        } catch (nextError) {
            setError(nextError.message || 'Could not review the intervention')
        } finally {
            setBusy('')
        }
    }

    return (
        <section aria-labelledby="intervention-queue-title" className="mx-auto mt-5 max-w-5xl border-t border-[var(--ath-line)] pt-4">
            <div className="flex flex-wrap items-start gap-3">
                <div>
                    <p className="editorial-kicker">EVIDENCE → PROPOSAL → HUMAN DECISION</p>
                    <h2 id="intervention-queue-title" className="mt-1 font-headline text-xl font-semibold text-[var(--ath-text)]">Instructor intervention queue</h2>
                    <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--ath-muted)]">BigAL prepares bounded drafts. It cannot message learners, publish content, or finalize grades.</p>
                </div>
                <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--ath-primary)]"><ShieldAlert className="h-4 w-4" /> {pending.length} awaiting review</span>
            </div>
            {error && <p role="alert" className="mt-3 border-l-2 border-[var(--ath-danger)] pl-3 text-sm text-[var(--ath-danger)]">{error}</p>}

            {pending.length > 0 && (
                <ul className="mt-4 divide-y divide-[var(--ath-line)] border-y border-[var(--ath-line)]">
                    {pending.map((item) => <QueueItem key={item.id} item={item} busy={busy} onReview={review} />)}
                </ul>
            )}

            <div className="mt-4">
                <h3 className="text-sm font-semibold text-[var(--ath-text)]">Evidence ready for a draft</h3>
                {hotSpots.length === 0 ? <p className="mt-2 text-xs text-[var(--ath-muted)]">No cohort-wide signal currently crosses the drafting threshold.</p> : (
                    <ul className="mt-2 divide-y divide-[var(--ath-line)]">
                        {hotSpots.slice(0, 5).map((entry) => (
                            <li key={entry.concept_id} className="flex flex-wrap items-center gap-3 py-2.5">
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold text-[var(--ath-text)]">{prettify(entry.concept_id)}</p>
                                    <p className="text-xs text-[var(--ath-muted)]">{entry.learnerCount} learners · {Math.round(entry.average * 100)}% average · correlational signal</p>
                                </div>
                                <button type="button" disabled={busy === `draft-${entry.concept_id}`} onClick={() => createDraft(entry)} className="editorial-button-secondary px-3 py-2 text-xs">
                                    {busy === `draft-${entry.concept_id}` ? 'Drafting…' : 'Prepare draft'}
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </section>
    )
}

function QueueItem({ item, busy, onReview }) {
    const proposal = item.proposal || {}
    const evidence = item.evidence || proposal.evidence || {}
    return (
        <li className="grid gap-4 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <div>
                <p className="text-sm font-semibold text-[var(--ath-text)]">{item.title}</p>
                <p className="mt-1 text-[var(--ath-text-2xs)] font-bold uppercase tracking-[0.14em] text-[var(--ath-primary)]">
                    {evidence.learner_count || 0} learners · {Math.round(Number(evidence.average_mastery || 0) * 100)}% average · {evidence.urgency || 'monitor'}
                </p>
                <p className="mt-2 max-w-3xl text-xs leading-5 text-[var(--ath-muted)]">{proposal.summary}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 md:justify-end">
                <button type="button" disabled={Boolean(busy)} onClick={() => onReview(item, 'reject')} className="editorial-button-secondary px-4 py-2 text-xs">Reject</button>
                <button type="button" disabled={Boolean(busy)} onClick={() => onReview(item, 'approve')} className="editorial-button px-4 py-2 text-xs">Approve draft</button>
                <p className="basis-full text-right text-[10px] leading-4 text-[var(--ath-secondary)]">Approval does not send or grade.</p>
            </div>
        </li>
    )
}

function prettify(value) {
    return String(value || '').replace(/[_-]/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase())
}
