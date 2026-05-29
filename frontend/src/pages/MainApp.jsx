import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    ArrowRight,
    Atom,
    BarChart3,
    BookOpen,
    Bookmark,
    Code2,
    FileSpreadsheet,
    GraduationCap,
    Home,
    LockKeyhole,
    LogOut,
    Scale,
    School,
    Sparkles
} from 'lucide-react'
import { BioInspiredIllustration, StaticsIllustration } from '../components/CourseIllustrations'
import ThemeToggle from '../components/ThemeToggle'
import { useCourseProgress } from '../hooks/useCourseProgress'
import API_BASE from '../lib/apiConfig'
import { getEvaluationStatus } from '../lib/researchService'
import '../index.css'

function CourseMark(props) {
    const IconComponent = props.Icon

    return (
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_12px_30px_rgba(0,0,0,0.18)] backdrop-blur-sm">
            <IconComponent className="h-8 w-8" strokeWidth={1.8} />
        </div>
    )
}

const engineeringCourses = [
    {
        id: 'statics',
        title: 'Engineering Statics',
        icon: <StaticsIllustration />,
        description: 'Core mechanics pathway for equilibrium, free-body diagrams, moments, friction, trusses, centroids, and distributed loads.',
        topics: ['Equilibrium', 'FBDs', 'Moments', 'Trusses'],
        chapters: 6,
        sections: 14,
        duration: '15 weeks',
        level: 'Core Requirement',
        gradient: 'from-[var(--ath-primary-deep)] to-[#0d1115]',
        badge: 'Core'
    },
    {
        id: 'dynamics',
        title: 'ME 201: Engineering Dynamics',
        icon: <CourseMark Icon={Atom} />,
        description: 'Foundational curriculum for motion, force relationships, energy, and momentum with adaptive reading and practice support.',
        topics: ['Kinematics', 'Kinetics', 'Work & Energy', 'Impulse & Momentum'],
        chapters: 10,
        sections: 45,
        duration: '15 weeks',
        level: 'Core Requirement',
        gradient: 'from-[var(--ath-primary-deep)] to-[#0d1115]',
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
        gradient: 'from-[var(--ath-primary-deep)] to-[#0d1115]',
        badge: 'Lab-enabled'
    }
]

const educationCourses = [
    {
        id: 'inst-design',
        title: 'Foundation of Instructional Design',
        icon: <CourseMark Icon={GraduationCap} />,
        description: 'Instructional design theory, pedagogy, assessment, and learner-centered strategy within an adaptive textbook workflow.',
        topics: ['Learning Theories', 'ADDIE', 'Assessment', 'Pedagogy'],
        chapters: 8,
        sections: 32,
        duration: '12 weeks',
        level: 'Core Requirement',
        gradient: 'from-[var(--ath-primary-deep)] to-[#0d1115]',
        badge: 'Research-ready'
    },
    {
        id: 'ai-ethics',
        title: 'AI and Ethics',
        icon: <CourseMark Icon={Scale} />,
        description: 'Responsible AI design and deployment: bias and fairness, transparency, accountability, privacy, governance frameworks, and AI in education.',
        topics: ['Bias & Fairness', 'Accountability', 'Privacy', 'AI in Education'],
        chapters: 6,
        sections: 12,
        duration: '8 weeks',
        level: 'Cross-disciplinary',
        gradient: 'from-[var(--ath-primary-deep)] to-[#0d1115]',
        badge: 'New'
    },
    {
        id: 'ail606-supplement',
        title: 'AIL 606: Software Technology Supplement',
        icon: <CourseMark Icon={Code2} />,
        description: 'Summer 2026 supplemental pathway for multimedia learning, LXD, AI-assisted authoring, usability testing, and capstone prototype defense.',
        topics: ['LXD', 'Multimedia Learning', 'Prototype Testing', 'AI Disclosure'],
        chapters: 8,
        sections: 64,
        duration: '5-week intensive',
        level: 'Graduate Supplement',
        gradient: 'from-[var(--ath-primary-deep)] to-[#0d1115]',
        badge: 'Summer 2026'
    },
    {
        id: 'cat531-supplement',
        title: 'CAT 531: Technology and Teaching Supplement',
        icon: <CourseMark Icon={School} />,
        description: 'Pre-service teacher pathway connecting DTS, TeachGen@i, Ethobot, AI policy reasoning, edtech evaluation, and final professional vision.',
        topics: ['DTS', 'TeachGen@i', 'Ethobot', 'EdTech Evaluation'],
        chapters: 8,
        sections: 64,
        duration: '5-week intensive',
        level: 'Teacher Education',
        gradient: 'from-[var(--ath-primary-deep)] to-[#0d1115]',
        badge: 'Rebuilt'
    },
    {
        id: 'cat100-supplement',
        title: 'CAT 100: Computer Concepts Supplement',
        icon: <CourseMark Icon={FileSpreadsheet} />,
        description: 'Undergraduate support pathway for digital citizenship, AI-assisted resume revision, Excel data stories, presentations, and GitHub Pages portfolios.',
        topics: ['Digital Skills', 'Excel', 'AI Critique', 'GitHub Pages'],
        chapters: 8,
        sections: 64,
        duration: '5-week intensive',
        level: 'Undergraduate',
        gradient: 'from-[var(--ath-primary-deep)] to-[#0d1115]',
        badge: 'Expanded'
    }
]

