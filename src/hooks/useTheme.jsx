import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const ThemeContext = createContext(null)

export function ThemeProvider({ userId, children }) {
  const [theme, setThemeState] = useState(() => {
    return localStorage.getItem('fitpack_theme') || 'dark'
  })

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t)
    localStorage.setItem('fitpack_theme', t)
  }

  const toggleTheme = useCallback(async () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setThemeState(next)
    applyTheme(next)
    if (userId) {
      await supabase.from('users').update({ theme: next }).eq('id', userId)
    }
  }, [theme, userId])

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
