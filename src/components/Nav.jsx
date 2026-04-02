import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { getMondayISO } from '../lib/game'

const LINKS = [
  { to: '/',        icon: '🏠', label: 'Home'    },
  { to: '/checkin', icon: '✅', label: 'Log'     },
  { to: '/squad',   icon: '👥', label: 'Squad'   },
  { to: '/battles', icon: '⚔️',  label: 'Battles' },
  { to: '/me',      icon: '👤', label: 'Me'      },
]

export default function Nav() {
  const { user } = useAuth()
  const navigate  = useNavigate()
  const [isCrown, setIsCrown]   = useState(false)
  const [isAdmin, setIsAdmin]   = useState(false)

  useEffect(() => {
    if (!user) return

    // Check if crown holder this week
    const monday = getMondayISO()
    supabase.from('check_ins').select('user_id, xp_earned').gte('date', monday)
      .then(({ data }) => {
        if (!data) return
        const totals = {}
        data.forEach(r => { totals[r.user_id] = (totals[r.user_id] || 0) + r.xp_earned })
        const sorted = Object.entries(totals).sort((a,b) => b[1]-a[1])
        setIsCrown(sorted[0]?.[0] === user.id && sorted.length > 1)
      })

    supabase.from('users').select('is_admin').eq('id', user.id).single()
      .then(({ data }) => setIsAdmin(data?.is_admin ?? false))
  }, [user?.id])

  return (
    <nav style={{
      position:'fixed', bottom:0, left:'50%', transform:'translateX(-50%)',
      width:'100%', maxWidth:430,
      background:'rgba(8,8,14,0.94)',
      borderTop:'1px solid rgba(255,255,255,0.06)',
      backdropFilter:'blur(20px)',
      display:'flex', height:'var(--nav-h)',
      paddingBottom:'env(safe-area-inset-bottom)',
      zIndex:100,
    }}>
      {LINKS.map(({ to, icon, label }) => (
        <NavLink key={to} to={to} end={to==='/'} style={{ flex:1 }}>
          {({ isActive }) => (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', gap:2, position:'relative' }}>
              {isActive && <div style={{ position:'absolute', top:0, left:'50%', transform:'translateX(-50%)', width:28, height:2, background:'var(--accent)', borderRadius:99 }} />}
              <div style={{ position:'relative', lineHeight:1 }}>
                <span style={{ fontSize:'1.35rem' }}>{icon}</span>
                {to==='/' && isCrown && (
                  <span style={{ position:'absolute', top:-6, right:-6, fontSize:'.7rem' }}>👑</span>
                )}
              </div>
              <span style={{ fontSize:'.65rem', fontWeight:600, letterSpacing:'.06em', textTransform:'uppercase', color:isActive?'var(--accent)':'var(--text-muted)', transition:'color .2s' }}>
                {label}
              </span>
            </div>
          )}
        </NavLink>
      ))}
      {isAdmin && (
        <button onClick={() => navigate('/admin')} style={{ flex:0.6, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2, height:'100%' }}>
          <span style={{ fontSize:'1.1rem' }}>⚙️</span>
          <span style={{ fontSize:'.6rem', fontWeight:600, letterSpacing:'.05em', textTransform:'uppercase', color:'var(--text-muted)' }}>Admin</span>
        </button>
      )}
    </nav>
  )
}
