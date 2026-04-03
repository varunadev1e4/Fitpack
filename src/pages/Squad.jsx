import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { getLevelInfo } from '../lib/game'

const TABS = ['Leaderboard', 'Teams', 'Trash Talk']

// ── Helpers ────────────────────────────────────────
function getMondayISO(offset = 0) {
  const d = new Date(); d.setDate(d.getDate() - offset * 7)
  const day = d.getDay() || 7; d.setDate(d.getDate() - day + 1)
  return d.toISOString().slice(0, 10)
}
function getMonthStart() {
  const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`
}

function RankIcon({ rank }) {
  if (rank===1) return <span style={{fontSize:'1.4rem'}}>🥇</span>
  if (rank===2) return <span style={{fontSize:'1.4rem'}}>🥈</span>
  if (rank===3) return <span style={{fontSize:'1.4rem'}}>🥉</span>
  return <span style={{color:'var(--text-muted)',fontFamily:'var(--font-d)',fontWeight:800,minWidth:28,textAlign:'center'}}>#{rank}</span>
}

function Delta({ v }) {
  if (v === 0 || v == null) return <span style={{color:'var(--text-muted)',fontSize:'.7rem'}}>–</span>
  if (v > 0) return <span style={{color:'var(--accent)',fontSize:'.7rem'}}>↑{v}</span>
  return <span style={{color:'var(--fire)',fontSize:'.7rem'}}>↓{Math.abs(v)}</span>
}

// ── Leaderboard Tab ────────────────────────────────
const LB_TABS = ['Weekly', 'Monthly', 'All Time', 'Streaks']

function LeaderboardTab({ userId, navigate }) {
  const [tab, setTab]     = useState(0)
  const [data, setData]   = useState([])
  const [prev, setPrev]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const loaders = [loadWeekly, loadMonthly, loadAllTime, loadStreaks]
    loaders[tab]().then(([cur, p]) => { setData(cur); setPrev(p ?? []); setLoading(false) })
  }, [tab])

  async function loadWeekly() {
    const [{ data: users }, cur, prv] = await Promise.all([
      supabase.from('users').select('id,username,avatar_color,xp'),
      supabase.from('check_ins').select('user_id, xp_earned').gte('date', getMondayISO(0)),
      supabase.from('check_ins').select('user_id, xp_earned').gte('date', getMondayISO(1)).lt('date', getMondayISO(0)),
    ])
    return [aggregate(cur.data, users, 'XP this week'), aggregate(prv.data, users)]
  }
  async function loadMonthly() {
    const [{ data: users }, { data }] = await Promise.all([
      supabase.from('users').select('id,username,avatar_color,xp'),
      supabase.from('check_ins').select('user_id, xp_earned').gte('date', getMonthStart()),
    ])
    return [aggregate(data, users, 'XP this month'), []]
  }
  async function loadAllTime() {
    const { data } = await supabase.from('users').select('id,username,xp,avatar_color').order('xp',{ascending:false}).limit(50)
    return [(data??[]).map(r => ({...r, value:r.xp, unit:'total XP'})), []]
  }
  async function loadStreaks() {
    const { data } = await supabase.from('streaks').select('user_id, current_streak, longest_streak, users(id,username,avatar_color,xp)').order('current_streak',{ascending:false}).limit(50)
    return [(data??[]).map(r => ({...r.users, value:r.current_streak??0, unit:'week streak', streak:r.current_streak})), []]
  }

  function aggregate(rows, users = [], unit='XP') {
    if (!rows) return (users ?? []).map(u => ({ ...u, value: 0, unit }))
    const userMap = Object.fromEntries((users ?? []).map(u => [u.id, u]))
    const map = {}
    rows.forEach(r => {
      const uid = r.user_id ?? r.id
      if (!map[uid]) map[uid] = { ...(userMap[uid] ?? {}), id: uid, value:0, unit }
      map[uid].value += r.xp_earned ?? 0
    })
    ;(users ?? []).forEach(u => {
      if (!map[u.id]) map[u.id] = { ...u, value: 0, unit }
    })
    return Object.values(map).sort((a,b) => b.value - a.value)
  }

  const prevRanks = {}
  prev.forEach((u,i) => { prevRanks[u.id] = i+1 })
  const myRank = data.findIndex(d => d.id === userId) + 1

  return (
    <>
      <div className="tabs" style={{ marginBottom:16 }}>
        {LB_TABS.map((t,i) => <button key={t} className={`tab-btn ${tab===i?'active':''}`} onClick={() => setTab(i)}>{t}</button>)}
      </div>
      {myRank > 0 && !loading && (
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 16px', borderRadius:14, background:'var(--accent-glow)', border:'1px solid rgba(0,255,135,.2)', marginBottom:14 }}>
          <span style={{ color:'var(--text-dim)', fontSize:'.85rem' }}>Your rank</span>
          <span style={{ fontFamily:'var(--font-d)', fontWeight:900, fontSize:'1.5rem', color:'var(--accent)' }}>#{myRank}</span>
        </div>
      )}
      {loading ? <div className="spinner" /> : data.map((entry, i) => {
        const rank = i+1
        const isMe = entry.id === userId
        const prevRank = prevRanks[entry.id]
        const delta = prevRank ? prevRank - rank : null
        const lvl = getLevelInfo(entry.xp ?? 0)
        return (
          <div key={entry.id??i} style={{
            display:'flex', alignItems:'center', gap:10, padding:'12px 14px',
            background: isMe ? 'var(--accent-glow)' : 'transparent',
            border: isMe ? '1px solid rgba(0,255,135,.2)' : '1px solid transparent',
            borderRadius:14, marginBottom:6,
          }}>
            <div style={{width:32,display:'flex',justifyContent:'center'}}><RankIcon rank={rank} /></div>
            <button onClick={() => navigate(`/u/${entry.username}`)}>
              <div className="avatar" style={{background:entry.avatar_color??'#00FF87'}}>{entry.username?.charAt(0).toUpperCase()}</div>
            </button>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:'.95rem'}}>
                <button onClick={() => navigate(`/u/${entry.username}`)} style={{ color:'inherit' }}>{entry.username}</button> {isMe && <span style={{color:'var(--accent)',fontSize:'.72rem'}}>(you)</span>}
              </div>
              <div style={{color:'var(--text-dim)',fontSize:'.72rem'}}>{lvl.emoji} {lvl.name}</div>
            </div>
            <div style={{textAlign:'right',display:'flex',flexDirection:'column',alignItems:'flex-end',gap:2}}>
              <span style={{fontFamily:'var(--font-d)',fontWeight:900,fontSize:'1.2rem',color:rank<=3?'var(--gold)':'var(--text)'}}>{(entry.value??0).toLocaleString()}</span>
              <div style={{display:'flex',gap:4,alignItems:'center'}}>
                <span style={{color:'var(--text-muted)',fontSize:'.62rem',textTransform:'uppercase'}}>{entry.unit}</span>
                {tab <= 1 && <Delta v={delta} />}
              </div>
            </div>
          </div>
        )
      })}
    </>
  )
}

// ── Teams Tab ──────────────────────────────────────
function TeamsTab({ userId, navigate }) {
  const [teams, setTeams]   = useState([])
  const [myTeam, setMyTeam] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: u } = await supabase.from('users').select('team_id,team_change_tokens').eq('id', userId).single()
      setMyTeam(u?.team_id)

      const { data: ts } = await supabase.from('teams').select('*')
      if (!ts) { setLoading(false); return }

      // Get member counts + weekly XP per team
      const monday = getMondayISO(0)
      const { data: members } = await supabase.from('users').select('id, username, avatar_color, xp, team_id')
      const { data: weekCIs }  = await supabase.from('check_ins').select('user_id, xp_earned').gte('date', monday)

      const weekMap = {}
      ;(weekCIs??[]).forEach(r => { weekMap[r.user_id] = (weekMap[r.user_id]||0) + r.xp_earned })

      const enriched = ts.map(t => {
        const mems = (members??[]).filter(m => m.team_id === t.id)
        const weekXP = mems.reduce((s, m) => s + (weekMap[m.id]||0), 0)
        return { ...t, members: mems, weekXP }
      }).sort((a,b) => b.weekXP - a.weekXP)

      setTeams(enriched)
      setLoading(false)
    }
    load()
  }, [userId])

  async function joinTeam(teamId) {
    const { data: u } = await supabase.from('users').select('team_id,team_change_tokens').eq('id', userId).single()
    if (u?.team_id && u.team_id !== teamId && (u.team_change_tokens ?? 0) <= 0) {
      alert('You need a Team Change Token to switch teams.')
      return
    }
    const updates = { team_id: teamId }
    if (u?.team_id && u.team_id !== teamId) updates.team_change_tokens = (u.team_change_tokens ?? 0) - 1
    await supabase.from('users').update(updates).eq('id', userId)
    setMyTeam(teamId)
    setTeams(prev => prev.map(t => ({
      ...t,
      members: t.id === teamId
        ? [...t.members, { id: userId }]
        : t.members.filter(m => m.id !== userId),
    })))
  }

  if (loading) return <div className="spinner" />

  return (
    <>
      <p style={{ color:'var(--text-dim)', fontSize:'.82rem', marginBottom:16 }}>
        Teams compete on weekly XP. First join is free; switching requires a Team Change Token.
      </p>
      {teams.map((team, i) => (
        <div key={team.id} className={`card ${team.id === myTeam ? 'accent-border' : ''}`} style={{ marginBottom:12 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                {i===0 && <span>🥇</span>}{i===1 && <span>🥈</span>}{i===2 && <span>🥉</span>}
                <div style={{ width:10, height:10, borderRadius:'50%', background:team.color }} />
                <span style={{ fontFamily:'var(--font-d)', fontSize:'1.3rem', fontWeight:800 }}>{team.name}</span>
                {team.id === myTeam && <span className="pill pill-accent">Your team</span>}
              </div>
              <div style={{ color:'var(--text-dim)', fontSize:'.78rem', marginTop:4 }}>
                {team.members.length} members
              </div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontFamily:'var(--font-d)', fontWeight:900, fontSize:'1.3rem', color: team.id===myTeam ? 'var(--accent)' : 'var(--text)' }}>
                {team.weekXP.toLocaleString()}
              </div>
              <div style={{ color:'var(--text-muted)', fontSize:'.65rem', textTransform:'uppercase' }}>XP this week</div>
            </div>
          </div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:12 }}>
            {team.members.slice(0,8).map(m => (
              <button key={m.id} onClick={() => navigate(`/u/${m.username}`)} style={{ fontSize:'.78rem', color:'var(--text-dim)', textDecoration:'underline' }}>
                {m.username}
              </button>
            ))}
            {team.members.length > 8 && <span style={{ color:'var(--text-muted)', fontSize:'.75rem', alignSelf:'center' }}>+{team.members.length-8}</span>}
          </div>
          {team.id !== myTeam && (
            <button className="btn btn-ghost btn-sm" style={{ width:'auto' }} onClick={() => joinTeam(team.id)}>
              Join {team.name}
            </button>
          )}
        </div>
      ))}
    </>
  )
}

// ── Trash Talk Tab ─────────────────────────────────
function TrashTalkTab({ userId, username, avatarColor }) {
  const [posts, setPosts]   = useState([])
  const [text, setText]     = useState('')
  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    load()
    // Realtime subscription
    const sub = supabase.channel('trash')
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'trash_talk' }, payload => {
        setPosts(prev => [...prev, payload.new])
        load()
      })
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [])

  async function load() {
    const { data } = await supabase
      .from('trash_talk')
      .select('*, users(username, avatar_color)')
      .order('created_at', { ascending: true })
      .limit(50)
    setPosts(data ?? [])
    setLoading(false)
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior:'smooth' }), 100)
  }

  async function post() {
    if (!text.trim()) return
    setPosting(true)
    const msg = text.trim()
    await supabase.from('trash_talk').insert({ user_id: userId, content: msg })
    setPosts(prev => [...prev, {
      id: `tmp-${Date.now()}`,
      user_id: userId,
      content: msg,
      created_at: new Date().toISOString(),
      users: { username, avatar_color: avatarColor },
    }])
    setText('')
    setPosting(false)
  }

  function formatTime(ts) {
    return new Date(ts).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' })
  }

  return (
    <div>
      <p style={{ color:'var(--text-dim)', fontSize:'.82rem', marginBottom:14 }}>
        🗣️ Weekly smack talk board — resets every Monday
      </p>
      <div style={{ maxHeight:380, overflowY:'auto', marginBottom:12, display:'flex', flexDirection:'column', gap:8 }}>
        {loading ? <div className="spinner" /> : posts.length === 0 ? (
          <div className="empty"><p>No trash talk yet. Start something 😤</p></div>
        ) : posts.map(p => {
          const isMe = p.user_id === userId
          return (
            <div key={p.id} style={{ display:'flex', gap:8, alignItems:'flex-start', flexDirection: isMe ? 'row-reverse' : 'row' }}>
              <div className="avatar" style={{ width:28, height:28, fontSize:'.75rem', background:p.users?.avatar_color??'#00FF87', flexShrink:0 }}>
                {p.users?.username?.charAt(0).toUpperCase()}
              </div>
              <div style={{ maxWidth:'75%' }}>
                {!isMe && <div style={{ fontSize:'.68rem', color:'var(--text-muted)', marginBottom:2, paddingLeft:4 }}>{p.users?.username}</div>}
                <div style={{
                  background: isMe ? 'var(--accent)' : 'var(--bg-elevated)',
                  color: isMe ? '#08080e' : 'var(--text)',
                  padding:'8px 12px', borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  fontSize:'.9rem', lineHeight:1.4,
                }}>{p.content}</div>
                <div style={{ fontSize:'.65rem', color:'var(--text-muted)', paddingLeft:4, marginTop:2, textAlign: isMe ? 'right' : 'left' }}>{formatTime(p.created_at)}</div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <div style={{ display:'flex', gap:8 }}>
        <input
          className="input"
          placeholder="Say something... 😤"
          value={text}
          onChange={e => setText(e.target.value.slice(0,280))}
          onKeyDown={e => e.key==='Enter' && !e.shiftKey && post()}
          style={{ flex:1 }}
        />
        <button className="btn btn-fire btn-sm" style={{ width:'auto', minWidth:60 }} onClick={post} disabled={posting || !text.trim()}>
          Send
        </button>
      </div>
    </div>
  )
}

// ── Main ────────────────────────────────────────────
export default function Squad() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState(0)

  return (
    <div className="page">
      <h1 className="page-title fade-up">Squad 👥</h1>
      <div className="tabs fade-up" style={{ marginBottom:20, animationDelay:'.05s', opacity:0 }}>
        {TABS.map((t,i) => <button key={t} className={`tab-btn ${tab===i?'active':''}`} onClick={() => setTab(i)}>{t}</button>)}
      </div>

      <div className="fade-in">
        {tab === 0 && <LeaderboardTab userId={user.id} navigate={navigate} />}
        {tab === 1 && <TeamsTab userId={user.id} navigate={navigate} />}
        {tab === 2 && <TrashTalkTab userId={user.id} username={user.username} avatarColor={user.avatar_color} />}
      </div>
    </div>
  )
}
