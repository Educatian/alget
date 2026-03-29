import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Brain, GraduationCap, Layers3, Microscope, ShieldCheck, Sparkles } from 'lucide-react'
import AuthModal from '../components/AuthModal'
import GenerativeIllustration from '../components/GenerativeIllustration'

const platformSignals = [
    { value: 'Adaptive', label: 'instructional pathway orchestration' },
    { value: 'Live', label: 'social presence and peer momentum' },
    { value: 'Measured', label: 'open learner model analytics' }
]

const featureCards = [
    {
        icon: Brain,
        title: 'Adaptive tutoring surfaces',
        description: 'Every reading flow, support rail, and practice action can shift based on mastery, friction, and confidence signals.'
    },
    {
        icon: Microscope,
        title: 'Interactive concept work',
        description: 'Learners move between explanation, simulation, generation, and knowledge checks without leaving the textbook context.'
    },
    {
        icon: Layers3,
        title: 'Research-grade instrumentation',
        description: 'The platform captures learning telemetry, progression, help-seeking, and cohort-level dynamics for researcher review.'
    },
    {
        icon: ShieldCheck,
        title: 'Institution-ready control',
        description: 'Server-side access validation, cohort modes, and cloud-synced progress support more reliable deployment workflows.'
    }
]

const workflowSteps = [
    {
        step: '01',
        title: 'Enter the right learning mode',
        description: 'Unlock engineering or education pathways with server-validated access, then land in the modules that fit the cohort.'
    },
    {
        step: '02',
        title: 'Read, ask, and practice in one place',
        description: 'Text, diagrams, quick checks, adaptive help, and lab-like generation stay connected to the current section context.'
    },
    {
        step: '03',
        title: 'Review the learner model',
        description: 'Researchers and instructors can see mastery, completion momentum, social activity, and emerging points of struggle.'
    }
]

