import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ArrowRight, Brain, GraduationCap, Layers3, Microscope, ShieldCheck, Sparkles } from 'lucide-react'
import AuthModal from '../components/AuthModal'
import ThemeToggle from '../components/ThemeToggle'
import { formatUserLabel } from '../lib/cohortLearner'

const platformSignals = [
    { value: '8', label: 'active pathways' },
    { value: '256', label: 'guided sections' },
    { value: '1', label: 'explainable learner model' }
]

const featureCards = [
    {
        icon: Brain,
        title: 'Know what to learn next',
        description: 'Mastery and recent friction shape one clear next action without interrupting the learning flow.'
    },
    {
        icon: Microscope,
        title: 'Practice inside the reading',
        description: 'Explanation, simulation, generation, and checks remain beside the concept that prompted them.'
    },
    {
        icon: Layers3,
        title: 'See why support appears',
        description: 'Learners can inspect the evidence behind a recommendation and choose whether to follow it.'
    },
    {
        icon: ShieldCheck,
        title: 'Keep evidence inspectable',
        description: 'Progress, confidence, support, and cohort signals stay visible to authorized educators and researchers.'
    }
]

const workflowSteps = [
    {
        step: '01',
        title: 'Set the learning goal',
        description: 'Enter the right pathway and return to the most useful next section.'
    },
    {
        step: '02',
        title: 'Read, ask, and practice in one place',
        description: 'Text, diagrams, checks, guided help, and generation stay with the concept.'
    },
    {
        step: '03',
        title: 'Understand the recommendation',
        description: 'Review the evidence, choose the support, and continue with a clear next step.'
    }
]

