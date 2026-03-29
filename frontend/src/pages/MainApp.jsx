import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, BookOpen, LockKeyhole, Settings, Sparkles } from 'lucide-react'
import { StaticsIllustration, BioInspiredIllustration, InstDesignIllustration } from '../components/CourseIllustrations'
import SettingsModal from '../components/SettingsModal'
import API_BASE from '../lib/apiConfig'
import '../index.css'

const engineeringCourses = [
    {
        id: 'dynamics',
        title: 'ME 201: Engineering Dynamics',
        icon: <StaticsIllustration />,
        description: 'Foundational curriculum for motion, force relationships, energy, and momentum with adaptive reading and practice support.',
        topics: ['Kinematics', 'Kinetics', 'Work & Energy', 'Impulse & Momentum'],
        chapters: 10,
        sections: 45,
        duration: '15 weeks',
        level: 'Core Requirement',
        gradient: 'from-slate-700 to-slate-900',
        badge: null
    },
    {
        id: 'bio-inspired',
        title: 'Bio-Inspired Design',
        icon: <BioInspiredIllustration />,
        description: 'Applied biomimicry sequence connecting natural mechanisms to engineering concepts, generation labs, and design reasoning.',
        topics: ['Biomimicry', 'Natural Structures', 'Filtration', 'Adhesion'],
        chapters: 7,
        sections: 21,
        duration: 'Studio-paced',
        level: 'Advanced Track',
        gradient: 'from-[#4A148C] to-[#004D40]',
        badge: 'Lab-enabled'
    }
]

const educationCourses = [
    {
        id: 'inst-design',
        title: 'Foundation of Instructional Design',
        icon: <InstDesignIllustration />,
        description: 'Instructional design theory, pedagogy, assessment, and learner-centered strategy within an adaptive textbook workflow.',
        topics: ['Learning Theories', 'ADDIE', 'Assessment', 'Pedagogy'],
        chapters: 8,
        sections: 32,
        duration: '12 weeks',
        level: 'Core Requirement',
        gradient: 'from-blue-700 to-blue-900',
        badge: 'Research-ready'
    }
]

const capabilityCards = [
    {
        title: 'Adaptive support rail',
        description: 'Open explain, reframe, practice, and ask flows without losing section context.'
    },
    {
        title: 'Cloud-synced progression',
        description: 'Completion state can persist across devices instead of staying trapped on one browser.'
    },
    {
        title: 'Researcher analytics',
        description: 'Mastery, social momentum, and help-seeking signals can be reviewed in one dashboard.'
    }
]

