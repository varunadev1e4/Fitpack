import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import {
  getLevelInfo, getXPProgress, getXPToNext, displayStreak, weekProgress,
  getMondayISO, getActiveSeason, getAvatarDisplay, MOODS, calcCorrelations
} from '../lib/game'
import ReactionBar from '../components/ReactionBar'
import WeeklySummary from '../components/WeeklySummary'
import SpinWheel from '../components/SpinWheel'

function formatTime(ts) {
  const d = new Date(ts), now = new Date()
  const h = Math.floor((now - d) / 3600000)
  if (h < 1) return 'just now'
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function buildSummary(ci) {
  if (ci.is_rest_day) return '🧘 Rest day'
  const p = []
  if (ci.workout) p.push(`💪 ${ci.workout_type || 'workout'}`)
  if (ci.meals > 0) p.push(`🍽 ${ci.meals}`)
  if (ci.water_glasses > 0) p.push(`💧 ${ci.water_glasses}`)
  if (ci.sleep_hours > 0) p.push(`😴 ${ci.sleep_hours}h`)
  if (ci.no_junk) p.push('🥗')
  return p.join(' · ') || 'Checked in'
}

function WeekDots({ count }) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{
          width: 12, height: 12, borderRadius: '50%',
          background: count >= i ? 'var(--accent)' : 'var(--bg-elevated)',
          border: count >= i ? 'none' : '1px solid var(--text-muted)',
          transition: 'background .3s',
        }} />
      ))}
      <span style={{ fontSize: '.72rem', color: 'var(--text-dim)', marginLeft: 4 }}>
        {count >= 3 ? '✅ Week done!' : `${count}/3 this week`}
      </span>
    </div>
  )
}

function SquadHealthBar({ score }) {
  const color = score >= 70 ? 'var(--accent)' : score >= 40 ? 'var(--gold)' : 'var(--fire)'
  const label = score >= 70 ? 'Healthy 🔥' : score >= 40 ? 'Warming up ⚡' : 'Needs work 💀'
  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontFamily: 'var(--font-d)', fontWeight: 800, fontSize: '1rem' }}>👥 Squad Health</span>
        <span style={{ color, fontWeight: 700, fontSize: '.9rem' }}>{score}% · {label}</span>
      </div>
      <div className="progress-track" style={{ height: 8 }}>
        <div className="progress-fill" style={{ width: `${score}%`, background: color }} />
      </div>
      <p style={{ color: 'var(--text-dim)', fontSize: '.72rem', marginTop: 6 }}>
        % of squad who checked in this week
      </p>
    </div>
  )
}

function SeasonBanner({ season }) {
  return (
    <div className="card fade-up" style={{
      marginBottom: 12,
      background: `linear-gradient(135deg, ${season.color}15, transparent)`,
      borderColor: `${season.color}40`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: '1.8rem' }}>{season.emoji}</span>
        <div>
          <div style={{ fontFamily: 'var(--font-d)', fontSize: '1.1rem', fontWeight: 900, color: season.color }}>
            {season.name}
          </div>
          <div style={{ color: 'var(--text-dim)', fontSize: '.78rem' }}>
            Special event active — earn extra XP and limited badges!
          </div>
        </div>
      </div>
    </div>
  )
}

function SquadMilestones({ milestones }) {
  if (!milestones.length) return null
  return (
    <div className="card" style={{ marginBottom: 12, background: 'linear-gradient(135deg, rgba(245,158,11,.08), transparent)', borderColor: 'rgba(245,158,11,.3)' }}>
      <h3 style={{ fontFamily: 'var(--font-d)', fontWeight: 800, fontSize: '1rem', marginBottom: 10 }}>🏆 Squad Milestones</h3>
      {milestones.map(m => (
        <div key={m.slug} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: '1.5rem' }}>{m.icon}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '.9rem' }}>{m.label}</div>
            <div style={{ color: 'var(--text-dim)', fontSize: '.72rem' }}>
              {m.achieved ? `Achieved ${new Date(m.achieved_at).toLocaleDateString()}` : `${m.progress?.toLocaleString()} / ${m.threshold.toLocaleString()}`}
            </div>
          </div>
          {m.achieved
            ? <span className="pill pill-gold">✓ Done</span>
            : <div className="progress-track" style={{ width: 60, height: 6, margin: 0 }}>
                <div className="progress-fill" style={{ width: `${Math.min((m.progress / m.threshold) * 100, 100)}%`, background: 'var(--gold)' }} />
              </div>
          }
        </div>
      ))}
    </div>
  )
}

