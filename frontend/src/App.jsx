import { Suspense, lazy, useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { initSession, endSession } from './lib/loggingService'
import { replayPendingResearchPersists } from './lib/researchService'
import { safeSessionStorageGet } from './lib/browserStorage'
import { ToastProvider } from './lib/toast.jsx'
import { ThemeProvider } from './lib/theme.jsx'
import GlobalClickLogger from './components/GlobalClickLogger'
import AppErrorBoundary from './components/AppErrorBoundary'
import API_BASE from './lib/apiConfig'
import './index.css'

const LandingPage = lazy(() => import('./pages/LandingPage'))
const MainApp = lazy(() => import('./pages/MainApp'))
const BookLayout = lazy(() => import('./pages/BookLayout'))
const DiagnosticAssessment = lazy(() => import('./pages/DiagnosticAssessment'))
const GenerativeLab = lazy(() => import('./pages/GenerativeLab'))
const AnalyticsDashboard = lazy(() => import('./pages/AnalyticsDashboard'))
const StudentDashboard = lazy(() => import('./pages/StudentDashboard'))
const InstructorDashboard = lazy(() => import('./pages/InstructorDashboard'))

const E2E_USER = import.meta.env.VITE_E2E_AUTH_BYPASS === 'true'
  ? { id: 'e2e-user', email: 'e2e@alget.test' }
  : null

function RouteFallback() {
  return (
    <div className="min-h-screen bg-linear-to-b from-slate-50 to-slate-100/50 flex items-center justify-center px-4">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-[#9E1B32] shadow-lg shadow-red-900/10 ring-1 ring-slate-200">
          <span className="animate-pulse text-2xl font-bold">AL</span>
        </div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Preparing workspace</p>
        <p className="mt-2 text-slate-600">Loading Alabama Generative Intelligent Textbook...</p>
      </div>
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState(E2E_USER)
  const [loading, setLoading] = useState(!E2E_USER)

  useEffect(() => {
    // Wake up backend immediately (Render free tier sleeps after inactivity)
    fetch(`${API_BASE}/book/inst-design/toc`, { method: 'GET' }).catch(() => {})

    if (E2E_USER) {
      return undefined
    }

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)

      // Initialize logging session when user is authenticated
      if (session?.user) {
        initSession(session.user).then(() => {
          replayPendingResearchPersists().catch(() => {})
        })
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const newUser = session?.user ?? null

      setUser((previousUser) => {
        if (newUser && !previousUser) {
          initSession(newUser)
        } else if (!newUser && previousUser) {
          endSession()
        }

        return newUser
      })
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleLogin = (user) => {
    setUser(user)
    initSession(user)
  }

  const handleLogout = async () => {
    await endSession()
    await supabase.auth.signOut()
    setUser(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <ThemeProvider>
        <ToastProvider>
          <AppErrorBoundary>
            <GlobalClickLogger>
              <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route
                path="/"
                element={
                  <LandingPage onLogin={handleLogin} user={user} onLogout={handleLogout} />
                }
              />
              <Route
                path="/learn"
                element={
                  user ? (
                    <MainApp user={user} onLogout={handleLogout} />
                  ) : (
                    <Navigate to="/" replace />
                  )
                }
              />
              <Route
                path="/diagnostic/:course"
                element={
                  user ? (
                    <DiagnosticAssessment />
                  ) : (
                    <Navigate to="/" replace />
                  )
                }
              />
              <Route
                path="/book/:course"
                element={
                  user ? (
                    <BookLayout key={user?.id || 'guest-book'} user={user} onLogout={handleLogout} />
                  ) : (
                    <Navigate to="/" replace />
                  )
                }
              />
              <Route
                path="/book/:course/:chapter/:section"
                element={
                  user ? (
                    <BookLayout key={user?.id || 'guest-book'} user={user} onLogout={handleLogout} />
                  ) : (
                    <Navigate to="/" replace />
                  )
                }
              />
              <Route
                path="/lab"
                element={
                  user ? (
                    safeSessionStorageGet('alget_researcher_access') === 'granted' ? (
                      <GenerativeLab />
                    ) : (
                      // Generative Lab spawns new MDX modules via CurriculumAgent
                      // without the engineering_text_fidelity_rubric review pass.
                      // Gating behind researcher access until a content-provenance
                      // review workflow exists. Researchers unlock via /analytics.
                      <Navigate to="/analytics?return=lab" replace />
                    )
                  ) : (
                    <Navigate to="/" replace />
                  )
                }
              />
              <Route
                path="/dashboard"
                element={
                  user ? (
                    <StudentDashboard user={user} />
                  ) : (
                    <Navigate to="/" replace />
                  )
                }
              />
              <Route
                path="/instructor"
                element={
                  user ? (
                    safeSessionStorageGet('alget_instructor_access') === 'granted' ||
                    safeSessionStorageGet('alget_researcher_access') === 'granted' ? (
                      <InstructorDashboard user={user} />
                    ) : (
                      <Navigate to="/analytics?return=instructor" replace />
                    )
                  ) : (
                    <Navigate to="/" replace />
                  )
                }
              />
              <Route
                path="/analytics"
                element={<AnalyticsDashboard user={user} />}
              />
            </Routes>
              </Suspense>
            </GlobalClickLogger>
          </AppErrorBoundary>
        </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
