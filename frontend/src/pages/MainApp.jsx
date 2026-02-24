import { useNavigate } from 'react-router-dom'
import '../index.css'

// ============================================================================
// MAIN APP COMPONENT - Course Dashboard
// ============================================================================
export default function MainApp({ user, onLogout }) {
  const navigate = useNavigate()

  const courses = [
    {
      id: 'statics',
      title: 'ME 121: Engineering Statics',
      icon: '⚙️',
      description: 'Foundational U of Alabama curriculum. Study forces on bodies at rest, equilibrium analysis, and structural systems like trusses and frames.',
      topics: ['Equilibrium', 'Force Systems', 'Trusses', 'Friction'],
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
      icon: '🌿',
      description: 'Specialized modular sequence. Learn how nature engineers solutions through deep-ocean sponges, mangroves, and gecko adhesion.',
      topics: ['Biomimicry', 'Natural Trusses', 'Filtration', 'Adhesion'],
      chapters: 3,
      sections: 12,
      duration: 'Self-Paced',
      level: 'Specialized Track',
      gradient: 'from-[#4A148C] to-[#004D40]',
      badge: 'Premium'
    }
  ]

  const handleCourseSelect = (courseId) => {
    navigate(`/diagnostic/${courseId}`)
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-slate-50 to-slate-100/50 font-sans selection:bg-[#9E1B32]/20">
      {/* Premium Header */}
      <header className="bg-white/70 backdrop-blur-2xl border-b border-white/60 shadow-[0_4px_30px_rgb(0,0,0,0.03)] sticky top-0 z-50 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4 group cursor-pointer">
              <div className="w-11 h-11 bg-linear-to-br from-[#9E1B32] to-[#7A1527] rounded-xl flex items-center justify-center shadow-lg shadow-red-900/20">
                <span className="text-white text-xl font-extrabold tracking-tight">AL</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">ALGET</h1>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mt-0.5">Intelligent Platform</p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="hidden sm:flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-medium text-sm">
                  {user?.email ? user.email.charAt(0).toUpperCase() : 'U'}
                </div>
                <span className="text-sm font-medium text-slate-600">{user?.email}</span>
              </div>
              <button
                onClick={onLogout}
                className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="mb-10 text-center lg:text-left">
          <h2 className="text-4xl font-extrabold text-slate-900 mb-3 tracking-tight">
            Learning Pathways
          </h2>
          <p className="text-slate-600 text-lg max-w-2xl font-medium">
            Select a module to access structured, AI-guided engineering content.
          </p>
        </div>

        {/* Generative Lab CTA - Glassmorphism */}
        <div
          onClick={() => navigate('/lab')}
          className="mb-16 relative overflow-hidden glass-panel p-8 lg:p-10 flex flex-col md:flex-row items-center justify-between cursor-pointer group hover:-translate-y-1 hover:shadow-2xl hover:shadow-purple-900/10 border-purple-100/50 transition-all duration-500 ease-out"
        >
          {/* Subtle background gradient */}
          <div className="absolute inset-0 bg-linear-to-r from-purple-50/50 via-white to-blue-50/50 pointer-events-none"></div>

          <div className="relative z-10 w-full mb-6 md:mb-0">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center text-2xl shadow-sm border border-purple-200">
                🔬
              </div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Generative Bio-Design Lab</h2>
              <span className="bg-linear-to-r from-purple-600 to-indigo-600 text-white text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-widest shadow-sm">Preview</span>
            </div>
            <p className="text-slate-600 text-lg max-w-2xl font-medium leading-relaxed">
              Explore bio-inspired engineering designs, brainstorm with AI, and generate interactive physical simulations in real-time.
            </p>
          </div>
          <div className="relative z-10 hidden md:flex items-center justify-center w-14 h-14 bg-white border border-slate-200 shadow-sm group-hover:bg-purple-50 group-hover:border-purple-200 rounded-full text-slate-400 group-hover:text-purple-600 transition-all duration-300">
            <svg className="w-6 h-6 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>

        {/* Course Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
          {courses.map((course) => (
            <div
              key={course.id}
              onClick={() => handleCourseSelect(course.id)}
              className="group bg-white rounded-2xl border border-slate-200 overflow-hidden hover:border-slate-300 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300 cursor-pointer flex flex-col"
            >
              {/* Course Header */}
              <div className={`bg-linear-to-br ${course.gradient} p-8 relative overflow-hidden`}>
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl pointer-events-none"></div>
                <div className="flex items-start justify-between relative z-10">
                  <div>
                    <span className="text-4xl mb-5 block drop-shadow-md">{course.icon}</span>
                    <h3 className="text-2xl font-bold text-white mb-2 tracking-tight">{course.title}</h3>
                    <div className="flex gap-2 items-center flex-wrap">
                      <span className="inline-block px-3 py-1 bg-white/20 backdrop-blur-md rounded-lg text-white font-semibold text-xs uppercase tracking-wider border border-white/10 shadow-sm">
                        {course.level}
                      </span>
                      {course.badge && (
                        <span className="inline-block px-3 py-1 bg-teal-500/80 backdrop-blur-md rounded-lg text-white font-bold text-xs uppercase tracking-wider border border-teal-300/30 shadow-sm">
                          {course.badge}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right text-white/95 font-medium text-sm space-y-1.5 bg-black/20 backdrop-blur-md px-4 py-3.5 rounded-xl border border-white/20 shadow-inner">
                    <div className="flex items-center gap-2 justify-end">
                      <svg className="w-4.5 h-4.5 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                      {course.chapters} Chapters
                    </div>
                    <div className="flex items-center gap-2 justify-end">
                      <svg className="w-4.5 h-4.5 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                      {course.sections} Sections
                    </div>
                  </div>
                </div>
              </div>

              {/* Course Body bg */}
              <div className="p-8 flex-1 flex flex-col justify-between">
                <div>
                  <p className="text-slate-600 mb-6 leading-relaxed text-[1.05rem]">
                    {course.description}
                  </p>

                  {/* Topics Tags */}
                  <div className="flex flex-wrap gap-2 mb-8">
                    {course.topics.map((topic) => (
                      <span
                        key={topic}
                        className="px-3.5 py-1.5 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg border border-slate-200/60"
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Footer section of Card */}
                <div className="flex items-center justify-between pt-5 border-t border-slate-100">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                    <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{course.duration}</span>
                  </div>
                  <span className="text-[#9E1B32] font-semibold group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                    Start Pathway
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Features Section */}
        <div className="glass-panel p-8 lg:p-10 mb-8 border-slate-200">
          <h3 className="text-xl font-bold text-slate-900 mb-8 tracking-tight">Platform Capabilities</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            <div className="flex flex-col gap-4">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0 border border-blue-100 shadow-sm">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div>
                <h4 className="font-bold text-slate-800 mb-2">Structured Pedagogy</h4>
                <p className="text-slate-600 leading-relaxed font-medium">Research-backed curriculum mapping biological solutions to engineering systems.</p>
              </div>
            </div>
            <div className="flex flex-col gap-4">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0 border border-emerald-100 shadow-sm">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div>
                <h4 className="font-bold text-slate-800 mb-2">Socratic Diagnostics</h4>
                <p className="text-slate-600 leading-relaxed font-medium">Advanced AI agents orchestrate guided hints instead of giving direct answers.</p>
              </div>
            </div>
            <div className="flex flex-col gap-4">
              <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center shrink-0 border border-purple-100 shadow-sm">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h4 className="font-bold text-slate-800 mb-2">Multi-Agent Verification</h4>
                <p className="text-slate-600 leading-relaxed font-medium">Complex workflows evaluate edge cases with 'Janine Benyus' persona analysis.</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-auto">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center text-sm font-medium text-slate-500 gap-4">
            <span className="flex items-center gap-2">
              <span className="text-red-700">UA</span> College of Engineering & Education
            </span>
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Orchestrator ALGET Online
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}
