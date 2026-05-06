import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Brain, GraduationCap, Layers3, Microscope, ShieldCheck, Sparkles } from 'lucide-react'
import AuthModal from '../components/AuthModal'
import GenerativeIllustration from '../components/GenerativeIllustration'
import ThemeToggle from '../components/ThemeToggle'

const platformSignals = [
    { value: 'Adaptive', label: 'pathway-aware reading' },
    { value: 'Live', label: 'quiet peer signals' },
    { value: 'Measured', label: 'visible learner models' }
]

const featureCards = [
    {
        icon: Brain,
        title: 'Adaptive tutoring surfaces',
        description: 'Reading, support, and practice respond to mastery and friction signals.'
    },
    {
        icon: Microscope,
        title: 'Interactive concept work',
        description: 'Explanation, simulation, generation, and checks stay in the textbook.'
    },
    {
        icon: Layers3,
        title: 'Research-grade instrumentation',
        description: 'Progress, support, and cohort patterns remain inspectable.'
    },
    {
        icon: ShieldCheck,
        title: 'Institution-ready control',
        description: 'Cohort access, synced progress, and deployment controls are built in.'
    }
]

const workflowSteps = [
    {
        step: '01',
        title: 'Enter the right learning mode',
        description: 'Engineering and education pathways open by cohort.'
    },
    {
        step: '02',
        title: 'Read, ask, and practice in one place',
        description: 'Text, diagrams, checks, help, and generation stay with the section.'
    },
    {
        step: '03',
        title: 'Review the learner model',
        description: 'Mastery, momentum, and friction become visible.'
    }
]

