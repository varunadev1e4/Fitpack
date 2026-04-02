import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

const TABS = ['Active', 'Propose', 'Pending', 'Hall of Fame']

function daysLeft(end) {
  const d = Math.ceil((new Date(end) - new Date()) / 86400000)
  return Math.max(d, 0)
}

// ── Boss / Challenge cards ─────────────────────────
function BossCard({ ch, participants, total, target }) {
  const pct = Math.min((total/target)*100, 100)
  const won = pct >= 100
  return (
    <div className={`card ${won?'accent-border':'fire-border'}`} style={{ marginBottom:14 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
        <div>
          <span className="pill pill-fire" style={{ marginBottom:6 }}>⚔️ BOSS BATTLE</span>
          <h3 style={{ fontFamily:'var(--font-d)', fontSize:'1.4rem', fontWeight:900, lineHeight:1.1 }}>{ch.title}</h3>
          <p style={{ color:'var(--text-dim)', fontSize:'.8rem', marginTop:4 }}>{ch.description}</p>
        </div>
        <div style={{ textAlign:'center', flexShrink:0, marginLeft:10 }}>
          <div style={{ fontFamily:'var(--font-d)', fontSize:'1.8rem', fontWeight:900 }}>{daysLeft(ch.end_date)}</div>
          <div style={{ color:'var(--text-muted)', fontSize:'.62rem', textTransform:'uppercase' }}>days left</div>
        </div>
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:'.82rem', marginBottom:6 }}>
        <span style={{ color:'var(--text-dim)' }}>Squad total</span>
        <span style={{ fontFamily:'var(--font-d)', fontWeight:800, color: won?'var(--accent)':'var(--fire)' }}>{total} / {target}</span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width:`${pct}%`, background: won ? 'linear-gradient(90deg,var(--accent),#00cfff)' : 'linear-gradient(90deg,var(--fire),#ffb347)' }} />
      </div>
      {won && <div style={{ textAlign:'center', marginTop:10, padding:10, background:'var(--accent-glow)', borderRadius:10 }}>
        <span style={{ fontFamily:'var(--font-d)', fontWeight:900, color:'var(--accent)' }}>🎉 BOSS DEFEATED! +{ch.xp_reward} XP each!</span>
      </div>}
      <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginTop:10 }}>
        {participants.slice(0,8).map(p => (
          <div key={p.user_id} className="avatar" style={{ width:26, height:26, fontSize:'.7rem', background:p.avatar_color??'#00FF87' }}>{p.username?.charAt(0).toUpperCase()}</div>
        ))}
        {participants.length > 8 && <span style={{ color:'var(--text-muted)', fontSize:'.72rem', alignSelf:'center' }}>+{participants.length-8}</span>}
      </div>
    </div>
  )
}

function IndCard({ ch, myProgress, target }) {
  const pct = Math.min((myProgress/target)*100, 100)
  return (
    <div className={`card ${pct>=100?'accent-border':''}`} style={{ marginBottom:12 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
        <div>
          <span className="pill pill-purple" style={{ marginBottom:6 }}>🎯 CHALLENGE</span>
          <h3 style={{ fontFamily:'var(--font-d)', fontSize:'1.2rem', fontWeight:800 }}>{ch.title}</h3>
          {ch.description && <p style={{ color:'var(--text-dim)', fontSize:'.78rem', marginTop:2 }}>{ch.description}</p>}
        </div>
        <span className="pill pill-gold">{daysLeft(ch.end_date)}d</span>
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:'.82rem', marginBottom:5 }}>
        <span style={{ color:'var(--text-dim)' }}>Your progress</span>
        <span style={{ fontFamily:'var(--font-d)', fontWeight:800 }}>{myProgress} / {target}</span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width:`${pct}%`, background: pct>=100 ? 'var(--accent)' : 'var(--purple)' }} />
      </div>
      <div style={{ display:'flex', justifyContent:'flex-end', marginTop:6 }}>
        <span className="pill pill-gold">+{ch.xp_reward} XP</span>
      </div>
    </div>
  )
}

