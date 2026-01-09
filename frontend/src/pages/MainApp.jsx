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
      title: 'Statics',
      icon: '⚖️',
      description: 'Study of forces on bodies at rest. Master equilibrium analysis, free body diagrams, and structural systems.',
      topics: ['Equilibrium', 'Force Systems', 'Trusses', 'Friction'],
      chapters: 3,
      sections: 10,
      duration: '7 hours',
      level: 'Foundational',
      gradient: 'from-slate-700 to-slate-900'
    },
    {
      id: 'dynamics',
      title: 'Dynamics',
      icon: '🚀',
      description: 'Study of bodies in motion. Analyze kinematics, kinetics, and rigid body dynamics with energy methods.',
      topics: ['Kinematics', 'Newton\'s Laws', 'Work-Energy', 'Momentum'],
      chapters: 3,
      sections: 9,
      duration: '7.5 hours',
      level: 'Intermediate',
      gradient: 'from-indigo-600 to-indigo-900'
    }
  ]

  const handleCourseSelect = (courseId) => {
    navigate(`/diagnostic/${courseId}`)
  }

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#9E1B32] rounded-lg flex items-center justify-center">
                <span className="text-white text-lg font-bold">UA</span>
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">Intelligent Textbook</h1>
                <p className="text-xs text-gray-500">Mechanical Engineering</p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <span className="text-sm text-gray-600">{user?.email}</span>
              <button
                onClick={onLogout}
                className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-8 py-12">
        {/* Hero Section */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Course Library
          </h2>
          <p className="text-gray-600 text-lg">
            Select a course to access structured content with AI-powered learning assistance.
          </p>
        </div>

        {/* Course Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
          {courses.map((course) => (
            <div
              key={course.id}
              onClick={() => handleCourseSelect(course.id)}
              className="group bg-white rounded-xl border border-gray-200 overflow-hidden hover:border-gray-300 hover:shadow-lg transition-all duration-200 cursor-pointer"
            >
              {/* Course Header */}
              <div className={`bg-gradient-to-br ${course.gradient} p-8`}>
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-4xl mb-4 block">{course.icon}</span>
                    <h3 className="text-2xl font-bold text-white mb-1">{course.title}</h3>
                    <span className="inline-block px-2.5 py-0.5 bg-white/20 rounded text-white/90 text-xs font-medium">
                      {course.level}
                    </span>
                  </div>
                  <div className="text-right text-white/80 text-sm">
                    <div>{course.chapters} Chapters</div>
                    <div>{course.sections} Sections</div>
                  </div>
                </div>
              </div>

              {/* Course Body */}
              <div className="p-6">
                <p className="text-gray-600 mb-6 leading-relaxed">
                  {course.description}
                </p>

                {/* Topics */}
                <div className="flex flex-wrap gap-2 mb-6">
                  {course.topics.map((topic) => (
                    <span
                      key={topic}
                      className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full"
                    >
                      {topic}
                    </span>
                  ))}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{course.duration}</span>
                  </div>
                  <span className="text-[#9E1B32] font-medium text-sm group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                    Start Course
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Features Section */}
        <div className="bg-white rounded-xl border border-gray-200 p-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Platform Features</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex gap-4">
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-1">Structured Content</h4>
                <p className="text-sm text-gray-600">Research-backed curriculum with clear learning objectives and worked examples.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-1">AI Learning Assistant</h4>
                <p className="text-sm text-gray-600">Get personalized help when you're stuck with Socratic-style guidance.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-1">Practice Problems</h4>
                <p className="text-sm text-gray-600">Auto-graded exercises with step-by-step feedback and mastery tracking.</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white mt-12">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex justify-between items-center text-sm text-gray-500">
            <span>University of Alabama • College of Engineering</span>
            <span>Powered by Google Gemini</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
