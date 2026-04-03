import { createContext, useContext, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { randomAvatarColor } from '../lib/game'

const AuthContext = createContext(null)

async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

const SESSION_KEY = 'fitpack_user_v2'
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(SESSION_KEY))
      if (!raw) return null
      if (raw.expires_at && Date.now() > raw.expires_at) {
        localStorage.removeItem(SESSION_KEY)
        return null
      }
      return raw.user ?? raw
    } catch { return null }
  })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  const login = useCallback(async (username, pin) => {
    setLoading(true); setError(null)
    try {
      const pinHash = await sha256(pin.trim())
      const name    = username.trim().toLowerCase()

      const { data: existing } = await supabase
        .from('users').select('*').ilike('username', name).maybeSingle()

      let userData
      if (existing) {
        if (existing.pin_hash !== pinHash) { setError('Wrong PIN. Try again.'); return false }
        userData = existing
      } else {
        const { data: created, error: e } = await supabase
          .from('users')
          .insert({ username: name, pin_hash: pinHash, avatar_color: randomAvatarColor() })
          .select().single()
        if (e) { setError(e.message); return false }
        await supabase.from('streaks').insert({ user_id: created.id })
        userData = created
      }

      const session = { id: userData.id, username: userData.username, xp: userData.xp, avatar_color: userData.avatar_color, team_id: userData.team_id, team_change_tokens: userData.team_change_tokens ?? 0 }
      localStorage.setItem(SESSION_KEY, JSON.stringify({ user: session, expires_at: Date.now() + SESSION_TTL_MS }))
      setUser(session)
      return true
    } catch (e) { setError(e.message); return false }
    finally { setLoading(false) }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY)
    setUser(null)
  }, [])

  const refreshUser = useCallback(async () => {
    if (!user) return
    const { data } = await supabase.from('users').select('xp, avatar_color, team_id, team_change_tokens').eq('id', user.id).single()
    if (data) {
      const updated = { ...user, ...data }
      localStorage.setItem(SESSION_KEY, JSON.stringify({ user: updated, expires_at: Date.now() + SESSION_TTL_MS }))
      setUser(updated)
    }
  }, [user])

  const changePin = useCallback(async (currentPin, newPin) => {
    if (!user) return { ok: false, error: 'Not logged in' }
    const currentHash = await sha256(currentPin.trim())
    const { data: u } = await supabase.from('users').select('pin_hash').eq('id', user.id).single()
    if (u?.pin_hash !== currentHash) return { ok: false, error: 'Current PIN is wrong.' }
    const newHash = await sha256(newPin.trim())
    const { error: e } = await supabase.from('users').update({ pin_hash: newHash }).eq('id', user.id)
    if (e) return { ok: false, error: e.message }
    return { ok: true }
  }, [user])

  return (
    <AuthContext.Provider value={{ user, loading, error, login, logout, refreshUser, changePin }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() { return useContext(AuthContext) }
