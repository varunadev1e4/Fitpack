import { BrowserRouter, Routes, Route, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { ThemeProvider } from './hooks/useTheme'
import { supabase } from './lib/supabase'
import Nav from './components/Nav'
import Onboarding from './components/Onboarding'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import CheckIn from './pages/CheckIn'
import Squad from './pages/Squad'
import Battles from './pages/Battles'
import Profile from './pages/Profile'
import PublicProfile from './pages/PublicProfile'
import Admin from './pages/Admin'

function Protected({ children }) {
  const { user } = useAuth()
  return user ? children : <Navigate to="/login" replace />
}

function InviteHandler() {
  const [params] = useSearchParams()
  const { user } = useAuth()
  const navigate  = useNavigate()

  useEffect(() => {
    const code = params.get('invite')
    if (code && user) {
      // Mark invite as used
      supabase.from('invite_links')
        .update({ used_by: user.id, used_at: new Date().toISOString() })
        .eq('code', code)
        .is('used_by', null)
        .gt('expires_at', new Date().toISOString())
        .then(() => navigate('/', { replace: true }))
    }
  }, [params, user])

  return null
}

function AppShell() {
  const { user } = useAuth()
  const [showOnboarding, setShowOnboarding] = useState(false)

  useEffect(() => {
    if (!user) return
    // Check if user needs onboarding
    supabase.from('users').select('onboarded').eq('id', user.id).single()
      .then(({ data }) => { if (data && !data.onboarded) setShowOnboarding(true) })
  }, [user])

  return (
    <ThemeProvider userId={user?.id}>
      <div className="app">
        <InviteHandler />
        {user && showOnboarding && (
          <Onboarding userId={user.id} onDone={() => setShowOnboarding(false)} />
        )}
        <Routes>
          <Route path="/login"  element={user ? <Navigate to="/" replace /> : <Login />} />
          <Route path="/"       element={<Protected><Dashboard /></Protected>} />
          <Route path="/checkin" element={<Protected><CheckIn /></Protected>} />
          <Route path="/squad"  element={<Protected><Squad /></Protected>} />
          <Route path="/battles" element={<Protected><Battles /></Protected>} />
          <Route path="/me"     element={<Protected><Profile /></Protected>} />
          <Route path="/u/:username" element={<Protected><PublicProfile /></Protected>} />
          <Route path="/admin"  element={<Protected><Admin /></Protected>} />
          <Route path="*"       element={<Navigate to="/" replace />} />
        </Routes>
        {user && <Nav />}
      </div>
    </ThemeProvider>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  )
}