// ── Active tab ─────────────────────────────────────
function ActiveTab({ userId }) {
  const [chs, setChs]         = useState([])
  const [bossData, setBossData] = useState({})
  const [myProg, setMyProg]   = useState({})
  const [loading, setLoading] = useState(true)
  const today = new Date().toISOString().slice(0,10)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('challenges').select('*').eq('active', true).eq('approved', true).lte('start_date', today).gte('end_date', today)
      if (!data) { setLoading(false); return }
      setChs(data)

      const { data: allProg } = await supabase.from('challenge_progress').select('*, users(username, avatar_color)').in('challenge_id', data.map(c=>c.id))
      const bmap={}, pmap={}
      data.forEach(ch => {
        const rows = (allProg??[]).filter(p => p.challenge_id===ch.id)
        bmap[ch.id] = { total: rows.reduce((s,r)=>s+(r.progress??0),0), participants: rows.map(r=>({user_id:r.user_id,...r.users})) }
        pmap[ch.id] = rows.find(r=>r.user_id===userId)?.progress ?? 0
      })
      setBossData(bmap); setMyProg(pmap); setLoading(false)
    }
    load()
  }, [userId])

  if (loading) return <div className="spinner" />
  if (!chs.length) return <div className="empty"><div className="icon">🛡️</div><p>No active challenges. Propose one!</p></div>

  return <>
    {chs.filter(c=>c.type==='boss').map(ch => <BossCard key={ch.id} ch={ch} participants={bossData[ch.id]?.participants??[]} total={bossData[ch.id]?.total??0} target={ch.target} />)}
    {chs.filter(c=>c.type!=='boss').map(ch => <IndCard key={ch.id} ch={ch} myProgress={myProg[ch.id]??0} target={ch.target} />)}
  </>
}

// ── Propose Tab ────────────────────────────────────
function ProposeTab({ userId }) {
  const [form, setForm] = useState({ title:'', description:'', type:'boss', metric:'workouts', target:50, xp_reward:150, days:7 })
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setSubmitting(true)
    const start = new Date().toISOString().slice(0,10)
    const end   = new Date(Date.now() + form.days * 86400000).toISOString().slice(0,10)
    await supabase.from('challenges').insert({
      ...form, start_date: start, end_date: end,
      proposed_by: userId, approved: false, active: true,
    })
    setDone(true); setSubmitting(false)
  }

  if (done) return (
    <div className="card accent-border" style={{ textAlign:'center', padding:32 }}>
      <div style={{ fontSize:'2.5rem', marginBottom:12 }}>🎉</div>
      <h3 style={{ fontFamily:'var(--font-d)', fontSize:'1.5rem', fontWeight:900 }}>Challenge Proposed!</h3>
      <p style={{ color:'var(--text-dim)', marginTop:8 }}>The squad can now vote on it in the Pending tab.</p>
      <button className="btn btn-ghost btn-sm" style={{ marginTop:16, width:'auto' }} onClick={() => setDone(false)}>Propose Another</button>
    </div>
  )

  return (
    <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:12 }}>
      <div><label className="input-label">Title</label><input className="input" required value={form.title} onChange={e => setForm(f=>({...f,title:e.target.value}))} placeholder="e.g. 💀 Cardio King Week" /></div>
      <div><label className="input-label">Description</label><input className="input" value={form.description} onChange={e => setForm(f=>({...f,description:e.target.value}))} placeholder="What's the goal?" /></div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <div>
          <label className="input-label">Type</label>
          <select className="input" value={form.type} onChange={e => setForm(f=>({...f,type:e.target.value}))}>
            <option value="boss">⚔️ Boss Battle</option>
            <option value="individual">🎯 Individual</option>
          </select>
        </div>
        <div>
          <label className="input-label">Metric</label>
          <select className="input" value={form.metric} onChange={e => setForm(f=>({...f,metric:e.target.value}))}>
            {['workouts','water','meals','sleep','xp'].map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div><label className="input-label">Target</label><input className="input" type="number" value={form.target} onChange={e => setForm(f=>({...f,target:+e.target.value}))} /></div>
        <div><label className="input-label">Duration (days)</label><input className="input" type="number" min={1} max={30} value={form.days} onChange={e => setForm(f=>({...f,days:+e.target.value}))} /></div>
        <div><label className="input-label">XP Reward</label><input className="input" type="number" value={form.xp_reward} onChange={e => setForm(f=>({...f,xp_reward:+e.target.value}))} /></div>
      </div>
      <button type="submit" className="btn btn-purple" disabled={submitting}>{submitting ? '⏳ Submitting...' : '🚀 Propose Challenge'}</button>
    </form>
  )
}