function PublicGoals({ goals, userId, onSetGoal }) {
  const [editing, setEditing] = useState(false)
  const [text, setText]       = useState('')
  const [saving, setSaving]   = useState(false)
  const weekId = getMondayISO()
  const myGoal = goals.find(g => g.user_id === userId)

  async function save() {
    setSaving(true)
    await supabase.from('weekly_goals').upsert({ user_id: userId, week_id: weekId, goal: text.trim(), achieved: false }, { onConflict: 'user_id,week_id' })
    setSaving(false)
    setEditing(false)
    onSetGoal()
  }

  async function markAchieved() {
    await supabase.from('weekly_goals').update({ achieved: true }).eq('user_id', userId).eq('week_id', weekId)
    onSetGoal()
  }

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ fontFamily: 'var(--font-d)', fontWeight: 800, fontSize: '1rem' }}>🎯 Public Goals</h3>
        {!myGoal && !editing && <button className="btn btn-ghost btn-xs" onClick={() => setEditing(true)}>+ Set Goal</button>}
      </div>

      {editing && (
        <div style={{ marginBottom: 12 }}>
          <input className="input" placeholder="e.g. Work out 5 times this week" value={text} onChange={e => setText(e.target.value.slice(0, 200))} style={{ marginBottom: 8 }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-xs" onClick={save} disabled={saving || !text.trim()}>Save</button>
            <button className="btn btn-ghost btn-xs" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </div>
      )}

      {goals.length === 0 && !editing ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '.82rem' }}>No goals set yet this week.</p>
      ) : (
        goals.map(g => (
          <div key={g.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
            <div className="avatar" style={{ width: 26, height: 26, fontSize: '.7rem', background: g.users?.avatar_color ?? '#00FF87', flexShrink: 0, marginTop: 2 }}>
              {g.users?.username?.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '.78rem', color: 'var(--text-dim)', marginBottom: 2 }}>{g.users?.username}</div>
              <div style={{ fontSize: '.9rem', textDecoration: g.achieved ? 'line-through' : 'none', color: g.achieved ? 'var(--text-dim)' : 'var(--text)' }}>{g.goal}</div>
            </div>
            {g.user_id === userId && !g.achieved && (
              <button className="btn btn-ghost btn-xs" onClick={markAchieved}>✓ Done</button>
            )}
            {g.achieved && <span className="pill pill-accent">✓</span>}
          </div>
        ))
      )}
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const navigate  = useNavigate()

  const [fullUser, setFullUser]       = useState(null)
  const [streak, setStreak]           = useState(null)
  const [todayCi, setTodayCi]         = useState(null)
  const [yesterdayCi, setYesterdayCi] = useState(null)
  const [feed, setFeed]               = useState([])
  const [reactions, setReactions]     = useState({})
  const [nudge, setNudge]             = useState(null)
  const [crownUser, setCrownUser]     = useState(null)
  const [squadHealth, setSquadHealth] = useState(0)
  const [milestones, setMilestones]   = useState([])
  const [pinnedPost, setPinnedPost]   = useState(null)
  const [weeklyGoals, setWeeklyGoals] = useState([])
  const [correlations, setCorrelations] = useState([])
  const [showSpin, setShowSpin]       = useState(false)
  const [loading, setLoading]         = useState(true)
  const [goalsKey, setGoalsKey]       = useState(0)

  const today     = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  const monday    = getMondayISO()
  const season    = getActiveSeason()

  useEffect(() => {
    load()
  }, [user.id, goalsKey])

  async function load() {
    const [{ data: u }, { data: s }, { data: ci }, { data: ystd }] = await Promise.all([
      supabase.from('users').select('*').eq('id', user.id).single(),
      supabase.from('streaks').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('check_ins').select('*').eq('user_id', user.id).eq('date', today).maybeSingle(),
      supabase.from('check_ins').select('*').eq('user_id', user.id).eq('date', yesterday).maybeSingle(),
    ])
    setFullUser(u); setStreak(s); setTodayCi(ci); setYesterdayCi(ystd)
    const { data: teamUsers } = u?.team_id
      ? await supabase.from('users').select('id, username, avatar_color, avatar_style').eq('team_id', u.team_id)
      : { data: null }
    const teamMemberIds = (teamUsers ?? []).map(tm => tm.id)

    // Feed
    const feedQuery = supabase
      .from('check_ins')
      .select('*, users(id, username, avatar_color, avatar_style), shoutout_users:users!check_ins_shoutout_to_fkey(username)')
      .order('created_at', { ascending: false })
      .limit(20)

    const { data: feedRaw } = teamMemberIds.length
      ? await feedQuery.in('user_id', teamMemberIds)
      : await feedQuery

    if (feedRaw) {
      setFeed(feedRaw)
      const ids = feedRaw.map(c => c.id)
      if (ids.length) {
        const { data: rxns } = await supabase.from('reactions').select('*').in('check_in_id', ids)
        const map = {}
        ;(rxns ?? []).forEach(r => { if (!map[r.check_in_id]) map[r.check_in_id] = []; map[r.check_in_id].push(r) })
        setReactions(map)
      }
    }

    // Weekly XP for nemesis + crown + squad health
    const weekXPQuery = supabase
      .from('check_ins').select('user_id, xp_earned, users(username, avatar_color)').gte('date', monday)
    const { data: weekXP } = teamMemberIds.length
      ? await weekXPQuery.in('user_id', teamMemberIds)
      : await weekXPQuery

    if (weekXP) {
      const totals = {}
      weekXP.forEach(r => { totals[r.user_id] = (totals[r.user_id] || 0) + r.xp_earned })
      const myXP   = totals[user.id] || 0
      const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1])

      // Nemesis
      const above = sorted.filter(([uid, xp]) => uid !== user.id && xp > myXP)[0]
      if (above) {
        const aboveUser = weekXP.find(r => r.user_id === above[0])?.users
        if (aboveUser) setNudge({ username: aboveUser.username, gap: above[1] - myXP })
      }

      // Crown
      if (sorted[0]) {
        const crownUID = sorted[0][0]
        const crownInfo = weekXP.find(r => r.user_id === crownUID)?.users
        if (crownInfo) setCrownUser({ ...crownInfo, uid: crownUID })
      }

      // Squad health = % of team users who checked in this week
      const totalUsers = teamMemberIds.length || 1
      const activeUsers = new Set(weekXP.map(r => r.user_id)).size
      setSquadHealth(Math.round((activeUsers / (totalUsers ?? 1)) * 100))
    }

    // Milestones
    const { data: ms } = await supabase.from('squad_milestones').select('*').order('threshold')
    if (ms) {
      // Compute current squad totals
      const { count: totalCI } = await supabase.from('check_ins').select('id', { count: 'exact' })
      const { count: totalWK } = await supabase.from('check_ins').select('id', { count: 'exact' }).eq('workout', true)
      const { data: xpData }   = await supabase.from('users').select('xp')
      const totalXP = (xpData ?? []).reduce((s, u) => s + (u.xp || 0), 0)

      const metricMap = { checkins: totalCI ?? 0, workouts: totalWK ?? 0, xp: totalXP }
      const enriched  = ms.map(m => ({ ...m, progress: metricMap[m.metric] ?? 0 }))

      // Check & mark achieved
      for (const m of enriched) {
        if (!m.achieved && m.progress >= m.threshold) {
          await supabase.from('squad_milestones').update({ achieved: true, achieved_at: new Date().toISOString() }).eq('id', m.id)
          m.achieved = true; m.achieved_at = new Date().toISOString()
        }
      }
      setMilestones(enriched.slice(0, 4))
    }

    // Pinned post
    const { data: pp } = await supabase.from('squad_posts').select('*, users(username)').eq('pinned', true).order('created_at', { ascending: false }).limit(1).maybeSingle()
    setPinnedPost(pp)

    // Weekly goals
    const { data: goals } = await supabase
      .from('weekly_goals').select('*, users(username, avatar_color)').eq('week_id', monday).order('created_at')
    setWeeklyGoals(goals ?? [])
    const { data: recent } = await supabase.from('check_ins').select('*').eq('user_id', user.id).order('date', { ascending: false }).limit(45)
    setCorrelations(calcCorrelations(recent ?? []).slice(0, 2))

    setLoading(false)
  }

  const xp    = fullUser?.xp ?? 0
  const lvl   = getLevelInfo(xp)
  const av    = getAvatarDisplay(fullUser ?? user)
  const wdots = weekProgress(streak)

  return (
    <div className="page" style={{ background: 'radial-gradient(ellipse 100% 40% at 50% 0%, rgba(0,255,135,.04) 0%, transparent 60%)' }}>

      {/* Header */}
      <div className="fade-up" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <p style={{ color: 'var(--text-dim)', fontSize: '.85rem' }}>Welcome back,</p>
          <h1 style={{ fontFamily: 'var(--font-d)', fontSize: '2rem', fontWeight: 900 }}>
            {fullUser?.username ?? user.username} {lvl.emoji}
          </h1>
        </div>
        <button onClick={() => navigate(`/u/${fullUser?.username ?? user.username}`)}>
          <div className="avatar" style={{ width: 48, height: 48, fontSize: av.type === 'emoji' ? '1.6rem' : '1.3rem', background: fullUser?.avatar_color ?? '#00FF87' }}>
            {av.value}
          </div>
        </button>
      </div>

      {/* Season banner */}
      {season && <SeasonBanner season={season} />}

      {/* Pinned announcement */}
      {pinnedPost && (
        <div className="card fade-up" style={{ marginBottom: 12, borderColor: 'rgba(245,158,11,.3)', background: 'rgba(245,158,11,.05)' }}>
          <div style={{ fontSize: '.7rem', color: 'var(--gold)', fontWeight: 700, marginBottom: 4 }}>📌 PINNED · {pinnedPost.users?.username}</div>
          <p style={{ fontSize: '.9rem' }}>{pinnedPost.content}</p>
        </div>
      )}

      {/* Weekly summary (Mondays only) */}
      <WeeklySummary userId={user.id} username={user.username} />

      {/* Level card */}
      <div className="card accent-border fade-up" style={{ marginBottom: 12, animationDelay: '.05s', opacity: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="pill pill-accent">LVL {lvl.level}</span>
            <span style={{ fontFamily: 'var(--font-d)', fontWeight: 800, fontSize: '1.1rem', textTransform: 'uppercase' }}>
              {lvl.name}
              {crownUser?.uid === user.id && <span style={{ marginLeft: 8 }}>👑</span>}
            </span>
          </div>
          <span style={{ fontFamily: 'var(--font-d)', fontWeight: 800, color: 'var(--accent)', fontSize: '1.2rem' }}>
            {xp.toLocaleString()} XP
          </span>
        </div>
        <div className="xp-track" style={{ marginBottom: 12 }}>
          <div className="xp-fill" style={{ width: `${getXPProgress(xp)}%` }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <WeekDots count={wdots} />
          <span style={{ fontFamily: 'var(--font-d)', fontWeight: 800, color: 'var(--fire)', fontSize: '1rem' }}>
            🔥 {displayStreak(streak)}w
          </span>
        </div>
      </div>

      {/* Crown holder */}
      {crownUser && crownUser.uid !== user.id && (
        <div className="card fade-up" style={{ marginBottom: 12, background: 'rgba(245,158,11,.06)', borderColor: 'rgba(245,158,11,.25)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '1.5rem' }}>👑</span>
            <p style={{ fontSize: '.88rem' }}>
              <strong>{crownUser.username}</strong> is wearing the crown this week.
              {nudge ? ` You're ${nudge.gap} XP behind them.` : ' Can you take it?'}
            </p>
          </div>
        </div>
      )}

      {/* Nemesis nudge */}
      {nudge && crownUser?.uid !== user.id && (
        <div className="card fade-up" style={{ marginBottom: 12, background: 'rgba(255,107,53,.06)', borderColor: 'rgba(255,107,53,.2)' }}>
          <p style={{ fontSize: '.88rem', color: 'var(--fire)' }}>
            😤 <strong>{nudge.username}</strong> is {nudge.gap} XP ahead of you this week. Time to grind!
          </p>
        </div>
      )}

      {/* Squad health */}
      {!loading && <SquadHealthBar score={squadHealth} />}

      {/* Daily spin */}
      <button
        className="btn btn-ghost fade-up"
        style={{ marginBottom: 12, borderColor: 'rgba(139,92,246,.3)', color: 'var(--purple)', animationDelay: '.1s', opacity: 0 }}
        onClick={() => setShowSpin(true)}
      >
        🎰 Daily Spin Challenge
      </button>

      {/* Quick re-log */}
      {!todayCi && yesterdayCi && !loading && (
        <div className="card fade-up" style={{ marginBottom: 12, borderColor: 'rgba(0,255,135,.15)', animationDelay: '.12s', opacity: 0 }}>
          <p style={{ fontSize: '.82rem', color: 'var(--text-dim)', marginBottom: 8 }}>📋 Quick re-log from yesterday?</p>
          <div style={{ fontSize: '.8rem', color: 'var(--text-muted)', marginBottom: 8 }}>{buildSummary(yesterdayCi)}</div>
          <button className="btn btn-ghost btn-sm" style={{ width: 'auto' }} onClick={() => navigate('/checkin', { state: { prefill: yesterdayCi } })}>
            ⚡ Pre-fill today's log
          </button>
        </div>
      )}

      {/* CTA */}
      {!loading && !todayCi && (
        <button className="btn btn-fire fade-up" style={{ marginBottom: 12, animationDelay: '.14s', opacity: 0 }} onClick={() => navigate('/checkin')}>
          🏋️ Log Today's Activity
        </button>
      )}
      {!loading && todayCi && (
        <div className="card fade-up" style={{ marginBottom: 12, background: 'var(--accent-glow)', borderColor: 'rgba(0,255,135,.2)', textAlign: 'center', animationDelay: '.14s', opacity: 0 }}>
          <span style={{ fontFamily: 'var(--font-d)', fontSize: '1.1rem', fontWeight: 800 }}>✅ Today is logged!</span>
          <button className="btn btn-ghost btn-sm" style={{ width: 'auto', marginTop: 8 }} onClick={() => navigate('/checkin')}>Edit</button>
        </div>
      )}

      {/* Squad milestones */}
      {!loading && <SquadMilestones milestones={milestones} />}

      {/* Weekly goals */}
      {!loading && <PublicGoals goals={weeklyGoals} userId={user.id} onSetGoal={() => setGoalsKey(k => k + 1)} />}

      {!!correlations.length && (
        <div className="card" style={{ marginBottom: 12 }}>
          <h3 style={{ fontFamily: 'var(--font-d)', fontWeight: 800, fontSize: '1rem', marginBottom: 10 }}>🔗 Correlations</h3>
          {correlations.map((c, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
              <span>{c.icon}</span>
              <p style={{ color: 'var(--text-dim)', fontSize: '.82rem' }}>{c.insight}</p>
            </div>
          ))}
        </div>
      )}

      {/* Activity feed */}
      {loading ? <div className="spinner" /> : (
        <div className="card fade-up" style={{ animationDelay: '.2s', opacity: 0 }}>
          <h3 style={{ fontFamily: 'var(--font-d)', fontSize: '1.2rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: 4 }}>
            🔴 Squad Activity
          </h3>
          {feed.length === 0 ? (
            <div className="empty"><p>No activity yet 🚀</p></div>
          ) : feed.map(ci => {
            const av = getAvatarDisplay(ci.users)
            return (
              <div key={ci.id} style={{ padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <button onClick={() => navigate(`/u/${ci.users?.username}`)}>
                    <div className="avatar" style={{ background: ci.users?.avatar_color ?? '#00FF87', fontSize: av.type === 'emoji' ? '1.1rem' : undefined }}>
                      {av.value}
                    </div>
                  </button>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '.95rem' }}>
                      {ci.users?.username}
                      {ci.shoutout_users?.username && (
                        <span style={{ color: 'var(--accent)', fontSize: '.8rem' }}> → 🙌 {ci.shoutout_users.username}</span>
                      )}
                      {ci.mood && <span style={{ marginLeft: 6 }}>{MOODS.find(m => m.key === ci.mood)?.emoji}</span>}
                    </div>
                    <div style={{ color: 'var(--text-dim)', fontSize: '.8rem' }}>{buildSummary(ci)}</div>
                    {ci.shoutout_msg && <div style={{ color: 'var(--accent)', fontSize: '.78rem', marginTop: 2 }}>"{ci.shoutout_msg}"</div>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <span style={{ fontFamily: 'var(--font-d)', color: 'var(--accent)', fontWeight: 800, fontSize: '.9rem' }}>+{ci.xp_earned} XP</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '.7rem' }}>{formatTime(ci.created_at)}</span>
                  </div>
                </div>
                <ReactionBar checkInId={ci.id} userId={user.id} initialReactions={reactions[ci.id] ?? []} />
              </div>
            )
          })}
        </div>
      )}

      {showSpin && <SpinWheel userId={user.id} onClose={() => setShowSpin(false)} />}
    </div>
  )
}