export default function MainApp({ user, onLogout }) {
    const navigate = useNavigate()

    const [unlockedMode, setUnlockedMode] = useState(null)
    const [selectedMode, setSelectedMode] = useState('engineering')
    const [passcode, setPasscode] = useState('')
    const [error, setError] = useState('')
    const [isSettingsOpen, setIsSettingsOpen] = useState(false)
    const [unlocking, setUnlocking] = useState(false)

    const handleCourseSelect = (courseId) => {
        navigate(`/diagnostic/${courseId}`)
    }

    const handleUnlock = async (event) => {
        event.preventDefault()
        setUnlocking(true)
        setError('')

        try {
            const response = await fetch(`${API_BASE}/access/validate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    scope: selectedMode,
                    passcode
                })
            })

            if (!response.ok) {
                throw new Error(`Access validation failed: ${response.status}`)
            }

            const data = await response.json()
            if (!data.valid) {
                setError('Invalid access code')
                setPasscode('')
                return
            }

            setUnlockedMode(selectedMode)
            setPasscode('')
        } catch (err) {
            console.error(err)
            setError('Unable to validate access right now')
        } finally {
            setUnlocking(false)
        }
    }

    const visibleCourses = unlockedMode === 'engineering' ? engineeringCourses : educationCourses

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(158,27,50,0.08),_transparent_30%),linear-gradient(to_bottom,_#f8fafc,_#eef2f7)] font-sans selection:bg-[#9E1B32]/20">
            <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

            <header className="sticky top-0 z-50 border-b border-white/70 bg-white/72 backdrop-blur-2xl">
                <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
                    <div className="flex items-center gap-4 cursor-pointer" onClick={() => setUnlockedMode(null)}>
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-linear-to-br from-[#9E1B32] to-[#7A1527] text-xl font-bold text-white shadow-lg shadow-red-900/20">
                            AL
                        </div>
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400">Alabama Generative Intelligent Textbook</p>
                            <h1 className="text-xl font-bold tracking-tight text-slate-900">Pathways Workspace</h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 shadow-sm sm:flex">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-sm font-medium text-slate-600">
                                {user?.email ? user.email.charAt(0).toUpperCase() : 'U'}
                            </div>
                            <span className="text-sm font-medium text-slate-600">{user?.email}</span>
                        </div>
                        <button
                            onClick={() => setIsSettingsOpen(true)}
                            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white/80 text-slate-400 transition-all hover:bg-indigo-50 hover:text-indigo-600"
                            title="API Settings"
                        >
                            <Settings className="h-5 w-5" />
                        </button>
                        <button
                            onClick={() => navigate('/analytics')}
                            className="rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-white"
                        >
                            Research Console
                        </button>
                        <button
                            onClick={onLogout}
                            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
                        >
                            Sign Out
                        </button>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-7xl px-6 py-12 lg:px-8">
                {!unlockedMode ? (
                    <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
                        <div>
                            <div className="inline-flex items-center gap-2 rounded-full border border-[#9E1B32]/10 bg-white/85 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.22em] text-[#9E1B32] shadow-sm">
                                <Sparkles className="h-3.5 w-3.5" />
                                Controlled entry point
                            </div>
                            <h2 className="mt-6 max-w-2xl text-5xl font-black tracking-tight text-slate-950 md:text-6xl">
                                Enter the right
                                <span className="block bg-gradient-to-r from-[#9E1B32] via-[#c41e3a] to-[#2563eb] bg-clip-text text-transparent">
                                    learning pathway
                                </span>
                            </h2>
                            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
                                Select the cohort mode, validate access server-side, and launch into adaptive content designed for engineering or education contexts.
                            </p>

                            <div className="mt-8 grid gap-4 sm:grid-cols-3">
                                <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm">
                                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Modes</p>
                                    <p className="mt-2 text-2xl font-bold text-slate-900">2</p>
                                    <p className="mt-1 text-sm text-slate-500">Engineering and education entry surfaces</p>
                                </div>
                                <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm">
                                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Access</p>
                                    <p className="mt-2 text-2xl font-bold text-slate-900">Server</p>
                                    <p className="mt-1 text-sm text-slate-500">Codes validated outside the client bundle</p>
                                </div>
                                <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm">
                                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Outcome</p>
                                    <p className="mt-2 text-2xl font-bold text-slate-900">Adaptive</p>
                                    <p className="mt-1 text-sm text-slate-500">Reading, practice, and support in one flow</p>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-[2.5rem] border border-white/70 bg-white/82 p-8 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur-xl">
                            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#9E1B32]/8 text-[#9E1B32]">
                                <LockKeyhole className="h-7 w-7" />
                            </div>
                            <h3 className="text-2xl font-bold tracking-tight text-slate-900">Module Access</h3>
                            <p className="mt-2 text-sm leading-6 text-slate-500">
                                Select the cohort track and enter the access code provided by your instructor or research lead.
                            </p>

                            <form onSubmit={handleUnlock} className="mt-8 space-y-5">
                                <div>
                                    <label className="mb-2 block text-sm font-bold text-slate-700">Select track</label>
                                    <select
                                        value={selectedMode}
                                        onChange={(event) => setSelectedMode(event.target.value)}
                                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-700 outline-none transition-all focus:border-[#9E1B32] focus:ring-2 focus:ring-[#9E1B32]/10"
                                    >
                                        <option value="engineering">Engineering Mode</option>
                                        <option value="education">Education Module</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-bold text-slate-700">Passcode</label>
                                    <input
                                        type="password"
                                        value={passcode}
                                        onChange={(event) => setPasscode(event.target.value)}
                                        placeholder="Enter access code"
                                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition-all focus:border-[#9E1B32] focus:ring-2 focus:ring-[#9E1B32]/10"
                                    />
                                    <p className="mt-2 text-xs text-slate-400">Access is validated on the server instead of inside the client UI.</p>
                                </div>

                                {error && (
                                    <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                                        {error}
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={unlocking}
                                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-slate-900/15 transition-all hover:-translate-y-0.5 hover:bg-slate-800 disabled:opacity-60"
                                >
                                    {unlocking ? 'Checking access...' : 'Unlock pathway'}
                                    <ArrowRight className="h-4 w-4" />
                                </button>
                            </form>
                        </div>
                    </div>
                ) : (
                    <>
                        <section className="rounded-[2.5rem] border border-white/70 bg-white/76 p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)] backdrop-blur-xl">
                            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                                <div>
                                    <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#9E1B32]">
                                        {unlockedMode === 'engineering' ? 'Engineering workspace' : 'Education workspace'}
                                    </p>
                                    <h2 className="mt-3 text-4xl font-black tracking-tight text-slate-950">
                                        {unlockedMode === 'engineering' ? 'Engineering Pathways' : 'Education Pathways'}
                                    </h2>
                                    <p className="mt-3 max-w-3xl text-[15px] leading-7 text-slate-600">
                                        Choose a pathway to open diagnostics, reading, practice, generation, and learner-model tracking in one connected flow.
                                    </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-3">
                                    <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600">
                                        {visibleCourses.length} available pathways
                                    </div>
                                    <button
                                        onClick={() => {
                                            setUnlockedMode(null)
                                            setPasscode('')
                                        }}
                                        className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                                    >
                                        Change track
                                    </button>
                                </div>
                            </div>
                        </section>

                        {unlockedMode === 'engineering' && (
                            <section
                                onClick={() => navigate('/lab')}
                                className="group relative mt-10 cursor-pointer overflow-hidden rounded-[2.5rem] border border-purple-200/50 bg-white/78 p-8 shadow-[0_24px_60px_rgba(76,29,149,0.12)] transition-all hover:-translate-y-1 hover:shadow-[0_30px_80px_rgba(76,29,149,0.16)]"
                            >
                                <div className="pointer-events-none absolute inset-0 bg-linear-to-r from-purple-50 via-white to-sky-50"></div>
                                <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                                    <div className="max-w-3xl">
                                        <div className="inline-flex items-center gap-2 rounded-full bg-purple-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-purple-700">
                                            Preview lab
                                        </div>
                                        <h3 className="mt-4 text-3xl font-black tracking-tight text-slate-950">Generative Bio-Design Lab</h3>
                                        <p className="mt-3 text-[15px] leading-7 text-slate-600">
                                            Open a studio-like surface for bio-inspired ideation, engineering translation, simulation generation, and concept exploration.
                                        </p>
                                    </div>
                                    <div className="flex h-14 w-14 items-center justify-center rounded-full border border-purple-200 bg-white text-purple-600 shadow-sm transition-transform group-hover:translate-x-1">
                                        <ArrowRight className="h-6 w-6" />
                                    </div>
                                </div>
                            </section>
                        )}

                        <section className="mt-10 grid gap-8 lg:grid-cols-2">
                            {visibleCourses.map((course) => (
                                <button
                                    key={course.id}
                                    type="button"
                                    onClick={() => handleCourseSelect(course.id)}
                                    className="group overflow-hidden rounded-[2.5rem] border border-white/70 bg-white/82 text-left shadow-[0_20px_60px_rgba(15,23,42,0.06)] transition-all hover:-translate-y-1 hover:shadow-[0_28px_70px_rgba(15,23,42,0.1)]"
                                >
                                    <div className={`relative overflow-hidden bg-linear-to-br ${course.gradient} p-8`}>
                                        <div className="absolute right-[-10%] top-[-20%] h-40 w-40 rounded-full bg-white/18 blur-3xl"></div>
                                        <div className="relative z-10 flex items-start justify-between gap-5">
                                            <div>
                                                <div className="mb-5 drop-shadow-md">{course.icon}</div>
                                                <h3 className="text-2xl font-bold tracking-tight text-white">{course.title}</h3>
                                                <div className="mt-3 flex flex-wrap gap-2">
                                                    <span className="rounded-full border border-white/15 bg-white/18 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-white">
                                                        {course.level}
                                                    </span>
                                                    {course.badge && (
                                                        <span className="rounded-full border border-white/15 bg-black/20 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-white">
                                                            {course.badge}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="rounded-2xl border border-white/15 bg-black/15 px-4 py-3 text-right text-sm font-medium text-white/95">
                                                <p>{course.chapters} chapters</p>
                                                <p className="mt-1">{course.sections} sections</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-8">
                                        <p className="text-[15px] leading-7 text-slate-600">{course.description}</p>

                                        <div className="mt-6 flex flex-wrap gap-2">
                                            {course.topics.map((topic) => (
                                                <span
                                                    key={topic}
                                                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700"
                                                >
                                                    {topic}
                                                </span>
                                            ))}
                                        </div>

                                        <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-5">
                                            <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                                                <BookOpen className="h-4 w-4" />
                                                <span>{course.duration}</span>
                                            </div>
                                            <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#9E1B32] transition-transform group-hover:translate-x-1">
                                                Start pathway
                                                <ArrowRight className="h-4 w-4" />
                                            </span>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </section>

                        <section className="mt-10 rounded-[2.5rem] border border-white/70 bg-white/76 p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)] backdrop-blur-xl">
                            <div className="max-w-2xl">
                                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#9E1B32]">Platform capabilities</p>
                                <h3 className="mt-3 text-2xl font-black tracking-tight text-slate-950">What becomes available inside each pathway</h3>
                            </div>
                            <div className="mt-8 grid gap-6 md:grid-cols-3">
                                {capabilityCards.map((card) => (
                                    <div key={card.title} className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
                                        <h4 className="text-lg font-bold tracking-tight text-slate-900">{card.title}</h4>
                                        <p className="mt-3 text-sm leading-7 text-slate-600">{card.description}</p>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </>
                )}
            </main>

            <footer className="mt-auto border-t border-slate-200/70 bg-white/80">
                <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-8 text-sm font-medium text-slate-500 lg:flex-row lg:items-center lg:justify-between lg:px-8">
                    <span>University of Alabama · College of Engineering and Education</span>
                    <span>Alabama Generative Intelligent Textbook pathways for adaptive reading, generative learning, and learner-model visibility</span>
                </div>
            </footer>
        </div>
    )
}
