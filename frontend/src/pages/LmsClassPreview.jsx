import { ArrowRight, ClipboardCheck, Clock3, ExternalLink, ShieldCheck } from 'lucide-react'
import { useNavigate } from 'react-router'
import { LMS_CLASS_EXEMPLAR } from '../lib/lmsClassExemplar'

export default function LmsClassPreview({ user = null }) {
    const navigate = useNavigate()
    const exemplar = LMS_CLASS_EXEMPLAR
    const analyticsPath = import.meta.env.DEV
        ? `/dashboard?course=${exemplar.courseId}&section=02/08&fixture=intro-lms-weak`
        : `/dashboard?course=${exemplar.courseId}&section=02/08`

    return (
        <div className="editorial-shell min-h-screen">
            <main className="ath-container py-8 sm:py-12">
                <header className="max-w-3xl">
                    <p className="editorial-kicker">Local class preview · {exemplar.id}</p>
                    <h1 className="mt-2 font-headline text-3xl font-semibold tracking-tight text-[var(--ath-text)] sm:text-4xl">{exemplar.title}</h1>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--ath-muted)]">
                        A reviewable 120-minute LMS learning path using the existing online-learning module, one learner-authored artifact, and an evidence-limited agent loop.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-[var(--ath-secondary)]">
                        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--ath-panel)] px-3 py-1"><Clock3 className="h-3.5 w-3.5" />{exemplar.baseMinutes} min base</span>
                        <span className="rounded-full bg-[var(--ath-panel)] px-3 py-1">{exemplar.extensionMinutes} min extension</span>
                        <span className="rounded-full bg-[var(--ath-panel)] px-3 py-1">{exemplar.audience}</span>
                    </div>
                </header>

                <section className="mt-8 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
                    <div className="content-card p-5">
                        <div className="flex items-center gap-2">
                            <ClipboardCheck className="h-5 w-5 text-[var(--ath-primary)]" aria-hidden="true" />
                            <h2 className="font-headline text-xl font-semibold text-[var(--ath-text)]">One concrete learner task</h2>
                        </div>
                        <h3 className="mt-4 text-base font-semibold text-[var(--ath-text)]">{exemplar.task.title}</h3>
                        <p className="mt-2 text-sm leading-6 text-[var(--ath-muted)]">{exemplar.task.prompt}</p>
                        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                            {exemplar.task.requiredEvidence.map((item) => <li key={item} className="rounded-[var(--ath-radius)] bg-[var(--ath-panel)] px-3 py-2 text-xs font-semibold text-[var(--ath-text)]">{item}</li>)}
                        </ul>
                        <div className="mt-5 flex flex-wrap gap-2">
                            <button type="button" onClick={() => navigate(`/book/${exemplar.sectionPath}`)} className="editorial-button inline-flex items-center gap-2 px-4 py-2 text-xs">
                                Open reading module <ArrowRight className="h-3.5 w-3.5" />
                            </button>
                            {user && <button type="button" onClick={() => navigate(analyticsPath)} className="editorial-button-secondary inline-flex items-center gap-2 px-4 py-2 text-xs">Open learner analytics</button>}
                        </div>
                        <p className="mt-3 text-[length:var(--ath-text-2xs)] text-[var(--ath-muted)]">Preview entry: <code>/book/{exemplar.sectionPath}</code></p>
                    </div>

                    <div className="content-card p-5">
                        <h2 className="font-headline text-xl font-semibold text-[var(--ath-text)]">Learning objectives</h2>
                        <ol className="mt-4 grid gap-3">
                            {exemplar.objectives.map((objective, index) => <li key={objective} className="flex gap-3 text-sm leading-6 text-[var(--ath-muted)]"><span className="ath-stat text-[var(--ath-primary)]">{index + 1}</span><span>{objective}</span></li>)}
                        </ol>
                    </div>
                </section>

                <section className="mt-5 content-card p-5">
                    <h2 className="font-headline text-xl font-semibold text-[var(--ath-text)]">120-minute path</h2>
                    <ol className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                        {exemplar.timeline.map((step) => <li key={step.label} className="rounded-[var(--ath-radius)] border border-[var(--ath-line)] bg-[var(--ath-surface)] p-3"><p className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--ath-secondary)]"><span className="ath-stat">{step.minutes}</span> min · {step.label}</p><p className="mt-2 text-sm leading-5 text-[var(--ath-text)]">{step.detail}</p></li>)}
                    </ol>
                    <div className="mt-5 rounded-[var(--ath-radius)] bg-[var(--ath-panel)] p-4"><p className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--ath-secondary)]">180-minute extension</p><ul className="mt-2 grid gap-1 text-sm leading-5 text-[var(--ath-muted)]">{exemplar.extension.map((item) => <li key={item}>· {item}</li>)}</ul></div>
                </section>

                <section className="mt-5 grid gap-5 lg:grid-cols-2">
                    <div className="content-card p-5">
                        <h2 className="font-headline text-xl font-semibold text-[var(--ath-text)]">Artifact rubric</h2>
                        <div className="mt-4 grid gap-3">{exemplar.rubric.map((dimension) => <div key={dimension.id} className="rounded-[var(--ath-radius)] bg-[var(--ath-panel)] p-3"><p className="text-sm font-semibold text-[var(--ath-text)]">{dimension.label}</p><p className="mt-1 text-xs leading-5 text-[var(--ath-muted)]">{dimension.observable}</p></div>)}</div>
                    </div>
                    <div className="content-card p-5">
                        <h2 className="font-headline text-xl font-semibold text-[var(--ath-text)]">Qualitative reflection</h2>
                        <ol className="mt-4 grid gap-3">{exemplar.reflections.map((question, index) => <li key={question} className="flex gap-3 text-sm leading-6 text-[var(--ath-muted)]"><span className="ath-stat text-[var(--ath-primary)]">{index + 1}</span><span>{question}</span></li>)}</ol>
                    </div>
                </section>

                <section className="mt-5 rounded-[var(--ath-radius)] border border-[var(--ath-line)] bg-[var(--ath-panel)] p-4" role="note">
                    <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[var(--ath-primary)]" aria-hidden="true" /><div><p className="text-sm font-semibold text-[var(--ath-text)]">Evidence and export boundary</p><p className="mt-1 text-xs leading-5 text-[var(--ath-muted)]">{exemplar.exportJoin.limitation} Export joins use {exemplar.exportJoin.learnerKey}, {exemplar.exportJoin.sessionKey}, {exemplar.exportJoin.sectionKey}, and derived artifact scores only. No consent, IRB approval, instructor sign-off, or production release is implied by this preview.</p></div></div>
                </section>

                <footer className="mt-6 flex flex-wrap items-center gap-3 text-xs text-[var(--ath-muted)]"><span>Module source: {exemplar.sectionPath}</span><button type="button" onClick={() => navigate('/')} className="inline-flex items-center gap-1 font-semibold text-[var(--ath-primary)] hover:underline">Back to ALGET <ExternalLink className="h-3 w-3" /></button></footer>
            </main>
        </div>
    )
}
