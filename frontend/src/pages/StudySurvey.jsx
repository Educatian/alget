import { ExternalLink, ShieldCheck } from 'lucide-react'
import { Link, useParams } from 'react-router'
import {
    buildEngineeringStudySurveyUrl,
    ENGINEERING_STUDY_SURVEY_PHASES,
    getEngineeringStudySurveyConfig,
    isEngineeringStudySurveyUser,
} from '../lib/engineeringStudySurvey'

export default function StudySurvey({ user }) {
    const { phase } = useParams()
    const phaseConfig = ENGINEERING_STUDY_SURVEY_PHASES[phase]
    const config = getEngineeringStudySurveyConfig()
    const studyId = String(user?.user_metadata?.learner_hash || '').trim().toLowerCase()
    const authorized = isEngineeringStudySurveyUser(user)
    const surveyId = phaseConfig ? config.surveyIds[phase] : ''
    const surveyUrl = authorized && config.enabled && phaseConfig
        ? buildEngineeringStudySurveyUrl({ datacenter: config.datacenter, surveyId, studyId, phase })
        : null

    if (!authorized) {
        return (
            <main className="editorial-shell flex min-h-screen items-center justify-center px-5">
                <section className="editorial-surface max-w-2xl p-8">
                    <p className="editorial-kicker">Research access required</p>
                    <h1 className="mt-3 text-3xl font-semibold text-[var(--ath-text)]">This survey is invitation-only.</h1>
                    <p className="mt-4 text-sm leading-7 text-[var(--ath-muted)]">Sign in with the research account bound to the locked Bio-Inspired Design roster. Do not create a second account.</p>
                    <Link className="editorial-button mt-6 inline-flex" to="/learn">Return to pathways</Link>
                </section>
            </main>
        )
    }

    if (!phaseConfig || !surveyUrl) {
        return (
            <main className="editorial-shell flex min-h-screen items-center justify-center px-5">
                <section className="editorial-surface max-w-2xl p-8" role="status">
                    <p className="editorial-kicker">Survey hold</p>
                    <h1 className="mt-3 text-3xl font-semibold text-[var(--ath-text)]">This study form is not enabled.</h1>
                    <p className="mt-4 text-sm leading-7 text-[var(--ath-muted)]">The portal stays closed until the exact Qualtrics project passes IRB, measurement, privacy, scoring, mobile, synthetic-response, and export checks. Contact the research team if you expected access.</p>
                    <Link className="editorial-button mt-6 inline-flex" to="/learn">Return to pathways</Link>
                </section>
            </main>
        )
    }

    return (
        <main className="editorial-shell min-h-screen px-3 py-5 md:px-6">
            <section className="editorial-surface mx-auto max-w-6xl overflow-hidden">
                <div className="border-b border-[var(--ath-line)] p-5 md:p-7">
                    <div className="flex flex-wrap items-start justify-between gap-5">
                        <div>
                            <p className="editorial-kicker">Secure Qualtrics touchpoint</p>
                            <h1 className="mt-2 text-3xl font-semibold text-[var(--ath-text)]">{phaseConfig.title}</h1>
                            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--ath-muted)]">The form is hosted by Qualtrics and displayed inside ALGET. Your random Study ID links approved study records; legal name and contact information belong only in the separate compensation form.</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <a className="editorial-button inline-flex items-center gap-2" href={surveyUrl} target="_blank" rel="noreferrer">
                                Open in new tab <ExternalLink className="h-4 w-4" />
                            </a>
                            <Link className="editorial-button-secondary inline-flex" to="/learn">Return</Link>
                        </div>
                    </div>
                    <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-[var(--ath-line)] bg-[var(--ath-panel)] px-3 py-1 text-xs text-[var(--ath-muted)]">
                        <ShieldCheck className="h-4 w-4 text-[var(--ath-success)]" /> Study ID: {studyId}
                    </p>
                </div>
                <iframe
                    className="block min-h-[78vh] w-full border-0 bg-white"
                    src={surveyUrl}
                    title={phaseConfig.title}
                    referrerPolicy="strict-origin-when-cross-origin"
                    sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                />
            </section>
        </main>
    )
}