export default function LandingPage({ onLogin, user, onLogout }) {
    const [authOpen, setAuthOpen] = useState(false)
    const navigate = useNavigate()
    const userLabel = formatUserLabel(user)

    return (
        <div className="editorial-shell relative flex min-h-screen flex-col overflow-hidden text-[var(--ath-text)]">
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="glow-orb left-[-8rem] top-6 h-72 w-72 bg-[color-mix(in_srgb,var(--ath-primary)_18%,transparent)]"></div>
                <div className="glow-orb right-[-7rem] top-[8%] h-80 w-80 bg-[color-mix(in_srgb,var(--ath-accent)_12%,transparent)]"></div>
                <div className="glow-orb-dark bottom-[-8rem] left-[18%] h-96 w-96 bg-[color-mix(in_srgb,var(--ath-primary)_16%,transparent)]"></div>
            </div>

            <nav className="ath-topbar sticky top-0 z-50">
                <div className="ath-container ath-container-marketing flex flex-wrap items-center justify-between gap-3 py-3.5">
                    <button
                        type="button"
                        onClick={() => navigate('/')}
                        aria-label="Go to ALGET home"
                        className="flex min-w-0 items-center gap-3 rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--ath-primary)_30%,transparent)]"
                    >
                        <div className="ath-brand-mark">
                            AL
                        </div>
                        <div className="min-w-0 leading-tight">
                            <p className="text-base font-semibold tracking-tight text-[var(--ath-primary-deep)]">ALGET</p>
                            <p className="hidden text-[length:var(--ath-text-2xs)] font-medium uppercase tracking-[0.18em] text-[var(--ath-secondary)] sm:block">Alabama Generative Intelligent Textbook</p>
                        </div>
                    </button>

                    <div className="flex flex-wrap items-center justify-end gap-2">
                        <ThemeToggle />
                        {user ? (
                            <>
                                <span className="hidden max-w-[12rem] truncate text-sm font-medium text-[var(--ath-muted)] lg:inline-block">{userLabel}</span>
                                <button
                                    onClick={() => navigate('/learn')}
                                    className="editorial-button px-3 py-2 text-sm sm:px-5 sm:py-2.5"
                                >
                                    Open workspace
                                    <ArrowRight className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={onLogout}
                                    className="editorial-button-secondary px-3 py-2 text-sm sm:px-4"
                                >
                                    Sign out
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={() => setAuthOpen(true)}
                                className="editorial-button-secondary px-3 py-2 text-sm sm:px-5 sm:py-2.5"
                            >
                                Sign in
                            </button>
                        )}
                    </div>
                </div>
            </nav>

            <main className="relative z-10 flex-1">
                <section className="ath-container ath-container-marketing grid gap-10 pb-16 pt-12 lg:grid-cols-[1.08fr_0.92fr] lg:gap-14 lg:pt-20">
                    <div className="flex flex-col justify-center">
                        <div className="editorial-pill w-fit">
                            <Sparkles className="h-3.5 w-3.5" />
                            Intelligent textbook platform
                        </div>

                        <p className="mt-8 editorial-kicker">University learning platform</p>
                        <h1 className="editorial-title ath-hero-title mt-3 max-w-4xl">
                            Alabama Generative Intelligent Textbook
                        </h1>

                        <p className="ath-hero-dek mt-6 max-w-2xl">
                            Know what to learn next, practice without leaving the reading, and understand why adaptive support appears.
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
                                    Start as a learner
                                    <ArrowRight className="h-5 w-5" />
                                </button>
                            )}
                            <button
                                onClick={() => navigate('/analytics')}
                                className="editorial-button-secondary px-7 py-4 text-base"
                            >
                                Explore evidence dashboard
                            </button>
                        </div>

                        <div className="ath-proof-strip mt-8 grid grid-cols-3">
                            {platformSignals.map((item) => (
                                <div key={item.label} className="ath-proof-card">
                                    <p className="ath-proof-value">{item.value}</p>
                                    <p className="ath-proof-label">{item.label}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="relative">
                        <div className="absolute -inset-6 rounded-[2.7rem] bg-[radial-gradient(circle_at_top_right,_color-mix(in_srgb,var(--ath-primary-soft)_85%,transparent),_transparent_42%),radial-gradient(circle_at_bottom_left,_color-mix(in_srgb,var(--ath-accent)_14%,transparent),_transparent_36%)] blur-2xl"></div>
                        <div className="ath-product-preview relative overflow-hidden p-6">
                            <div className="mb-3 flex items-center gap-2">
                                <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" aria-hidden />
                                <span className="text-[length:var(--ath-text-2xs)] font-bold uppercase tracking-[0.22em] text-white/55">Live preview</span>
                            </div>
                            <div className="ath-learning-preview">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <span className="ath-preview-chip">ME 201 · Momentum</span>
                                    <span className="text-xs font-semibold text-emerald-300">68% mastery</span>
                                </div>

                                <div className="mt-8">
                                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/50">Recommended next</p>
                                    <h2 className="mt-3 max-w-md text-3xl font-semibold leading-tight text-white">Practice impulse–momentum transfer</h2>
                                    <p className="mt-4 max-w-lg text-sm leading-6 text-white/65">
                                        Your confidence is high, but one applied example is still missing from the evidence trail.
                                    </p>
                                </div>

                                <div
                                    className="ath-preview-progress mt-7"
                                    role="progressbar"
                                    aria-label="Mastery progress"
                                    aria-valuemin={0}
                                    aria-valuemax={100}
                                    aria-valuenow={68}
                                >
                                    <span style={{ width: '68%' }} />
                                </div>

                                <div className="mt-7 grid gap-3 sm:grid-cols-2">
                                    <div className="ath-preview-action ath-preview-action-primary">
                                        <Brain className="h-5 w-5" />
                                        <span>Open guided practice</span>
                                    </div>
                                    <div className="ath-preview-action">
                                        <Sparkles className="h-5 w-5" />
                                        <span>Why this step?</span>
                                    </div>
                                </div>

                                <div className="mt-7 flex items-center gap-3 border-t border-white/10 pt-5 text-xs text-white/50">
                                    <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                                    Based on mastery, confidence, and recent practice evidence
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="ath-section-band py-16">
                    <div className="ath-container ath-container-marketing">
                        <div className="max-w-2xl">
                            <p className="editorial-kicker">Core product capabilities</p>
                            <h2 className="editorial-title mt-3 text-3xl md:text-4xl">
                                Learning outcomes by design
                            </h2>
                        </div>

                        <div className="mt-8 grid gap-x-10 gap-y-2 md:grid-cols-2">
                            {featureCards.map((feature) => {
                                const Icon = feature.icon
                                return (
                                    <div
                                        key={feature.title}
                                        className="ath-feature-card group px-0 py-7"
                                    >
                                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[color-mix(in_srgb,var(--ath-primary)_8%,transparent)] text-[var(--ath-primary)]">
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

                <section className="ath-container ath-container-marketing py-16">
                    <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
                        <div>
                            <p className="editorial-kicker">Workflow</p>
                            <h2 className="editorial-title mt-3 text-3xl md:text-4xl">
                                A transparent learning loop
                            </h2>
                            <p className="mt-4 max-w-xl text-[15px] leading-7 text-[var(--ath-muted)]">
                                Every recommendation connects a learner action to visible evidence and a clear next step.
                            </p>
                        </div>

                        <div className="ath-workflow-card py-2 lg:px-4">
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

            <footer className="ath-footer py-7 backdrop-blur-xl">
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
                onSuccess={(nextUser, options = {}) => {
                    onLogin(nextUser)
                    setAuthOpen(false)
                    if (options.redirectTo) {
                        navigate(options.redirectTo)
                    }
                }}
            />
        </div>
    )
}
