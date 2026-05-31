import { Suspense, lazy, useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { initSession, endSession } from './lib/loggingService'
import { replayPendingResearchPersists, clearResearchCaches } from './lib/researchService'
import { clearLocalLearnerCaches } from './lib/knowledgeService'
import { clearStreak } from './lib/streak'
import { safeSessionStorageGet, safeLocalStorageGet, safeLocalStorageRemove } from './lib/browserStorage'
import { DEMO_SESSION_KEY } from './lib/demoSession'
import { ToastProvider } from './lib/toast.jsx'
import { ThemeProvider } from './lib/theme.jsx'
import GlobalClickLogger from './components/GlobalClickLogger'
import AppErrorBoundary from './components/AppErrorBoundary'
import GlobalSearch from './components/GlobalSearch'
import { LLM_API_BASE } from './lib/apiConfig'
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

// Restore a persisted demo session (set by AuthModal's "Continue in Demo Mode")
// so the hosted demo survives reloads and direct section URLs.
function readDemoUser() {
  try {
    const raw = safeLocalStorageGet(DEMO_SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function RouteFallback() {
  return (
    <div className="editorial-shell flex min-h-screen items-center justify-center px-4">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--ath-line)] bg-[var(--ath-primary)] text-[var(--ath-background)] shadow-lg">
          <span className="animate-pulse text-2xl font-bold">AL</span>
        </div>
        <p className="editorial-kicker">Preparing workspace</p>
        <p className="mt-2 text-[var(--ath-muted)]">Loading Alabama Generative Intelligent Textbook...</p>
      </div>
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState(() => E2E_USER || readDemoUser())
  const [loading, setLoading] = useState(() => !(E2E_USER || readDemoUser()))

  useEffect(() => {
    // Fire-and-forget Worker readiness ping. In the Cloudflare deployment this
    // is a cheap no-op; local/dev variants can still use it to warm an optional
    // backend escape hatch.
    fetch(`${LLM_API_BASE}/warmup`, { method: 'GET' }).catch(() => {})

    if (E2E_USER) {
      return undefined
    }

    // Persisted demo session: stay signed in as the demo user without Supabase,
    // and do NOT let getSession() overwrite it with null. (loading is already
    // initialized false when a demo session exists, so no setState needed here.)
    if (readDemoUser()) {
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
    // Clear any demo session so a real login isn't silently reverted to the
    // demo identity on reload (readDemoUser would otherwise win and mask it,
    // misattributing all subsequent writes to the demo user id).
    safeLocalStorageRemove(DEMO_SESSION_KEY)
    // Wipe the previous identity's unscoped local caches (mastery, adaptive
    // signals, research model/streak) so a new user on a shared browser can't
    // inherit them; they rebuild from the cloud.
    clearLocalLearnerCaches()
    clearResearchCaches()
    clearStreak()
    setUser(user)
    initSession(user)
  }

  const handleLogout = async () => {
    await endSession()
    safeLocalStorageRemove(DEMO_SESSION_KEY)
    clearLocalLearnerCaches()
    clearResearchCaches()
    clearStreak()
    await supabase.auth.signOut()
    setUser(null)
  }

  if (loading) {
    return (
      <div className="editorial-shell flex min-h-screen items-center justify-center">
        <div className="text-xl font-semibold text-[var(--ath-text)]">Loading...</div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <ThemeProvider>
        <ToastProvider>
          <AppErrorBoundary>
            <GlobalClickLogger>
              <GlobalSearch />
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
