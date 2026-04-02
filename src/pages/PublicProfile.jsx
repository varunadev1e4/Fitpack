import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getLevelInfo, getXPProgress, displayStreak, weekProgress, calcConsistency, getAvatarDisplay } from '../lib/game'
import CalendarHeatmap from '../components/CalendarHeatmap'

export default function PublicProfile() {
  const { username } = useParams()
  const navigate = useNavigate()
  const [profile, setProfile]   = useState(null)
  const [streak, setStreak]     = useState(null)
  const [badges, setBadges]     = useState([])
  const [checkIns, setCheckIns] = useState([])
  const [loading, setLoading]   = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: u } = await supabase
        .from('users').select('id, username, xp, avatar_color, avatar_style, team_id')
        .ilike('username', username).single()

      if (!u) { setNotFound(true); setLoading(false); return }
      setProfile(u)

      const [{ data: s }, { data: ub }, { data: cis }] = await Promise.all([
        supabase.from('streaks').select('*').eq('user_id', u.id).single(),
        supabase.from('user_badges').select('*, badges(*)').eq('user_id', u.id),
        supabase.from('check_ins').select('*').eq('user_id', u.id).order('date', { ascending: false }).limit(90),
      ])

      setStreak(s)
      setBadges((ub ?? []).map(b => b.badges).filter(Boolean))
      setCheckIns(cis ?? [])
      setLoading(false)
    }
    load()
  }, [username])

  if (loading) return <div className="page"><div className="spinner" /></div>
  if (notFound) return (
    <div className="page">
      <div className="empty">
        <div className="icon">🤷</div>
        <p>User "{username}" not found.</p>
        <button className="btn btn-ghost btn-sm" style={{ marginTop: 16, width: 'auto' }} onClick={() => navigate(-1)}>← Back</button>
      </div>
    </div>
  )

  const xp    = profile.xp ?? 0
  const lvl   = getLevelInfo(xp)
  const av    = getAvatarDisplay(profile)
  const consistency = calcConsistency(checkIns, 30)

  return (
    <div className="page">
      <button onClick={() => navigate(-1)} style={{ color: 'var(--text-dim)', fontSize: '.85rem', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
        ← Back
      </button>

      {/* Hero */}
      <div className="card accent-border fade-up" style={{ textAlign: 'center', padding: '28px 20px', marginBottom: 14 }}>
        <div className="avatar" style={{ width: 72, height: 72, fontSize: av.type === 'emoji' ? '2.5rem' : '2rem', background: profile.avatar_color ?? '#00FF87', margin: '0 auto 12px' }}>
          {av.value}
        </div>
        <h2 style={{ fontFamily: 'var(--font-d)', fontSize: '2rem', fontWeight: 900 }}>{profile.username}</h2>
        <div style={{ margin: '8px 0' }}>
          <span className="pill pill-accent">{lvl.emoji} LVL {lvl.level} · {lvl.name}</span>
        </div>
        <div style={{ fontFamily: 'var(--font-d)', fontSize: '1.6rem', fontWeight: 900, color: 'var(--accent)', marginBottom: 10 }}>
          {xp.toLocaleString()} XP
        </div>
        <div className="xp-track" style={{ height: 8 }}>
          <div className="xp-fill" style={{ width: `${getXPProgress(xp)}%` }} />
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        {[
          { val: displayStreak(streak), label: '🔥 Week streak', color: 'var(--fire)' },
          { val: streak?.longest_streak ?? 0, label: '🏅 Best', color: 'var(--gold)' },
          { val: `${consistency}%`, label: '📊 Consistency', color: 'var(--accent)' },
        ].map(s => (
          <div key={s.label} className="card" style={{ flex: 1, textAlign: 'center', padding: '14px 8px' }}>
            <div style={{ fontFamily: 'var(--font-d)', fontSize: '1.6rem', fontWeight: 900, color: s.color }}>{s.val}</div>
            <div style={{ color: 'var(--text-dim)', fontSize: '.65rem', textTransform: 'uppercase', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Heatmap */}
      <div className="card" style={{ marginBottom: 14 }}>
        <h3 style={{ fontFamily: 'var(--font-d)', fontWeight: 800, fontSize: '1rem', textTransform: 'uppercase', marginBottom: 14 }}>Activity</h3>
        <CalendarHeatmap checkIns={checkIns} />
      </div>

      {/* Badges */}
      {badges.length > 0 && (
        <div className="card fade-up">
          <h3 style={{ fontFamily: 'var(--font-d)', fontWeight: 800, fontSize: '1rem', textTransform: 'uppercase', marginBottom: 14 }}>
            Badges ({badges.length})
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {badges.map(b => (
              <div key={b.id} title={b.description} style={{ textAlign: 'center', width: 56 }}>
                <div style={{ fontSize: '2rem' }}>{b.icon}</div>
                <div style={{ fontSize: '.6rem', color: 'var(--text-dim)', marginTop: 2, lineHeight: 1.2 }}>{b.name}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