const capabilityCards = [
    {
        title: 'Adaptive support rail',
        description: 'Explain, reframe, practice, ask.'
    },
    {
        title: 'Cloud-synced progression',
        description: 'Progress follows the learner.'
    },
    {
        title: 'Researcher analytics',
        description: 'Mastery, momentum, and support signals.'
    }
]

function formatPathwayLabel(value) {
    return String(value || '')
        .split('-')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')
}

export default function MainApp({ user, onLogout }) {
    const navigate = useNavigate()
    const { recentSection, bookmarks } = useCourseProgress(user)

    const [unlockedMode, setUnlockedMode] = useState(null)
    const [selectedMode, setSelectedMode] = useState('engineering')
    const [passcode, setPasscode] = useState('')
    const [error, setError] = useState('')
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
    const visibleCourseIds = new Set(visibleCourses.map((course) => course.id))
    const visibleBookmarks = bookmarks.filter((bookmark) => visibleCourseIds.has(bookmark.course)).slice(0, 3)
    const visibleRecentSection = recentSection && visibleCourseIds.has(recentSection.course) ? recentSection : null
    const evaluationPrompts = visibleCourses
        .map((course) => ({ course, status: getEvaluationStatus(course.id) }))
        .filter(({ status }) => status.pending.post || status.pending.retention)

    const goToSavedSection = (entry) => {
        navigate(`/book/${entry.course}/${entry.chapter}/${entry.section}`)
    }

    return (
        <div className="editorial-shell min-h-screen">
            <a href="#main-content" className="skip-to-content-link">Skip to main content</a>

            <header className="sticky top-0 z-50 border-b border-[var(--ath-line)] bg-[rgba(248,246,241,0.84)] backdrop-blur-2xl">
                <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
                    <button
                        type="button"
                        onClick={() => setUnlockedMode(null)}
                        aria-label="Back to pathway selection"
                        className="flex items-center gap-4 rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(15,81,103,0.28)]"
                    >
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[rgba(15,81,103,0.12)] bg-[var(--ath-primary)] text-xl font-bold text-white shadow-[0_16px_32px_rgba(9,56,72,0.18)]">
                            AL
                        </div>
                        <div>
                            <p className="editorial-kicker">ALGET</p>
                            <h1 className="mt-1 text-xl font-semibold tracking-tight text-[var(--ath-primary-deep)]">Learning Pathways</h1>
                        </div>
                    </button>

                    <div className="flex items-center gap-3">
                        <div className="hidden items-center gap-2 rounded-full border border-[var(--ath-line)] bg-[var(--ath-surface-strong)] px-3 py-1.5 shadow-sm sm:flex">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--ath-panel-muted)] text-sm font-medium text-[var(--ath-muted)]">
                                {user?.email ? user.email.charAt(0).toUpperCase() : 'U'}
                            </div>
                            <span className="text-sm font-medium text-[var(--ath-muted)]">{user?.email}</span>
                        </div>
                        <ThemeToggle className="h-10 w-10 rounded-xl" />

                        <button
                            onClick={() => navigate('/dashboard')}
                            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--ath-line)] bg-[var(--ath-surface-strong)] text-[var(--ath-muted)] transition-all hover:bg-[var(--ath-panel)] hover:text-[var(--ath-primary)]"
                            title="Your mastery dashboard"
                            aria-label="Open my dashboard"
                        >
                            <Home className="h-5 w-5" aria-hidden="true" />
                        </button>
                        <button
                            onClick={() => navigate('/analytics')}
                            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--ath-line)] bg-[var(--ath-surface-strong)] text-[var(--ath-muted)] transition-all hover:bg-[var(--ath-panel)] hover:text-[var(--ath-primary)]"
                            title="Research/Instructor console (gated)"
                            aria-label="Open research console"
                        >
                            <BarChart3 className="h-5 w-5" aria-hidden="true" />
                        </button>
                        <button
                            onClick={onLogout}
                            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[color-mix(in_srgb,var(--ath-primary)_36%,transparent)] bg-[var(--ath-primary)] text-[var(--ath-background)] shadow-sm transition-all hover:bg-[var(--ath-primary-deep)]"
                            aria-label="Sign out"
                            title="Sign out"
                        >
                            <LogOut className="h-5 w-5" aria-hidden="true" />
                        </button>
                    </div>
                </div>
            </header>

            <main id="main-content" tabIndex={-1} className="mx-auto max-w-7xl px-6 py-12 lg:px-8">
                {!unlockedMode ? (
                    <div className="mx-auto max-w-md">
                        <div className="editorial-pill mx-auto w-fit">
                            <Sparkles className="h-3.5 w-3.5" />
                            Pathway access
                        </div>
                        <h2 className="mt-6 text-center text-3xl font-semibold tracking-tight text-[var(--ath-text)]">
                            Open your cohort track
                        </h2>
                        <p className="mt-2 text-center text-sm text-[var(--ath-muted)]">
                            Pick a track + enter the code your instructor sent.
                        </p>

                        <form onSubmit={handleUnlock} className="mt-8 space-y-4 rounded-2xl border border-[var(--ath-line)] bg-white/85 p-6 shadow-sm">
                            <div>
                                <label htmlFor="pathway-track" className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--ath-secondary)]">Track</label>
                                <select
                                    id="pathway-track"
                                    value={selectedMode}
                                    onChange={(event) => setSelectedMode(event.target.value)}
                                    className="editorial-input mt-1.5"
                                >
                                    <option value="engineering">Engineering</option>
                                    <option value="education">Education</option>
                                </select>
                            </div>

                            <div>
                                <label htmlFor="pathway-passcode" className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--ath-secondary)]">Access code</label>
                                <input
                                    id="pathway-passcode"
                                    type="password"
                                    value={passcode}
                                    onChange={(event) => setPasscode(event.target.value)}
                                    placeholder="••••••"
                                    className="editorial-input mt-1.5 tracking-[0.2em]"
                                />
                            </div>

                            {error && (
                                <div className="rounded-xl border border-[color-mix(in_srgb,var(--ath-danger)_32%,transparent)] bg-[color-mix(in_srgb,var(--ath-danger)_12%,var(--ath-panel))] px-3 py-2 text-xs font-medium text-[var(--ath-danger)]">
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={unlocking}
                                className="editorial-button w-full px-5 py-3 text-sm disabled:opacity-60"
                            >
                                {unlocking ? 'Checking...' : 'Unlock'}
                                <ArrowRight className="h-4 w-4" />
                            </button>
                        </form>

                        <p className="mt-3 flex items-center justify-center gap-1 text-[10px] text-[var(--ath-secondary)]">
                            <LockKeyhole className="h-3 w-3" />
                            Server-validated / no client-side bypass
                        </p>
                    </div>
                ) : (
                    <>
                        <section className="rounded-2xl border border-[var(--ath-line)] bg-white/85 px-5 py-3 shadow-sm">
                            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[var(--ath-secondary)]">
                                <span className="text-[var(--ath-text)] uppercase tracking-[0.18em]">
                                    {unlockedMode === 'engineering' ? 'Engineering' : 'Education'} pathways
                                </span>
                                <span className="text-[var(--ath-line-strong)]">/</span>
                                <span>{visibleCourses.length} available</span>
                                <button
                                    onClick={() => {
                                        setUnlockedMode(null)
                                        setPasscode('')
                                    }}
                                    className="ml-auto text-xs font-medium text-[var(--ath-muted)] underline-offset-4 hover:text-[var(--ath-text)] hover:underline"
                                >
                                    Change track
                                </button>
                            </div>
                        </section>

                        {unlockedMode === 'engineering' && (
                            <div
                                role="button"
                                tabIndex={0}
                                aria-label="Open the Generative Bio-Design Lab"
                                onClick={() => navigate('/lab')}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault()
                                        navigate('/lab')
                                    }
                                }}
                                className="group relative mt-10 cursor-pointer overflow-hidden rounded-[2.7rem] border border-[rgba(15,81,103,0.12)] bg-[linear-gradient(135deg,_rgba(17,39,49,0.98),_rgba(10,28,36,0.94))] p-8 shadow-[0_24px_60px_rgba(15,23,42,0.14)] transition-all hover:-translate-y-1 hover:shadow-[0_30px_80px_rgba(15,23,42,0.16)]"
                            >
                                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(200,226,236,0.14),_transparent_36%),radial-gradient(circle_at_bottom_left,_rgba(199,137,67,0.12),_transparent_32%)]"></div>
                                <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                                    <div className="max-w-3xl">
                                        <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--ath-primary-soft)]">
                                            Preview lab
                                        </div>
                                        <h3 className="mt-4 text-4xl font-semibold tracking-tight text-white">Generative Bio-Design Lab</h3>
                                        <p className="mt-3 text-[15px] leading-7 text-white/75">
                                            Bio-inspired ideation, engineering translation, simulations, concepts.
                                        </p>
                                    </div>
                                    <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-white/10 text-[var(--ath-primary-soft)] shadow-sm transition-transform group-hover:translate-x-1">
                                        <ArrowRight className="h-6 w-6" />
                                    </div>
                                </div>
                            </div>
                        )}

                        {(visibleRecentSection || visibleBookmarks.length > 0) && (
                            <section className="mt-10 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                                {visibleRecentSection && (
                                    <button
                                        type="button"
                                        onClick={() => goToSavedSection(visibleRecentSection)}
                                        className="editorial-surface group p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(15,23,42,0.08)]"
                                    >
                                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--ath-secondary)]">
                                            <span>Resume</span>
                                            <span className="text-[var(--ath-line-strong)]">/</span>
                                            <span>Last opened</span>
                                        </div>

                                        <div className="mt-3 flex flex-wrap gap-1.5">
                                            <span className="rounded-full bg-[var(--ath-panel)] px-2 py-0.5 text-[10px] font-semibold text-[var(--ath-text)]">{formatPathwayLabel(visibleRecentSection.course)}</span>
                                            <span className="rounded-full bg-[var(--ath-panel)] px-2 py-0.5 text-[10px] font-semibold text-[var(--ath-text)]">{visibleRecentSection.chapter}.{visibleRecentSection.section}</span>
                                            {visibleRecentSection.estimatedTimeMinutes && (
                                                <span className="rounded-full bg-[var(--ath-panel)] px-2 py-0.5 text-[10px] font-semibold text-[var(--ath-text)]">{visibleRecentSection.estimatedTimeMinutes} min</span>
                                            )}
                                        </div>

                                        <div className="mt-4 flex items-center justify-between border-t border-[var(--ath-line)] pt-3">
                                            <div>
                                                <p className="text-sm font-semibold text-[var(--ath-text)]">
                                                    {visibleRecentSection.title || `${formatPathwayLabel(visibleRecentSection.course)} section`}
                                                </p>
                                                <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[var(--ath-secondary)]">
                                                    {visibleRecentSection.chapterTitle || 'Adaptive reading surface'}
                                                </p>
                                            </div>
                                            <span className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--ath-primary)] transition-transform group-hover:translate-x-1">
                                                Resume section
                                                <ArrowRight className="h-4 w-4" />
                                            </span>
                                        </div>
                                    </button>
                                )}

                                {visibleBookmarks.length > 0 && (
                                    <div className="editorial-surface p-8">
                                        <div className="flex items-center justify-between gap-4">
                                            <div>
                                                <p className="editorial-kicker">Saved for later</p>
                                                <h3 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--ath-text)]">
                                                    Bookmarked sections
                                                </h3>
                                            </div>
                                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(15,81,103,0.08)] text-[var(--ath-primary)]">
                                                <Bookmark className="h-5 w-5" />
                                            </div>
                                        </div>

                                        <div className="mt-6 space-y-3">
                                            {visibleBookmarks.map((bookmark) => (
                                                <button
                                                    key={bookmark.sectionId}
                                                    type="button"
                                                    onClick={() => goToSavedSection(bookmark)}
                                                    className="flex w-full items-center justify-between rounded-[1.4rem] border border-[var(--ath-line)] bg-[rgba(255,255,255,0.72)] px-4 py-4 text-left transition-all hover:bg-[var(--ath-panel)]"
                                                >
                                                    <div>
                                                        <p className="text-sm font-semibold text-[var(--ath-text)]">
                                                            {bookmark.title || `${formatPathwayLabel(bookmark.course)} ${bookmark.chapter}.${bookmark.section}`}
                                                        </p>
                                                        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[var(--ath-secondary)]">
                                                            {formatPathwayLabel(bookmark.course)} / {bookmark.chapter}.{bookmark.section}
                                                        </p>
                                                    </div>
                                                    <ArrowRight className="h-4 w-4 text-[var(--ath-primary)]" />
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </section>
                        )}

                        {evaluationPrompts.length > 0 && (
                            <section className="mt-10 editorial-surface p-8">
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <p className="editorial-kicker">Research checkpoints</p>
                                        <h3 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--ath-text)]">
                                            Evaluation prompts ready
                                        </h3>
                                    </div>
                                    <div className="editorial-chip">{evaluationPrompts.length} pending</div>
                                </div>

                                <div className="mt-6 grid gap-4 md:grid-cols-2">
                                    {evaluationPrompts.map(({ course, status }) => {
                                        const nextPhase = status.pending.retention ? 'retention' : 'post'
                                        return (
                                            <button
                                                key={`${course.id}-${nextPhase}`}
                                                type="button"
                                                onClick={() => navigate(`/diagnostic/${course.id}?phase=${nextPhase}`)}
                                                className="rounded-[1.5rem] border border-[var(--ath-line)] bg-[rgba(255,255,255,0.72)] px-5 py-5 text-left transition-all hover:bg-[var(--ath-panel)]"
                                            >
                                                <p className="text-sm font-semibold text-[var(--ath-text)]">
                                                    {course.title}
                                                </p>
                                                <p className="mt-2 text-xs uppercase tracking-[0.18em] text-[var(--ath-secondary)]">
                                                    {nextPhase === 'retention' ? 'Retention probe due' : 'Post-test ready'}
                                                </p>
                                                <p className="mt-3 text-sm leading-6 text-[var(--ath-muted)]">
                                                    {nextPhase === 'retention'
                                                        ? 'Run the delayed probe to measure what held after the learning interval.'
                                                        : 'Capture the immediate learning effect before moving too far from the pathway.'}
                                                </p>
                                            </button>
                                        )
                                    })}
                                </div>
                            </section>
                        )}

                        <section className="mt-10 grid gap-8 lg:grid-cols-2">
                            {visibleCourses.map((course) => (
                                <button
                                    key={course.id}
                                    type="button"
                                    onClick={() => handleCourseSelect(course.id)}
                                    className="group overflow-hidden rounded-[2.7rem] border border-[var(--ath-line)] bg-[rgba(255,255,255,0.82)] text-left shadow-[0_20px_60px_rgba(15,23,42,0.06)] transition-all hover:-translate-y-1 hover:shadow-[0_28px_70px_rgba(15,23,42,0.1)]"
                                >
                                    <div className={`relative overflow-hidden bg-linear-to-br ${course.gradient} p-8`}>
                                        <div className="absolute right-[-10%] top-[-20%] h-40 w-40 rounded-full bg-white/15 blur-3xl"></div>
                                        <div className="relative z-10 flex items-start justify-between gap-5">
                                            <div>
                                                <div className="mb-5 drop-shadow-md">{course.icon}</div>
                                                <h3 className="text-3xl font-semibold tracking-tight text-white">{course.title}</h3>
                                                <div className="mt-3 flex flex-wrap gap-2">
                                                    <span className="rounded-full border border-white/15 bg-white/14 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-white">
                                                        {course.level}
                                                    </span>
                                                    {course.badge && (
                                                        <span className="rounded-full border border-white/15 bg-black/18 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-white">
                                                            {course.badge}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="rounded-[1.3rem] border border-white/15 bg-black/12 px-4 py-3 text-right text-sm font-medium text-white/92">
                                                <p>{course.chapters} chapters</p>
                                                <p className="mt-1">{course.sections} sections</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-8">
                                        <p className="text-[15px] leading-7 text-[var(--ath-muted)]">{course.description}</p>

                                        <div className="mt-6 flex flex-wrap gap-2">
                                            {course.topics.map((topic) => (
                                                <span
                                                    key={topic}
                                                    className="editorial-chip"
                                                >
                                                    {topic}
                                                </span>
                                            ))}
                                        </div>

                                        <div className="mt-8 flex items-center justify-between border-t border-[var(--ath-line)] pt-5">
                                            <div className="flex items-center gap-2 text-sm font-medium text-[var(--ath-muted)]">
                                                <BookOpen className="h-4 w-4" />
                                                <span>{course.duration}</span>
                                            </div>
                                            <span className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--ath-primary)] transition-transform group-hover:translate-x-1">
                                                Start pathway
                                                <ArrowRight className="h-4 w-4" />
                                            </span>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </section>

                        <section className="editorial-surface mt-10 p-8">
                            <div className="max-w-2xl">
                                <p className="editorial-kicker">Platform capabilities</p>
                                <h3 className="editorial-title mt-3 text-3xl">Inside each pathway</h3>
                            </div>
                            <div className="mt-8 grid gap-6 md:grid-cols-3">
                                {capabilityCards.map((card) => (
                                    <div key={card.title} className="rounded-[1.6rem] border border-[var(--ath-line)] bg-[rgba(255,255,255,0.7)] p-6 shadow-sm">
                                        <h4 className="text-xl font-semibold tracking-tight text-[var(--ath-text)]">{card.title}</h4>
                                        <p className="mt-3 text-sm leading-7 text-[var(--ath-muted)]">{card.description}</p>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </>
                )}
            </main>

            <footer className="mt-auto border-t border-[var(--ath-line)] bg-[rgba(255,255,255,0.52)]">
                <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-8 text-sm font-medium text-[var(--ath-muted)] lg:flex-row lg:items-center lg:justify-between lg:px-8">
                    <span>Sponsored by the Office of Sponsored Programs (OSP) at The University of Alabama</span>
                    <span>Adaptive reading, generative learning, learner-model visibility</span>
                </div>
            </footer>
        </div>
    )
}