export default function LandingPage({ onLogin, user, onLogout }) {
    const [authOpen, setAuthOpen] = useState(false)
    const navigate = useNavigate()

    return (
        <div className="relative flex min-h-screen flex-col overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(158,27,50,0.12),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(37,99,235,0.1),_transparent_30%),linear-gradient(to_bottom,_#f8fafc,_#ffffff)] text-slate-900 font-sans">
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -left-28 top-12 h-72 w-72 rounded-full bg-[#9E1B32]/10 blur-[110px]"></div>
                <div className="absolute right-[-8%] top-[8%] h-80 w-80 rounded-full bg-sky-300/18 blur-[120px]"></div>
                <div className="absolute bottom-[-12%] left-[20%] h-96 w-96 rounded-full bg-indigo-200/20 blur-[140px]"></div>
            </div>

            <nav className="sticky top-0 z-50 border-b border-white/70 bg-white/72 backdrop-blur-2xl">
                <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-linear-to-br from-[#9E1B32] to-[#7A1527] text-lg font-bold text-white shadow-lg shadow-red-900/20">
                            AL
                        </div>
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400">University Learning Platform</p>
                            <p className="text-xl font-bold tracking-tight text-slate-900">ALGET</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {user ? (
                            <>
                                <span className="hidden text-sm font-medium text-slate-500 sm:inline-block">{user.email}</span>
                                <button
                                    onClick={() => navigate('/learn')}
                                    className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-slate-900/15 transition-all hover:-translate-y-0.5 hover:bg-slate-800"
                                >
                                    Open Workspace
                                    <ArrowRight className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={onLogout}
                                    className="rounded-full px-4 py-2 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                                >
                                    Sign Out
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={() => setAuthOpen(true)}
                                className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-slate-50"
                            >
                                Sign In
                            </button>
                        )}
                    </div>
                </div>
            </nav>

            <main className="relative z-10 flex-1">
                <section className="mx-auto grid max-w-7xl gap-14 px-6 pb-20 pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:pt-24">
                    <div className="flex flex-col justify-center">
                        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#9E1B32]/10 bg-white/80 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.22em] text-[#9E1B32] shadow-sm">
                            <Sparkles className="h-3.5 w-3.5" />
                            Intelligent textbook platform
                        </div>

                        <h1 className="mt-8 max-w-3xl text-5xl font-black tracking-tight text-slate-950 md:text-7xl">
                            The commercial-grade
                            <span className="block bg-gradient-to-r from-[#9E1B32] via-[#c41e3a] to-[#2563eb] bg-clip-text text-transparent">
                                generative learning surface
                            </span>
                        </h1>

                        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
                            ALGET combines adaptive reading, AI tutoring, social presence, and learner-model analytics in one institutional product surface for engineering and education pathways.
                        </p>

                        <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                            {user ? (
                                <button
                                    onClick={() => navigate('/learn')}
                                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-7 py-4 text-base font-semibold text-white shadow-[0_18px_40px_rgba(15,23,42,0.18)] transition-all hover:-translate-y-0.5 hover:bg-slate-800"
                                >
                                    Open learning workspace
                                    <ArrowRight className="h-5 w-5" />
                                </button>
                            ) : (
                                <button
                                    onClick={() => setAuthOpen(true)}
                                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-7 py-4 text-base font-semibold text-white shadow-[0_18px_40px_rgba(15,23,42,0.18)] transition-all hover:-translate-y-0.5 hover:bg-slate-800"
                                >
                                    Sign in to start
                                    <ArrowRight className="h-5 w-5" />
                                </button>
                            )}
                            <button
                                onClick={() => navigate(user ? '/analytics' : '/')}
                                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white/90 px-7 py-4 text-base font-semibold text-slate-700 shadow-sm transition-colors hover:bg-white"
                            >
                                Explore researcher view
                            </button>
                        </div>

                        <div className="mt-10 grid gap-3 sm:grid-cols-3">
                            {platformSignals.map((item) => (
                                <div key={item.label} className="rounded-2xl border border-white/70 bg-white/72 px-4 py-4 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
                                    <p className="text-lg font-bold text-slate-900">{item.value}</p>
                                    <p className="mt-1 text-sm leading-6 text-slate-500">{item.label}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="relative">
                        <div className="absolute -inset-6 rounded-[2.5rem] bg-gradient-to-br from-[#9E1B32]/12 via-transparent to-sky-300/15 blur-2xl"></div>
                        <div className="relative overflow-hidden rounded-[2.5rem] border border-white/70 bg-slate-950 p-6 shadow-[0_30px_80px_rgba(15,23,42,0.2)]">
                            <div className="mb-4 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                                <div>
                                    <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">Active surface</p>
                                    <p className="text-sm font-semibold text-white">Adaptive textbook + social presence</p>
                                </div>
                                <div className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300">
                                    Live
                                </div>
                            </div>
                            <div className="rounded-[2rem] border border-white/10 bg-white/4 p-4">
                                <GenerativeIllustration />
                            </div>
                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Learning rail</p>
                                    <p className="mt-2 text-sm leading-6 text-slate-200">Explain, reframe, practice, and ask in the same section context.</p>
                                </div>
                                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Research mode</p>
                                    <p className="mt-2 text-sm leading-6 text-slate-200">Trace mastery, progression, help-seeking, and cohort activity from one dashboard.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="border-y border-slate-200/70 bg-white/70 py-20 backdrop-blur-xl">
                    <div className="mx-auto max-w-7xl px-6 lg:px-8">
                        <div className="max-w-2xl">
                            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#9E1B32]">Core product capabilities</p>
                            <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
                                Designed for institutions that need rigor, usability, and visibility
                            </h2>
                        </div>

                        <div className="mt-10 grid gap-6 md:grid-cols-2">
                            {featureCards.map((feature) => {
                                const Icon = feature.icon
                                return (
                                    <div
                                        key={feature.title}
                                        className="group rounded-[2rem] border border-slate-200/80 bg-white p-8 shadow-[0_16px_40px_rgba(15,23,42,0.05)] transition-all hover:-translate-y-1 hover:shadow-[0_24px_50px_rgba(15,23,42,0.08)]"
                                    >
                                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#9E1B32]/8 text-[#9E1B32]">
                                            <Icon className="h-6 w-6" />
                                        </div>
                                        <h3 className="mt-6 text-xl font-bold tracking-tight text-slate-900">{feature.title}</h3>
                                        <p className="mt-3 text-[15px] leading-7 text-slate-600">{feature.description}</p>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </section>

                <section className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
                    <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#9E1B32]">Workflow</p>
                            <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
                                A textbook that behaves more like a learning operating system
                            </h2>
                            <p className="mt-4 max-w-xl text-[15px] leading-7 text-slate-600">
                                The product is designed to support students, instructors, and researchers within a single coherent interface instead of splitting them into disconnected tools.
                            </p>
                        </div>

                        <div className="rounded-[2.5rem] border border-white/70 bg-white/80 p-8 shadow-[0_18px_50px_rgba(15,23,42,0.06)] backdrop-blur-xl">
                            <div className="space-y-8">
                                {workflowSteps.map((item) => (
                                    <div key={item.step} className="flex gap-5">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
                                            {item.step}
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold tracking-tight text-slate-900">{item.title}</h3>
                                            <p className="mt-2 text-[15px] leading-7 text-slate-600">{item.description}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            <footer className="border-t border-slate-200/70 bg-white/80 py-8 backdrop-blur-xl">
                <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 text-sm font-medium text-slate-500 lg:flex-row lg:items-center lg:justify-between lg:px-8">
                    <div className="flex items-center gap-2">
                        <GraduationCap className="h-4 w-4" />
                        <span>Adaptive Design of e-Learning Lab · University of Alabama</span>
                    </div>
                    <span>Commercial-grade generative textbook interface for engineering and education pathways</span>
                </div>
            </footer>

            <AuthModal
                isOpen={authOpen}
                onClose={() => setAuthOpen(false)}
                onSuccess={(nextUser) => {
                    setAuthOpen(false)
                    onLogin(nextUser)
                }}
            />
        </div>
    )
}
