import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { initSession, endSession } from './lib/loggingService'
import LandingPage from './pages/LandingPage'
import MainApp from './pages/MainApp'
import BookLayout from './pages/BookLayout'
import DiagnosticAssessment from './pages/DiagnosticAssessment'
import GenerativeLab from './pages/GenerativeLab'
import GlobalClickLogger from './components/GlobalClickLogger'
import './index.css'

export default function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)

      // Initialize logging session when user is authenticated
      if (session?.user) {
        initSession(session.user)
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const newUser = session?.user ?? null

      // Initialize or end logging session based on auth state
      if (newUser && !user) {
        initSession(newUser)
      } else if (!newUser && user) {
        endSession()
      }

      setUser(newUser)
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
      <GlobalClickLogger>
        <Routes>
          <Route
            path="/"
            element={
              user ? (
                <Navigate to="/learn" replace />
              ) : (
                <LandingPage onLogin={handleLogin} />
              )
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
          {/* Diagnostic Assessment Route */}
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
          {/* Book Layout Routes */}
          <Route
            path="/book/:course"
            element={
              user ? (
                <BookLayout user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          <Route
            path="/book/:course/:chapter/:section"
            element={
              user ? (
                <BookLayout user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          {/* Generative Lab Route */}
          <Route
            path="/lab"
            element={
              user ? (
                <GenerativeLab />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
        </Routes>
      </GlobalClickLogger>
    </BrowserRouter>
  )
}