// ── Pending Tab (voting) ───────────────────────────
function PendingTab({ userId }) {
  const [pending, setPending]   = useState([])
  const [myVotes, setMyVotes]   = useState({})
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('challenges').select('*, users(username)').eq('approved', false).eq('active', true)
      setPending(data ?? [])
      if (data?.length) {
        const { data: vs } = await supabase.from('challenge_votes').select('*').eq('user_id', userId).in('challenge_id', data.map(c=>c.id))
        const map = {}
        ;(vs??[]).forEach(v => { map[v.challenge_id] = v.vote })
        setMyVotes(map)
      }
      setLoading(false)
    }
    load()
  }, [userId])

  async function vote(chId, up) {
    await supabase.from('challenge_votes').upsert({ challenge_id:chId, user_id:userId, vote:up }, { onConflict:'challenge_id,user_id' })
    setMyVotes(prev => ({...prev, [chId]: up}))
    // Auto-approve if enough up votes (e.g. 5+)
    const { count } = await supabase.from('challenge_votes').select('id',{count:'exact'}).eq('challenge_id',chId).eq('vote',true)
    if ((count??0) >= 5) {
      await supabase.from('challenges').update({ approved:true }).eq('id', chId)
      setPending(prev => prev.filter(c => c.id !== chId))
    }
  }

  if (loading) return <div className="spinner" />
  if (!pending.length) return <div className="empty"><div className="icon">✨</div><p>No pending proposals. Propose one!</p></div>

  return (
    <>
      <p style={{ color:'var(--text-dim)', fontSize:'.82rem', marginBottom:14 }}>5 up-votes activates a challenge automatically.</p>
      {pending.map(ch => (
        <div key={ch.id} className="card" style={{ marginBottom:12 }}>
          <div style={{ marginBottom:10 }}>
            <p style={{ fontSize:'.72rem', color:'var(--text-muted)', marginBottom:4 }}>Proposed by {ch.users?.username}</p>
            <h3 style={{ fontFamily:'var(--font-d)', fontSize:'1.2rem', fontWeight:800 }}>{ch.title}</h3>
            <p style={{ color:'var(--text-dim)', fontSize:'.8rem', marginTop:2 }}>{ch.description}</p>
            <div style={{ display:'flex', gap:8, marginTop:8 }}>
              <span className="pill pill-blue">{ch.type}</span>
              <span className="pill pill-gold">+{ch.xp_reward} XP</span>
              <span className="pill pill-purple">{ch.target} {ch.metric}</span>
            </div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn btn-sm" onClick={() => vote(ch.id, true)}
              style={{ flex:1, background: myVotes[ch.id]===true ? 'var(--accent)' : 'var(--bg-elevated)', color: myVotes[ch.id]===true ? '#08080e':'var(--text)', border:'1px solid var(--border)' }}>
              👍 Yes
            </button>
            <button className="btn btn-sm" onClick={() => vote(ch.id, false)}
              style={{ flex:1, background: myVotes[ch.id]===false ? 'var(--fire)' : 'var(--bg-elevated)', color:'var(--text)', border:'1px solid var(--border)' }}>
              👎 No
            </button>
          </div>
        </div>
      ))}
    </>
  )
}