export default function LandingPage({ onLogin, user, onLogout }) {
    const [authOpen, setAuthOpen] = useState(false)
    const navigate = useNavigate()

    return (
        <div className="editorial-shell relative flex min-h-screen flex-col overflow-hidden text-[var(--ath-text)]">
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="glow-orb left-[-8rem] top-6 h-72 w-72 bg-[rgba(15,81,103,0.18)]"></div>
                <div className="glow-orb right-[-7rem] top-[8%] h-80 w-80 bg-[rgba(199,137,67,0.12)]"></div>
                <div className="glow-orb-dark bottom-[-8rem] left-[18%] h-96 w-96 bg-[rgba(15,81,103,0.16)]"></div>
            </div>

            <nav className="sticky top-0 z-50 border-b border-[var(--ath-line)] bg-[rgba(248,246,241,0.82)] backdrop-blur-2xl">
                <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
                    <button
                        type="button"
                        onClick={() => navigate('/')}
                        aria-label="Go to ALGET home"
                        className="flex items-center gap-4 rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(15,81,103,0.28)]"
                    >
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[rgba(15,81,103,0.12)] bg-[var(--ath-primary)] text-lg font-bold text-white shadow-[0_16px_32px_rgba(9,56,72,0.18)]">
                            AL
                        </div>
                        <div>
                            <p className="editorial-kicker">The Scholarly Editorial</p>
                            <p className="mt-1 text-xl font-semibold tracking-tight text-[var(--ath-primary-deep)]">ALGET</p>
                        </div>
                    </button>

                    <div className="flex items-center gap-3">
                        <ThemeToggle />
                        {user ? (
                            <>
                                <span className="hidden text-sm font-medium text-[var(--ath-muted)] sm:inline-block">{user.email}</span>
                                <button
                                    onClick={() => navigate('/learn')}
                                    className="editorial-button px-5 py-2.5 text-sm"
                                >
                                    Open workspace
                                    <ArrowRight className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={onLogout}
                                    className="editorial-button-secondary px-4 py-2 text-sm"
                                >
                                    Sign out
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={() => setAuthOpen(true)}
                                className="editorial-button-secondary px-5 py-2.5 text-sm"
                            >
                                Sign in
                            </button>
                        )}
                    </div>
                </div>
            </nav>

            <main className="relative z-10 flex-1">
                <section className="mx-auto grid max-w-7xl gap-14 px-6 pb-20 pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:pt-24">
                    <div className="flex flex-col justify-center">
                        <div className="editorial-pill w-fit">
                            <Sparkles className="h-3.5 w-3.5" />
                            Intelligent textbook platform
                        </div>

                        <p className="mt-8 editorial-kicker">University learning platform</p>
                        <h1 className="editorial-title mt-3 max-w-4xl text-5xl leading-[0.95] md:text-7xl">
                            Alabama Generative Intelligent Textbook
                        </h1>

                        <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--ath-muted)]">
                            Adaptive reading, tutor support, peer signals, and learner-model visibility for university pathways.
                        </p>

                        <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                            {user ? (
                                <button
                                    onClick={() => navigate('/learn')}
                                    className="editorial-button px-7 py-4 text-base"
                                >
                                    Open learning workspace
                                    <ArrowRight className="h-5 w-5" />
                                </button>
                            ) : (
                                <button
                                    onClick={() => setAuthOpen(true)}
                                    className="editorial-button px-7 py-4 text-base"
                                >
                                    Sign in to start
                                    <ArrowRight className="h-5 w-5" />
                                </button>
                            )}
                            <button
                                onClick={() => navigate(user ? '/analytics' : '/')}
                                className="editorial-button-secondary px-7 py-4 text-base"
                            >
                                Explore researcher view
                            </button>
                        </div>

                        <div className="mt-10 grid gap-3 sm:grid-cols-3">
                            {platformSignals.map((item) => (
                                <div key={item.label} className="editorial-surface p-5">
                                    <p className="editorial-kicker">{item.value}</p>
                                    <p className="mt-3 text-base leading-7 text-[var(--ath-muted)]">{item.label}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="relative">
                        <div className="absolute -inset-6 rounded-[2.7rem] bg-[radial-gradient(circle_at_top_right,_rgba(200,226,236,0.85),_transparent_42%),radial-gradient(circle_at_bottom_left,_rgba(199,137,67,0.14),_transparent_36%)] blur-2xl"></div>
                        <div className="relative overflow-hidden rounded-[2.7rem] border border-[rgba(15,81,103,0.14)] bg-[linear-gradient(180deg,_rgba(18,41,51,0.98),_rgba(10,28,36,0.95))] p-6 shadow-[0_30px_80px_rgba(15,23,42,0.24)]">
                            <div className="mb-3 flex items-center gap-2">
                                <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" aria-hidden />
                                <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/55">Live preview</span>
                            </div>
                            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-4">
                                <GenerativeIllustration />
                            </div>
                        </div>
                    </div>
                </section>

                <section className="border-y border-[var(--ath-line)] bg-[rgba(255,255,255,0.45)] py-20 backdrop-blur-xl">
                    <div className="mx-auto max-w-7xl px-6 lg:px-8">
                        <div className="max-w-2xl">
                            <p className="editorial-kicker">Core product capabilities</p>
                            <h2 className="editorial-title mt-3 text-3xl md:text-4xl">
                                Institutional by design
                            </h2>
                        </div>

                        <div className="mt-10 grid gap-6 md:grid-cols-2">
                            {featureCards.map((feature) => {
                                const Icon = feature.icon
                                return (
                                    <div
                                        key={feature.title}
                                        className="editorial-surface group p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_50px_rgba(15,23,42,0.08)]"
                                    >
                                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[rgba(15,81,103,0.08)] text-[var(--ath-primary)]">
                                            <Icon className="h-6 w-6" />
                                        </div>
                                        <h3 className="mt-6 text-2xl font-semibold tracking-tight text-[var(--ath-text)]">{feature.title}</h3>
                                        <p className="mt-3 text-[15px] leading-7 text-[var(--ath-muted)]">{feature.description}</p>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </section>

                <section className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
                    <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
                        <div>
                            <p className="editorial-kicker">Workflow</p>
                            <h2 className="editorial-title mt-3 text-3xl md:text-4xl">
                                A textbook with memory
                            </h2>
                            <p className="mt-4 max-w-xl text-[15px] leading-7 text-[var(--ath-muted)]">
                                One surface for reading, support, evidence, and review.
                            </p>
                        </div>

                        <div className="editorial-surface p-8">
                            <div className="space-y-8">
                                {workflowSteps.map((item) => (
                                    <div key={item.step} className="flex gap-5">
                                        <div className="step-circle active">{item.step}</div>
                                        <div>
                                            <h3 className="text-xl font-semibold tracking-tight text-[var(--ath-text)]">{item.title}</h3>
                                            <p className="mt-2 text-[15px] leading-7 text-[var(--ath-muted)]">{item.description}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            <footer className="border-t border-[var(--ath-line)] bg-[rgba(255,255,255,0.52)] py-8 backdrop-blur-xl">
                <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 text-sm font-medium text-[var(--ath-muted)] lg:flex-row lg:items-center lg:justify-between lg:px-8">
                    <div className="flex items-center gap-2">
                        <GraduationCap className="h-4 w-4" />
                        <span>Sponsored by the Office of Sponsored Programs (OSP) at The University of Alabama</span>
                    </div>
                    <span>Adaptive reading, generative learning, learner-model visibility</span>
                </div>
            </footer>

            <AuthModal
                isOpen={authOpen}
                onClose={() => setAuthOpen(false)}
                onSuccess={(nextUser) => {
                    onLogin(nextUser)
                    setAuthOpen(false)
                }}
            />
        </div>
    )
}
