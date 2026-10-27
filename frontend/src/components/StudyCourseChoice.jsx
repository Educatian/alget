import { useState } from 'react'
import { chooseStudyCourse } from '../lib/studyTrack'

/**
 * Basic track: the participant picks one course (Statics or Dynamics) after the
 * pre-survey. They can switch back to this screen until they finish a section.
 */
export default function StudyCourseChoice({ user, courses }) {
    const [pending, setPending] = useState(null)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    const confirm = async () => {
        setSaving(true)
        setError('')
        try {
            await chooseStudyCourse(user, pending.id)
        } catch (err) {
            setError(err.message)
            setSaving(false)
        }
    }

    return (
        <section id="study-courses" aria-labelledby="course-choice-title" className="editorial-surface mt-10 p-6 md:p-8">
            <p className="editorial-kicker">Choose your course</p>
            <h2 id="course-choice-title" className="mt-2 text-2xl font-semibold tracking-tight text-[var(--ath-text)]">
                Which course would you like to complete?
            </h2>
            <p className="mt-2 text-sm text-[var(--ath-muted)]">
                You complete one of these two courses for the study. Pick the one that is most useful to you.
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
                {courses.map((course) => {
                    const selected = pending?.id === course.id
                    return (
                        <button
                            key={course.id}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => setPending(course)}
                            className={`rounded-[1.6rem] border p-5 text-left transition-colors ${selected
                                ? 'border-[var(--ath-primary)] bg-[color-mix(in_srgb,var(--ath-primary)_12%,var(--ath-panel))]'
                                : 'border-[var(--ath-line)] bg-[var(--ath-panel)] hover:border-[var(--ath-primary)]'
                                }`}
                        >
                            <h3 className="text-xl font-semibold text-[var(--ath-text)]">{course.title}</h3>
                            <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-[var(--ath-secondary)]">
                                {course.chapters} chapters · {course.sections} sections
                            </p>
                            <p className="mt-3 text-sm leading-6 text-[var(--ath-muted)]">{course.description}</p>
                        </button>
                    )
                })}
            </div>

            {pending && (
                <div className="mt-5 rounded-[1.2rem] border border-[var(--ath-primary)] bg-[var(--ath-panel)] p-4">
                    <p className="text-sm text-[var(--ath-text)]">
                        You will work through all {pending.sections} sections of <strong>{pending.title}</strong>. You can change
                        your choice until you finish your first section.
                    </p>
                    <button
                        type="button"
                        onClick={confirm}
                        disabled={saving}
                        className="editorial-button mt-3 px-5 py-2.5 text-sm disabled:opacity-60"
                    >
                        {saving ? 'Saving...' : `Start ${pending.title}`}
                    </button>
                </div>
            )}
            {error && <p role="alert" className="mt-3 text-sm font-medium text-[var(--ath-danger)]">{error}</p>}
        </section>
    )
}
