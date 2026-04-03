import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import {
  getLevelInfo, getXPProgress, getXPToNext, LEVELS,
  calcConsistency, weakestMetric, displayStreak, weekProgress,
  calcCorrelations, calcBestWeek, calcJunkStreak,
  AVATAR_STYLES, AVATAR_COLORS, getAvatarDisplay, getActiveSeason
} from '../lib/game'
import { requestPermission, scheduleLocalReminder, getReminderTime } from '../lib/push'
import { useTheme } from '../hooks/useTheme'
import CalendarHeatmap from '../components/CalendarHeatmap'
import { LineChart, BarChart } from '../components/MiniChart'

const TABS = ['Stats', 'Analytics', 'Badges', 'PRs', 'Settings']
const PR_UNITS = ['kg', 'reps', 'min', 'km', 'm', 'sec']

// ── Stats Tab ──────────────────────────────────────
function StatsTab({ user, fullUser, streak, stats, checkIns }) {
  const xp  = fullUser?.xp ?? 0
  const lvl = getLevelInfo(xp)
  const av  = getAvatarDisplay(fullUser ?? user)
  const junkStreak = calcJunkStreak([...checkIns].sort((a,b) => b.date.localeCompare(a.date)))
  const bestWeek   = calcBestWeek(checkIns)

  return (
    <>
      <div className="card accent-border" style={{ textAlign:'center', padding:'28px 20px', marginBottom:14 }}>
        <div className="avatar" style={{ width:72, height:72, fontSize: av.type==='emoji' ? '2.5rem' : '2rem', background: fullUser?.avatar_color ?? '#00FF87', margin:'0 auto 12px' }}>
          {av.value}
        </div>
        <h2 style={{ fontFamily:'var(--font-d)', fontSize:'2rem', fontWeight:900 }}>{user.username}</h2>
        <div style={{ margin:'8px 0' }}>
          <span className="pill pill-accent">{lvl.emoji} LVL {lvl.level} · {lvl.name}</span>
        </div>
        <div style={{ fontFamily:'var(--font-d)', fontSize:'1.6rem', fontWeight:900, color:'var(--accent)', marginBottom:12 }}>
          {xp.toLocaleString()} XP
        </div>
        <div className="xp-track" style={{ height:8 }}>
          <div className="xp-fill" style={{ width:`${getXPProgress(xp)}%` }} />
        </div>
        {getXPToNext(xp) > 0 && <p style={{ color:'var(--text-dim)', fontSize:'.73rem', marginTop:6 }}>{getXPToNext(xp).toLocaleString()} XP to next level</p>}
      </div>

      <div style={{ display:'flex', gap:10, marginBottom:12 }}>
        {[
          { val: displayStreak(streak), label:'🔥 Week Streak', color:'var(--fire)' },
          { val: streak?.longest_streak??0, label:'🏅 Best', color:'var(--gold)' },
          { val: `${weekProgress(streak)}/3`, label:'This Week', color:'var(--accent)' },
        ].map(s => (
          <div key={s.label} className="card" style={{ flex:1, textAlign:'center', padding:'14px 8px' }}>
            <div style={{ fontFamily:'var(--font-d)', fontSize:'2rem', fontWeight:900, color:s.color }}>{s.val}</div>
            <div style={{ color:'var(--text-dim)', fontSize:'.65rem', textTransform:'uppercase', marginTop:2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Junk streak */}
      {junkStreak > 0 && (
        <div className="card" style={{ marginBottom:12, background:'rgba(132,204,22,.06)', borderColor:'rgba(132,204,22,.25)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:'2rem' }}>🥗</span>
            <div>
              <div style={{ fontFamily:'var(--font-d)', fontWeight:900, fontSize:'1.3rem', color:'#84CC16' }}>{junkStreak} day clean streak</div>
              <div style={{ color:'var(--text-dim)', fontSize:'.78rem' }}>No junk food in {junkStreak} consecutive days!</div>
            </div>
          </div>
        </div>
      )}

      {/* Best week */}
      {bestWeek > 0 && (
        <div className="card" style={{ marginBottom:12 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ color:'var(--text-dim)', fontSize:'.88rem' }}>⭐ Best Week Ever</span>
            <span style={{ fontFamily:'var(--font-d)', fontWeight:900, fontSize:'1.3rem', color:'var(--gold)' }}>{bestWeek.toLocaleString()} XP</span>
          </div>
        </div>
      )}

      {stats && (
        <div className="card" style={{ marginBottom:12 }}>
          <h3 style={{ fontFamily:'var(--font-d)', fontWeight:800, textTransform:'uppercase', fontSize:'1rem', marginBottom:14 }}>30-Day Averages</h3>
          {[
            { label:'💪 Workouts', val:`${stats.totalWorkouts} total` },
            { label:'💧 Water / day', val:`${stats.avgWater} glasses` },
            { label:'🍽 Meals / day', val:`${stats.avgMeals} meals` },
            { label:'😴 Sleep / night', val:`${stats.avgSleep}h` },
            { label:'🥗 Clean days', val:`${stats.cleanDays} days` },
            { label:'🧘 Rest days', val:`${stats.restDays} days` },
          ].map(s => (
            <div key={s.label} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
              <span style={{ color:'var(--text-dim)', fontSize:'.88rem' }}>{s.label}</span>
              <span style={{ fontWeight:700, fontSize:'.88rem' }}>{s.val}</span>
            </div>
          ))}
        </div>
      )}

      <div className="card" style={{ marginBottom:12 }}>
        <h3 style={{ fontFamily:'var(--font-d)', fontWeight:800, textTransform:'uppercase', fontSize:'1rem', marginBottom:14 }}>Activity Map</h3>
        <CalendarHeatmap checkIns={checkIns} />
      </div>

      <WeightTracker userId={user.id} />

      <div className="card" style={{ marginBottom:12 }}>
        <h3 style={{ fontFamily:'var(--font-d)', fontWeight:800, textTransform:'uppercase', fontSize:'1rem', marginBottom:14 }}>Level Roadmap</h3>
        {LEVELS.map(l => {
          const xpVal  = fullUser?.xp ?? 0
          const reached  = xpVal >= l.min
          const current  = l.level === lvl.level
          return (
            <div key={l.level} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:'1px solid var(--border)', opacity:reached?1:0.4 }}>
              <span style={{ fontSize:'1.2rem' }}>{l.emoji}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, color:current?'var(--accent)':'var(--text)', fontSize:'.9rem' }}>Lv.{l.level} {l.name} {current&&'← you'}</div>
                <div style={{ color:'var(--text-dim)', fontSize:'.72rem' }}>{l.min.toLocaleString()}{l.max!==Infinity?` – ${l.max.toLocaleString()}`:'+'} XP</div>
              </div>
              {reached && <span style={{ color:'var(--accent)' }}>✓</span>}
            </div>
          )
        })}
      </div>
    </>
  )
}

function WeightTracker({ userId }) {
  const [rows, setRows] = useState([])
  const [weight, setWeight] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    const { data } = await supabase.from('weight_logs').select('*').eq('user_id', userId).order('date', { ascending: true }).limit(60)
    setRows(data ?? [])
  }

  useEffect(() => { load() }, [userId])

  async function add() {
    if (!weight) return
    setSaving(true)
    await supabase.from('weight_logs').upsert({ user_id: userId, date: new Date().toISOString().slice(0, 10), weight_kg: +weight }, { onConflict: 'user_id,date' })
    setWeight('')
    await load()
    setSaving(false)
  }

  const chartData = rows.map((r, i) => ({ value: Number(r.weight_kg), label: i % 7 === 0 ? r.date.slice(5) : '' }))

  return (
    <div className="card" style={{ marginBottom:12 }}>
      <h3 style={{ fontFamily:'var(--font-d)', fontWeight:800, textTransform:'uppercase', fontSize:'1rem', marginBottom:12 }}>⚖️ Weight Tracker</h3>
      <div style={{ display:'flex', gap:8, marginBottom:12 }}>
        <input className="input" type="number" step="0.1" value={weight} onChange={e => setWeight(e.target.value)} placeholder="Today's weight (kg)" />
        <button className="btn btn-ghost btn-sm" style={{ width:'auto' }} onClick={add} disabled={saving || !weight}>Save</button>
      </div>
      {chartData.length ? <LineChart data={chartData} color="var(--gold)" height={90} /> : <p style={{ color:'var(--text-dim)', fontSize:'.8rem' }}>Log your first weight entry.</p>}
    </div>
  )
}

// ── Analytics Tab ──────────────────────────────────
function AnalyticsTab({ checkIns }) {
  if (!checkIns.length) return <div className="empty"><p>Log check-ins to see analytics!</p></div>

  const consistency  = calcConsistency(checkIns, 30)
  const weak         = weakestMetric(checkIns.slice(0, 30))
  const correlations = calcCorrelations(checkIns)
  const bestWeek     = calcBestWeek(checkIns)

  const weeklyXP = []
  for (let i = 7; i >= 0; i--) {
    const d   = new Date(); d.setDate(d.getDate() - i*7)
    const day = d.getDay()||7; d.setDate(d.getDate()-day+1)
    const mon = d.toISOString().slice(0,10)
    const sun = new Date(d.getTime()+6*86400000).toISOString().slice(0,10)
    const xp  = checkIns.filter(c => c.date>=mon && c.date<=sun).reduce((s,c)=>s+(c.xp_earned??0),0)
    weeklyXP.push({ value: xp, label:`W${8-i}` })
  }

  const dowCounts = [0,0,0,0,0,0,0]
  checkIns.forEach(c => { dowCounts[new Date(c.date).getDay()]++ })
  const dowData = ['S','M','T','W','T','F','S'].map((l,i) => ({ value:dowCounts[i], label:l }))

  const sleepTrend = []
  for (let i = 13; i >= 0; i--) {
    const d   = new Date(); d.setDate(d.getDate()-i)
    const iso = d.toISOString().slice(0,10)
    const ci  = checkIns.find(c => c.date===iso)
    sleepTrend.push({ value:ci?.sleep_hours??0, label:i===0?'Today':i===7?'7d':'' })
  }

  const moodData = ['dead','tired','meh','good','fire'].map(key => ({
    value: checkIns.filter(c => c.mood === key).length,
    label: {dead:'💀',tired:'😴',meh:'😐',good:'😊',fire:'🔥'}[key],
  }))

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <div className="card accent-border">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <div>
            <h3 style={{ fontFamily:'var(--font-d)', fontSize:'1.2rem', fontWeight:800 }}>📊 Consistency Score</h3>
            <p style={{ color:'var(--text-dim)', fontSize:'.78rem' }}>check-ins / days (last 30)</p>
          </div>
          <div style={{ fontFamily:'var(--font-d)', fontSize:'2.5rem', fontWeight:900, color:consistency>=80?'var(--accent)':consistency>=50?'var(--gold)':'var(--fire)' }}>
            {consistency}%
          </div>
        </div>
        <div className="progress-track" style={{ height:8 }}>
          <div className="progress-fill" style={{ width:`${consistency}%`, background:consistency>=80?'var(--accent)':consistency>=50?'var(--gold)':'var(--fire)' }} />
        </div>
      </div>

      {bestWeek > 0 && (
        <div className="card" style={{ background:'rgba(245,158,11,.06)', borderColor:'rgba(245,158,11,.25)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontFamily:'var(--font-d)', fontWeight:800 }}>⭐ Best Week Ever</span>
            <span style={{ fontFamily:'var(--font-d)', fontSize:'1.4rem', fontWeight:900, color:'var(--gold)' }}>{bestWeek.toLocaleString()} XP</span>
          </div>
        </div>
      )}

      {weak && (
        <div className="card fire-border">
          <h3 style={{ fontFamily:'var(--font-d)', fontSize:'1rem', fontWeight:800, marginBottom:6 }}>⚠️ Weakest Area: {weak.key}</h3>
          <p style={{ color:'var(--text-dim)', fontSize:'.82rem' }}>{weak.label}</p>
          <p style={{ color:'var(--fire)', fontSize:'.8rem', marginTop:6, fontWeight:600 }}>Focus here to level up faster!</p>
        </div>
      )}

      {correlations.length > 0 && (
        <div className="card">
          <h3 style={{ fontFamily:'var(--font-d)', fontSize:'1rem', fontWeight:800, marginBottom:12 }}>🔗 Your Patterns</h3>
          {correlations.map((c, i) => (
            <div key={i} style={{ display:'flex', gap:10, padding:'10px 0', borderBottom:'1px solid var(--border)' }}>
              <span style={{ fontSize:'1.3rem', flexShrink:0 }}>{c.icon}</span>
              <p style={{ color:'var(--text-dim)', fontSize:'.85rem', lineHeight:1.5 }}>{c.insight}</p>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <h3 style={{ fontFamily:'var(--font-d)', fontSize:'1rem', fontWeight:800, marginBottom:14 }}>⚡ Weekly XP</h3>
        <BarChart data={weeklyXP} color="var(--accent)" height={100} />
      </div>
      <div className="card">
        <h3 style={{ fontFamily:'var(--font-d)', fontSize:'1rem', fontWeight:800, marginBottom:14 }}>📅 Active Days</h3>
        <BarChart data={dowData} color="var(--purple)" height={80} />
      </div>
      <div className="card">
        <h3 style={{ fontFamily:'var(--font-d)', fontSize:'1rem', fontWeight:800, marginBottom:14 }}>😴 Sleep Trend</h3>
        <LineChart data={sleepTrend} color="var(--blue)" height={80} />
      </div>
      <div className="card">
        <h3 style={{ fontFamily:'var(--font-d)', fontSize:'1rem', fontWeight:800, marginBottom:14 }}>😊 Mood Distribution</h3>
        <BarChart data={moodData} color="var(--gold)" height={80} />
      </div>
    </div>
  )
}

// ── Badges Tab ─────────────────────────────────────
function BadgesTab({ userId }) {
  const [earned, setEarned]   = useState([])
  const [all, setAll]         = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('badges').select('*'),
      supabase.from('user_badges').select('badge_id, earned_at, badges(slug)').eq('user_id', userId),
    ]).then(([{ data: ab }, { data: ub }]) => {
      setAll(ab ?? [])
      setEarned((ub ?? []).map(b => b.badges?.slug).filter(Boolean))
      setLoading(false)
    })
  }, [userId])

  if (loading) return <div className="spinner" />

  return (
    <>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
        <span style={{ color:'var(--text-dim)', fontSize:'.85rem' }}>{earned.length} / {all.length} earned</span>
        <div className="xp-track" style={{ width:120 }}>
          <div className="xp-fill" style={{ width:`${(earned.length/Math.max(all.length,1))*100}%` }} />
        </div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:10 }}>
        {all.map(b => {
          const got = earned.includes(b.slug)
          return (
            <div key={b.id} className={`card ${got ? '' : ''}`} style={{ opacity:got?1:0.3, padding:'16px 14px' }}>
              <div style={{ fontSize:'2rem', marginBottom:6 }}>{b.icon}</div>
              <div style={{ fontWeight:700, fontSize:'.9rem', marginBottom:2 }}>{b.name}</div>
              <div style={{ color:'var(--text-dim)', fontSize:'.72rem', marginBottom:6 }}>{b.description}</div>
              {got
                ? <span className="pill pill-accent">+{b.xp_reward} XP ✓</span>
                : <span className="pill" style={{ background:'var(--bg-elevated)', color:'var(--text-muted)' }}>Locked 🔒</span>}
            </div>
          )
        })}
      </div>
    </>
  )
}

// ── PRs Tab ────────────────────────────────────────
function PRsTab({ userId }) {
  const [prs, setPRs]     = useState([])
  const [loading, setL]   = useState(true)
  const [form, setForm]   = useState({ exercise:'', value:'', unit:'kg' })
  const [adding, setAdding] = useState(false)

  useEffect(() => { load() }, [userId])

  async function load() {
    const { data } = await supabase.from('personal_records').select('*').eq('user_id', userId).order('date', { ascending:false })
    setPRs(data??[]); setL(false)
  }

  async function add() {
    if (!form.exercise || !form.value) return
    setAdding(true)
    await supabase.from('personal_records').insert({ user_id:userId, ...form, value:+form.value })
    await load()
    setForm(f => ({ ...f, exercise:'', value:'' }))
    setAdding(false)
  }

  const latest = {}
  prs.forEach(p => { if (!latest[p.exercise]) latest[p.exercise] = p })

  return (
    <>
      <div className="card" style={{ marginBottom:14 }}>
        <h3 style={{ fontFamily:'var(--font-d)', fontWeight:800, fontSize:'1rem', marginBottom:12 }}>Log New PR 📈</h3>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <input className="input" placeholder="Exercise (e.g. Bench Press)" value={form.exercise} onChange={e => setForm(f=>({...f,exercise:e.target.value}))} />
          <div style={{ display:'flex', gap:8 }}>
            <input className="input" style={{ flex:2 }} type="number" placeholder="Value" value={form.value} onChange={e => setForm(f=>({...f,value:e.target.value}))} />
            <select className="input" style={{ flex:1 }} value={form.unit} onChange={e => setForm(f=>({...f,unit:e.target.value}))}>
              {PR_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <button className="btn btn-primary btn-sm" onClick={add} disabled={adding||!form.exercise||!form.value}>
            {adding ? '...' : '+ Add PR'}
          </button>
        </div>
      </div>
      {loading ? <div className="spinner" /> : Object.values(latest).length === 0 ? (
        <div className="empty"><p>No PRs yet 💪</p></div>
      ) : Object.values(latest).map(pr => (
        <div key={pr.id} className="card" style={{ marginBottom:8 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <div style={{ fontWeight:700 }}>{pr.exercise}</div>
              <div style={{ color:'var(--text-dim)', fontSize:'.72rem' }}>{new Date(pr.date).toLocaleDateString('en-IN')}</div>
            </div>
            <div style={{ fontFamily:'var(--font-d)', fontSize:'1.6rem', fontWeight:900, color:'var(--gold)' }}>
              {pr.value} <span style={{ fontSize:'1rem', color:'var(--text-dim)' }}>{pr.unit}</span>
            </div>
          </div>
        </div>
      ))}
    </>
  )
}

// ── Monthly Review ─────────────────────────────────
function MonthlyReview({ userId, checkIns }) {
  const months = [...new Set(checkIns.map(c => c.date.slice(0,7)))].sort().reverse().slice(0, 6)
  const [sel, setSel] = useState(months[0] ?? '')

  const monthCIs = checkIns.filter(c => c.date.startsWith(sel))
  if (!monthCIs.length) return null

  const xpEarned  = monthCIs.reduce((s, c) => s + (c.xp_earned || 0), 0)
  const workouts  = monthCIs.filter(c => c.workout).length
  const cleanDays = monthCIs.filter(c => c.no_junk).length
  const perfDays  = monthCIs.filter(c => c.workout && c.meals >= 3 && c.water_glasses >= 6 && c.sleep_hours >= 6).length
  const bestDay   = [...monthCIs].sort((a, b) => (b.xp_earned||0)-(a.xp_earned||0))[0]

  return (
    <div className="card" style={{ marginBottom:14 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
        <h3 style={{ fontFamily:'var(--font-d)', fontWeight:800, fontSize:'1rem' }}>📅 Monthly Review</h3>
        <select className="input" style={{ width:'auto', fontSize:'.8rem', padding:'6px 10px' }} value={sel} onChange={e => setSel(e.target.value)}>
          {months.map(m => <option key={m} value={m}>{new Date(m+'-15').toLocaleString('default',{month:'long',year:'numeric'})}</option>)}
        </select>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:10, marginBottom:12 }}>
        {[
          { val:`${xpEarned.toLocaleString()} XP`, label:'Total XP', color:'var(--accent)' },
          { val:monthCIs.length, label:'Check-ins', color:'var(--text)' },
          { val:workouts, label:'Workouts', color:'var(--fire)' },
          { val:cleanDays, label:'Clean days', color:'#84CC16' },
        ].map(s => (
          <div key={s.label} style={{ textAlign:'center', background:'var(--bg-elevated)', borderRadius:12, padding:'12px 8px' }}>
            <div style={{ fontFamily:'var(--font-d)', fontSize:'1.5rem', fontWeight:900, color:s.color }}>{s.val}</div>
            <div style={{ color:'var(--text-dim)', fontSize:'.65rem', textTransform:'uppercase' }}>{s.label}</div>
          </div>
        ))}
      </div>
      {perfDays > 0 && <p style={{ color:'var(--gold)', fontSize:'.85rem', fontWeight:600 }}>⭐ {perfDays} perfect day{perfDays>1?'s':''} this month!</p>}
      {bestDay && <p style={{ color:'var(--text-dim)', fontSize:'.8rem', marginTop:6 }}>Best day: {new Date(bestDay.date).toLocaleDateString('en-IN')} (+{bestDay.xp_earned} XP)</p>}
    </div>
  )
}

// ── Settings Tab ───────────────────────────────────
function SettingsTab({ user, fullUser, changePin, logout, refreshUser }) {
  const { theme, toggleTheme }  = useTheme()
  const [curPin, setCurPin]     = useState('')
  const [newPin, setNewPin]     = useState('')
  const [pinMsg, setPinMsg]     = useState(null)
  const [notifTime, setNotifTime] = useState(getReminderTime())
  const [notifPerm, setNotifPerm] = useState(Notification?.permission ?? 'default')
  const [selAvatar, setSelAvatar] = useState(fullUser?.avatar_style ?? 'letter')
  const [selColor, setSelColor]   = useState(fullUser?.avatar_color ?? '#00FF87')
  const [savingAvatar, setSavingAvatar] = useState(false)
  const month = new Date().toISOString().slice(0, 7)
  const [penaltyAmt, setPenaltyAmt] = useState('')
  const [penaltyMsg, setPenaltyMsg] = useState(null)
  const [shopBusy, setShopBusy] = useState(false)
  const [buddyUsers, setBuddyUsers] = useState([])
  const [buddyId, setBuddyId] = useState('')
  const [buddyReqs, setBuddyReqs] = useState([])

  const SHOP_ITEMS = [
    { key: 'daily_shield', name: 'Daily Shield', xp: 250 },
    { key: 'junk_pass', name: 'Junk Pass (1/week)', xp: 500 },
    { key: 'weekly_shield', name: 'Weekly Shield', xp: 1000 },
    { key: 'team_change_token', name: 'Team Change Token', xp: 750 },
  ]

  useEffect(() => {
    supabase.from('users').select('id,username').neq('id', user.id).order('username').then(({ data }) => setBuddyUsers(data ?? []))
    loadBuddyRequests()
  }, [user.id])

  async function loadBuddyRequests() {
    const { data } = await supabase.from('buddy_requests').select('*, users!buddy_requests_requester_id_fkey(username)').eq('target_id', user.id).eq('status', 'pending')
    setBuddyReqs(data ?? [])
  }

  async function handlePinChange(e) {
    e.preventDefault()
    if (newPin.length !== 6) { setPinMsg({ ok:false, msg:'New PIN must be 6 digits.' }); return }
    const res = await changePin(curPin, newPin)
    setPinMsg(res.ok ? { ok:true, msg:'PIN changed! ✅' } : { ok:false, msg:res.error })
    if (res.ok) { setCurPin(''); setNewPin('') }
  }

  async function saveAvatar() {
    setSavingAvatar(true)
    await supabase.from('users').update({ avatar_style: selAvatar, avatar_color: selColor }).eq('id', user.id)
    setSavingAvatar(false)
    setPinMsg({ ok:true, msg:'Avatar updated! ✅' })
    setTimeout(() => setPinMsg(null), 2000)
  }

  async function logPenalty(e) {
    e.preventDefault()
    if (!penaltyAmt) return
    await supabase.from('penalty_pot').upsert({ user_id:user.id, month, amount:+penaltyAmt }, { onConflict:'user_id,month' })
    setPenaltyMsg('Logged! ✅')
    setTimeout(() => setPenaltyMsg(null), 2000)
  }

  async function buyItem(item) {
    if ((fullUser?.xp ?? 0) < item.xp) return
    setShopBusy(true)
    const remaining = (fullUser?.xp ?? 0) - item.xp
    const updates = { xp: remaining }
    if (item.key === 'team_change_token') updates.team_change_tokens = (fullUser?.team_change_tokens ?? 0) + 1
    await supabase.from('users').update(updates).eq('id', user.id)
    await supabase.from('xp_purchases').insert({ user_id: user.id, item_key: item.key, item_name: item.name, xp_spent: item.xp })
    await refreshUser()
    setShopBusy(false)
  }

  async function requestBuddy() {
    if (!buddyId) return
    await supabase.from('buddy_requests').upsert({ requester_id: user.id, target_id: buddyId, status: 'pending' }, { onConflict: 'requester_id,target_id' })
    setBuddyId('')
  }

  async function actOnBuddyRequest(req, accept) {
    await supabase.from('buddy_requests').update({ status: accept ? 'accepted' : 'rejected' }).eq('id', req.id)
    if (accept) {
      await supabase.from('users').update({ accountability_buddy_id: req.requester_id }).eq('id', user.id)
      await supabase.from('users').update({ accountability_buddy_id: user.id }).eq('id', req.requester_id)
    }
    loadBuddyRequests()
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

      {/* Theme toggle */}
      <div className="card">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <h3 style={{ fontFamily:'var(--font-d)', fontWeight:800, fontSize:'1rem' }}>
              {theme === 'dark' ? '🌙 Dark Mode' : '☀️ Light Mode'}
            </h3>
            <p style={{ color:'var(--text-dim)', fontSize:'.78rem', marginTop:2 }}>Toggle app theme</p>
          </div>
          <button className={`toggle ${theme === 'dark' ? 'on' : 'off'}`} onClick={toggleTheme} style={{ '--accent':'var(--purple)' }}>
            <div className="toggle-knob" />
          </button>
        </div>
      </div>

      {/* Avatar */}
      <div className="card">
        <h3 style={{ fontFamily:'var(--font-d)', fontWeight:800, fontSize:'1rem', marginBottom:12 }}>🎭 Avatar</h3>
        <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:14 }}>
          {AVATAR_STYLES.map(s => (
            <button key={s.key} type="button" onClick={() => setSelAvatar(s.key)}
              style={{
                width:44, height:44, borderRadius:12, fontSize:s.key==='letter'?'1rem':'1.4rem',
                display:'flex', alignItems:'center', justifyContent:'center',
                background: selAvatar===s.key ? 'var(--accent)' : 'var(--bg-elevated)',
                border:`2px solid ${selAvatar===s.key ? 'var(--accent)' : 'var(--border)'}`,
                color: selAvatar===s.key ? '#08080e' : 'var(--text)',
                transition:'all .15s',
              }}>
              {s.key === 'letter' ? user.username?.charAt(0).toUpperCase() : s.key}
            </button>
          ))}
        </div>
        <p style={{ color:'var(--text-dim)', fontSize:'.78rem', marginBottom:8 }}>Accent colour</p>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
          {AVATAR_COLORS.map(c => (
            <button key={c} type="button" onClick={() => setSelColor(c)}
              style={{ width:28, height:28, borderRadius:'50%', background:c, border:`3px solid ${selColor===c?'white':'transparent'}`, transition:'all .15s' }} />
          ))}
        </div>
        <button className="btn btn-primary btn-sm" onClick={saveAvatar} disabled={savingAvatar}>
          {savingAvatar ? '...' : 'Save Avatar'}
        </button>
      </div>

      {/* Change PIN */}
      <div className="card">
        <h3 style={{ fontFamily:'var(--font-d)', fontWeight:800, fontSize:'1rem', marginBottom:12 }}>🔐 Change PIN</h3>
        <form onSubmit={handlePinChange} style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <input className="input" type="password" inputMode="numeric" maxLength={6} placeholder="Current PIN" value={curPin} onChange={e => setCurPin(e.target.value.replace(/\D/g,'').slice(0,6))} />
          <input className="input" type="password" inputMode="numeric" maxLength={6} placeholder="New 6-digit PIN" value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g,'').slice(0,6))} />
          {pinMsg && <div style={{ fontSize:'.82rem', color:pinMsg.ok?'var(--accent)':'var(--fire)' }}>{pinMsg.msg}</div>}
          <button type="submit" className="btn btn-ghost btn-sm">Update PIN</button>
        </form>
      </div>

      {/* Notifications */}
      <div className="card">
        <h3 style={{ fontFamily:'var(--font-d)', fontWeight:800, fontSize:'1rem', marginBottom:12 }}>🔔 Reminders</h3>
        {notifPerm !== 'granted' ? (
          <button className="btn btn-primary btn-sm" onClick={async () => { const p = await requestPermission(); setNotifPerm(p) }}>Enable Notifications</button>
        ) : (
          <div style={{ display:'flex', gap:8 }}>
            <input className="input" type="time" value={notifTime} onChange={e => setNotifTime(e.target.value)} style={{ flex:1 }} />
            <button className="btn btn-ghost btn-sm" style={{ width:'auto' }} onClick={() => scheduleLocalReminder(notifTime)}>Save</button>
          </div>
        )}
      </div>

      <div className="card">
        <h3 style={{ fontFamily:'var(--font-d)', fontWeight:800, fontSize:'1rem', marginBottom:12 }}>🛒 XP Shop</h3>
        {SHOP_ITEMS.map(item => (
          <div key={item.key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
            <div>
              <div style={{ fontWeight:700, fontSize:'.9rem' }}>{item.name}</div>
              <div style={{ color:'var(--text-dim)', fontSize:'.72rem' }}>{item.xp} XP</div>
            </div>
            <button className="btn btn-ghost btn-xs" onClick={() => buyItem(item)} disabled={shopBusy || (fullUser?.xp ?? 0) < item.xp}>Buy</button>
          </div>
        ))}
      </div>

      <div className="card">
        <h3 style={{ fontFamily:'var(--font-d)', fontWeight:800, fontSize:'1rem', marginBottom:12 }}>🤝 Accountability Buddy</h3>
        <div style={{ display:'flex', gap:8, marginBottom:8 }}>
          <select className="input" value={buddyId} onChange={e => setBuddyId(e.target.value)}>
            <option value="">Select member</option>
            {buddyUsers.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
          </select>
          <button className="btn btn-ghost btn-sm" style={{ width:'auto' }} onClick={requestBuddy}>Send</button>
        </div>
        {!!buddyReqs.length && buddyReqs.map(req => (
          <div key={req.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0' }}>
            <span style={{ fontSize:'.85rem' }}>{req.users?.username} wants to be your buddy.</span>
            <div style={{ display:'flex', gap:6 }}>
              <button className="btn btn-primary btn-xs" onClick={() => actOnBuddyRequest(req, true)}>Accept</button>
              <button className="btn btn-ghost btn-xs" onClick={() => actOnBuddyRequest(req, false)}>Reject</button>
            </div>
          </div>
        ))}
      </div>

      {/* Penalty Pot */}
      <div className="card">
        <h3 style={{ fontFamily:'var(--font-d)', fontWeight:800, fontSize:'1rem', marginBottom:4 }}>💰 Penalty Pot</h3>
        <p style={{ color:'var(--text-dim)', fontSize:'.78rem', marginBottom:12 }}>Track your stake for {month}. Bottom scorer pays up!</p>
        <form onSubmit={logPenalty} style={{ display:'flex', gap:8 }}>
          <input className="input" type="number" placeholder="Amount (₹)" value={penaltyAmt} onChange={e => setPenaltyAmt(e.target.value)} style={{ flex:1 }} />
          <button type="submit" className="btn btn-ghost btn-sm" style={{ width:'auto' }}>Log</button>
        </form>
        {penaltyMsg && <p style={{ color:'var(--accent)', fontSize:'.82rem', marginTop:8 }}>{penaltyMsg}</p>}
      </div>

      <button className="btn btn-ghost" onClick={logout}>🚪 Log Out</button>
    </div>
  )
}

// ── Main ───────────────────────────────────────────
export default function Profile() {
  const { user, logout, changePin, refreshUser } = useAuth()
  const [tab, setTab]       = useState(0)
  const [fullUser, setFU]   = useState(null)
  const [streak, setStreak] = useState(null)
  const [checkIns, setCIs]  = useState([])
  const [stats, setStats]   = useState(null)
  const [loading, setL]     = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data:u }, { data:s }, { data:cis }] = await Promise.all([
        supabase.from('users').select('*').eq('id', user.id).single(),
        supabase.from('streaks').select('*').eq('user_id', user.id).single(),
        supabase.from('check_ins').select('*').eq('user_id', user.id).order('date',{ascending:false}).limit(90),
      ])
      setFU(u); setStreak(s); setCIs(cis??[])
      if (cis?.length) {
        const nr = cis.filter(c => !c.is_rest_day)
        const n  = nr.length || 1
        setStats({
          totalWorkouts: nr.filter(c => c.workout).length,
          avgWater:  (nr.reduce((s,c)=>s+c.water_glasses,0)/n).toFixed(1),
          avgMeals:  (nr.reduce((s,c)=>s+c.meals,0)/n).toFixed(1),
          avgSleep:  (nr.reduce((s,c)=>s+c.sleep_hours,0)/n).toFixed(1),
          cleanDays: cis.filter(c => c.no_junk).length,
          restDays:  cis.filter(c => c.is_rest_day).length,
        })
      }
      setL(false)
    }
    load()
  }, [user.id])

  return (
    <div className="page">
      <h1 className="page-title fade-up">Profile 👤</h1>
      <div className="tabs fade-up" style={{ marginBottom:20, animationDelay:'.05s', opacity:0 }}>
        {TABS.map((t,i) => <button key={t} className={`tab-btn ${tab===i?'active':''}`} onClick={() => setTab(i)}>{t}</button>)}
      </div>
      {loading ? <div className="spinner" /> : (
        <div className="fade-in">
          {tab===0 && <StatsTab user={user} fullUser={fullUser} streak={streak} stats={stats} checkIns={checkIns} />}
          {tab===1 && (
            <>
              <MonthlyReview userId={user.id} checkIns={checkIns} />
              <AnalyticsTab checkIns={checkIns} />
            </>
          )}
          {tab===2 && <BadgesTab userId={user.id} />}
          {tab===3 && <PRsTab userId={user.id} />}
          {tab===4 && <SettingsTab user={user} fullUser={fullUser} changePin={changePin} logout={logout} refreshUser={refreshUser} />}
        </div>
      )}
    </div>
  )
}