// ── Hall of Fame ───────────────────────────────────
function HallOfFameTab() {
  const [months, setMonths]   = useState([])
  const [selMonth, setSelMonth] = useState('')
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      // Get all distinct months from check_ins
      const { data } = await supabase.from('check_ins').select('date').order('date',{ascending:false}).limit(200)
      const ms = [...new Set((data??[]).map(r => r.date.slice(0,7)))].sort().reverse()
      setMonths(ms)
      if (ms.length) { setSelMonth(ms[0]); loadMonth(ms[0]) }
      else setLoading(false)
    }
    load()
  }, [])

  async function loadMonth(month) {
    setLoading(true)
    const start = `${month}-01`
    const end   = `${month}-31`
    const { data: cis } = await supabase.from('check_ins').select('user_id, xp_earned, workout, users(username, avatar_color)').gte('date',start).lte('date',end)
    if (!cis) { setLoading(false); return }

    const xpMap={}, wkMap={}, ciMap={}
    cis.forEach(c => {
      const uid = c.user_id
      xpMap[uid] = (xpMap[uid]||0) + c.xp_earned
      wkMap[uid] = (wkMap[uid]||0) + (c.workout?1:0)
      ciMap[uid] = { ...(ciMap[uid]||{}), xp: xpMap[uid], workouts: wkMap[uid], username: c.users?.username, avatar_color: c.users?.avatar_color }
    })

    const sorted = Object.values(ciMap)
    const cats = [
      { key:'xp',       label:'🏆 Most XP',       sort: (a,b) => b.xp-a.xp,       fmt: u => `${u.xp.toLocaleString()} XP` },
      { key:'workouts', label:'💪 Most Workouts',  sort: (a,b) => b.workouts-a.workouts, fmt: u => `${u.workouts} workouts` },
    ]

    setEntries(cats.map(cat => ({ ...cat, top3: [...sorted].sort(cat.sort).slice(0,3) })))
    setLoading(false)
  }

  return (
    <>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16 }}>
        {months.slice(0,6).map(m => (
          <button key={m} onClick={() => { setSelMonth(m); loadMonth(m) }}
            style={{ padding:'6px 14px', borderRadius:99, fontSize:'.8rem', fontWeight:700,
              background: selMonth===m ? 'var(--gold)' : 'var(--bg-elevated)',
              color: selMonth===m ? '#08080e' : 'var(--text-dim)',
              border: `1px solid ${selMonth===m ? 'transparent' : 'var(--border)'}` }}>
            {new Date(m+'-15').toLocaleString('default',{month:'short',year:'2-digit'})}
          </button>
        ))}
      </div>
      {loading ? <div className="spinner" /> : entries.map(cat => (
        <div key={cat.key} className="card" style={{ marginBottom:14 }}>
          <h3 style={{ fontFamily:'var(--font-d)', fontSize:'1.2rem', fontWeight:800, marginBottom:12 }}>{cat.label}</h3>
          {cat.top3.map((u,i) => (
            <div key={u.username} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
              <span style={{ fontSize:'1.3rem' }}>{['🥇','🥈','🥉'][i]}</span>
              <div className="avatar" style={{ width:30, height:30, fontSize:'.8rem', background:u.avatar_color??'#00FF87' }}>{u.username?.charAt(0).toUpperCase()}</div>
              <span style={{ flex:1, fontWeight:600 }}>{u.username}</span>
              <span style={{ fontFamily:'var(--font-d)', fontWeight:800, color:'var(--gold)' }}>{cat.fmt(u)}</span>
            </div>
          ))}
        </div>
      ))}
    </>
  )
}

// ── Main ───────────────────────────────────────────
export default function Battles() {
  const { user } = useAuth()
  const [tab, setTab] = useState(0)

  return (
    <div className="page">
      <h1 className="page-title fade-up">Battles ⚔️</h1>
      <div className="tabs fade-up" style={{ marginBottom:20, animationDelay:'.05s', opacity:0 }}>
        {TABS.map((t,i) => <button key={t} className={`tab-btn ${tab===i?'active':''}`} onClick={() => setTab(i)}>{t}</button>)}
      </div>
      <div className="fade-in">
        {tab===0 && <ActiveTab userId={user.id} />}
        {tab===1 && <ProposeTab userId={user.id} />}
        {tab===2 && <PendingTab userId={user.id} />}
        {tab===3 && <HallOfFameTab />}
      </div>
    </div>
  )
}
