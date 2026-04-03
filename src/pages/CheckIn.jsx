import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import {
  calculateXP, calcWeeklyStreak, BADGE_CHECKS, WORKOUT_TYPES,
  getMondayISO, MAX_REST_DAYS_PER_WEEK, MOODS, getNewMilestones,
  isComeback, calcJunkStreak
} from '../lib/game'
import { haptic } from '../lib/haptics'

function Stepper({ value, onChange, min=0, max=20 }) {
  return (
    <div className="stepper">
      <button type="button" className="stepper-btn" onClick={() => onChange(Math.max(min, value-1))}>−</button>
      <span className="stepper-val">{value}</span>
      <button type="button" className="stepper-btn" onClick={() => onChange(Math.min(max, value+1))}>+</button>
    </div>
  )
}

function SleepStepper({ value, onChange }) {
  return (
    <div className="stepper">
      <button type="button" className="stepper-btn" onClick={() => onChange(Math.max(0, +(value-.5).toFixed(1)))}>−</button>
      <span className="stepper-val">{value}h</span>
      <button type="button" className="stepper-btn" onClick={() => onChange(Math.min(24, +(value+.5).toFixed(1)))}>+</button>
    </div>
  )
}

function XPPopup({ result, onClose }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.85)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }} onClick={onClose}>
      <div className="card accent-border fade-up" style={{ width:'100%', maxWidth:360 }} onClick={e => e.stopPropagation()}>
        <div style={{ textAlign:'center', marginBottom:16 }}>
          {result.isPerfect && <div style={{ fontSize:'3rem', marginBottom:8 }}>⭐</div>}
          {result.weekComplete && <div style={{ fontSize:'1.8rem', marginBottom:4 }}>🔥 Week Complete!</div>}
          {result.isComeback && <div style={{ fontSize:'1.8rem', marginBottom:4 }}>⚡ Comeback!</div>}
          <h2 style={{ fontFamily:'var(--font-d)', fontSize:'2.4rem', fontWeight:900, color:'var(--accent)' }}>+{result.xp.total} XP</h2>
          <p style={{ color:'var(--text-dim)', fontSize:'.9rem' }}>{result.isPerfect ? 'PERFECT DAY! 🔥' : 'Logged!'}</p>
        </div>
        <div className="divider" />
        {result.xp.breakdown.map((b, i) => (
          <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', fontSize:'.9rem' }}>
            <span style={{ color:'var(--text-dim)' }}>{b.label}</span>
            <span style={{ color:'var(--accent)', fontWeight:700 }}>+{b.xp}</span>
          </div>
        ))}
        {result.milestones?.map(m => (
          <div key={m.threshold} style={{ background:'rgba(245,158,11,.1)', borderRadius:10, padding:'10px 14px', marginTop:10, border:'1px solid rgba(245,158,11,.3)' }}>
            <div style={{ fontFamily:'var(--font-d)', fontWeight:900, color:'var(--gold)' }}>🎯 {m.threshold.toLocaleString()} XP Milestone!</div>
            <div style={{ color:'var(--text-dim)', fontSize:'.78rem' }}>+{m.bonus} bonus XP awarded</div>
          </div>
        ))}
        {result.newBadges?.length > 0 && (
          <>
            <div className="divider" />
            <p style={{ fontFamily:'var(--font-d)', fontWeight:700, marginBottom:8 }}>🏅 BADGES UNLOCKED</p>
            {result.newBadges.map(b => (
              <div key={b.slug} style={{ display:'flex', alignItems:'center', gap:10, padding:'6px 0' }}>
                <span style={{ fontSize:'1.5rem' }}>{b.icon}</span>
                <div>
                  <div style={{ fontWeight:700, fontSize:'.95rem' }}>{b.name}</div>
                  <div style={{ color:'var(--text-dim)', fontSize:'.75rem' }}>{b.description}</div>
                </div>
              </div>
            ))}
          </>
        )}
        <div className="divider" />
        <button className="btn btn-primary" onClick={onClose}>🚀 Hell yeah!</button>
      </div>
    </div>
  )
}

export default function CheckIn() {
  const { user, refreshUser } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const prefill  = location.state?.prefill

  const today = new Date().toISOString().slice(0, 10)

  const [existing, setExisting]           = useState(null)
  const [submitting, setSubmitting]       = useState(false)
  const [loading, setLoading]             = useState(true)
  const [result, setResult]               = useState(null)
  const [showEntries, setShowEntries]     = useState(false)
  const [weekRestCount, setWeekRestCount] = useState(0)
  const [squadMembers, setSquadMembers]   = useState([])
  const [comebackFlag, setComebackFlag]   = useState(false)

  const [form, setForm] = useState({
    is_rest_day: false, workout: false, workout_type: '', workout_notes: '',
    workout_entries: [], meals: 3, water_glasses: 6, sleep_hours: 7,
    no_junk: false, mood: null, shoutout_to: null, shoutout_msg: '',
  })

  const [newEntry, setNewEntry] = useState({ exercise:'', sets:'', reps:'', weight:'' })

  useEffect(() => {
    async function load() {
      const monday = getMondayISO()
      const sunday = new Date(new Date(monday).getTime() + 6 * 86400000).toISOString().slice(0, 10)

      const [{ data: existingCI }, { data: weekCIs }, { data: recentCIs }, { data: members }] = await Promise.all([
        supabase.from('check_ins').select('*').eq('user_id', user.id).eq('date', today).maybeSingle(),
        supabase.from('check_ins').select('date, is_rest_day').eq('user_id', user.id).gte('date', monday).lte('date', sunday),
        supabase.from('check_ins').select('date').eq('user_id', user.id).order('date', { ascending: false }).limit(10),
        supabase.from('users').select('id, username').neq('id', user.id).order('username').limit(30),
      ])

      if (existingCI) {
        setExisting(existingCI)
        setForm({
          is_rest_day: existingCI.is_rest_day, workout: existingCI.workout,
          workout_type: existingCI.workout_type ?? '', workout_notes: existingCI.workout_notes ?? '',
          workout_entries: existingCI.workout_entries ?? [], meals: existingCI.meals,
          water_glasses: existingCI.water_glasses, sleep_hours: existingCI.sleep_hours,
          no_junk: existingCI.no_junk ?? false, mood: existingCI.mood ?? null,
          shoutout_to: existingCI.shoutout_to ?? null, shoutout_msg: existingCI.shoutout_msg ?? '',
        })
      } else if (prefill) {
        setForm(f => ({ ...f, workout: prefill.workout, workout_type: prefill.workout_type ?? '', meals: prefill.meals, water_glasses: prefill.water_glasses, sleep_hours: prefill.sleep_hours }))
      }

      setWeekRestCount((weekCIs ?? []).filter(c => c.is_rest_day && c.date !== today).length)
      setSquadMembers(members ?? [])
      setComebackFlag(isComeback(recentCIs ?? []))
      setLoading(false)
    }
    load()
  }, [user.id])

  function set(key, val) { setForm(f => ({ ...f, [key]: val })) }

  function addEntry() {
    if (!newEntry.exercise) return
    set('workout_entries', [...form.workout_entries, { ...newEntry }])
    setNewEntry({ exercise:'', sets:'', reps:'', weight:'' })
  }

  function removeEntry(i) { set('workout_entries', form.workout_entries.filter((_, idx) => idx !== i)) }

  const restDayLimitHit = !form.is_rest_day && weekRestCount >= MAX_REST_DAYS_PER_WEEK

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    haptic('medium')

    const xpResult  = calculateXP(form, { comeback: comebackFlag && !existing })
    const streakRow = (await supabase.from('streaks').select('*').eq('user_id', user.id).maybeSingle()).data
    const isNewDailyLog = !existing
    const countsForWeek = isNewDailyLog && !form.is_rest_day
    const { newStreak, newLongest, newWeekCheckins, newWeekId, weekJustCompleted } = calcWeeklyStreak(streakRow, { countsForWeek })

    await supabase.from('check_ins').upsert({
      user_id: user.id, date: today,
      is_rest_day: form.is_rest_day, workout: form.workout,
      workout_type: form.workout_type, workout_notes: form.workout_notes,
      workout_entries: form.workout_entries, meals: form.meals,
      water_glasses: form.water_glasses, sleep_hours: form.sleep_hours,
      no_junk: form.no_junk, mood: form.mood,
      shoutout_to: form.shoutout_to || null, shoutout_msg: form.shoutout_msg || null,
      xp_earned: xpResult.total,
    }, { onConflict:'user_id,date' })

    await supabase.from('streaks').upsert({
      user_id: user.id, current_streak: newStreak, longest_streak: newLongest,
      current_week_id: newWeekId, current_week_checkins: newWeekCheckins,
    }, { onConflict:'user_id' })

    const oldXP = existing?.xp_earned ?? 0
    const { data: cu } = await supabase.from('users').select('xp').eq('id', user.id).single()
    const preXP = cu?.xp ?? 0
    let newXP   = preXP + xpResult.total - oldXP

    // Milestone XP bonuses
    const milestones = getNewMilestones(preXP, newXP)
    let milestoneBonus = 0
    for (const m of milestones) {
      const { data: already } = await supabase.from('milestone_log').select('id').eq('user_id', user.id).eq('milestone', m.threshold).single()
      if (!already) {
        milestoneBonus += m.bonus
        await supabase.from('milestone_log').insert({ user_id: user.id, milestone: m.threshold })
      }
    }
    newXP += milestoneBonus

    // Comeback bonus log
    if (comebackFlag && !existing) {
      await supabase.from('comeback_log').upsert({ user_id: user.id, date: today }, { onConflict:'user_id,date' })
    }

    await supabase.from('users').update({ xp: newXP }).eq('id', user.id)

    // Junk streak update
    const { data: recentCIs } = await supabase.from('check_ins').select('no_junk, date').eq('user_id', user.id).order('date', { ascending: false }).limit(60)
    const junkStreak = calcJunkStreak(recentCIs ?? [])
    await supabase.from('users').update({ junk_streak: junkStreak, best_week_xp: Math.max(cu?.best_week_xp ?? 0, 0) }).eq('id', user.id)

    // Badge checks
    const [ciCount, wkCount, rxnCount, ttCount, restCount, moodCount, spinCount, ubRows, goalCount, shoutCount, postCount] = await Promise.all([
      supabase.from('check_ins').select('id', {count:'exact'}).eq('user_id', user.id),
      supabase.from('check_ins').select('id', {count:'exact'}).eq('user_id', user.id).eq('workout', true),
      supabase.from('reactions').select('id', {count:'exact'}).eq('user_id', user.id),
      supabase.from('trash_talk').select('id', {count:'exact'}).eq('user_id', user.id),
      supabase.from('check_ins').select('id', {count:'exact'}).eq('user_id', user.id).eq('is_rest_day', true),
      supabase.from('check_ins').select('id', {count:'exact'}).eq('user_id', user.id).not('mood', 'is', null),
      supabase.from('spin_results').select('id', {count:'exact'}).eq('user_id', user.id).eq('completed', true),
      supabase.from('user_badges').select('badge_id, badges(slug)').eq('user_id', user.id),
      supabase.from('weekly_goals').select('id', {count:'exact'}).eq('user_id', user.id).eq('achieved', true),
      supabase.from('check_ins').select('id', {count:'exact'}).eq('user_id', user.id).not('shoutout_to', 'is', null),
      supabase.from('squad_posts').select('id', {count:'exact'}).eq('user_id', user.id),
    ])

    const existingSlugs = (ubRows.data ?? []).map(b => b.badges?.slug)
    const totalCheckIns = ciCount.count ?? 0
    const consistency   = Math.round((totalCheckIns / 30) * 100)

    const stats = {
      totalCheckIns, currentStreak: newStreak,
      totalWorkouts: wkCount.count ?? 0, latestWater: form.water_glasses,
      latestSleep: form.sleep_hours, latestPerfectDay: xpResult.isPerfect,
      consistency, weekJustCompleted, totalReactions: rxnCount.count ?? 0,
      totalTrashTalk: ttCount.count ?? 0, totalRestDays: restCount.count ?? 0,
      junkStreak, totalMoods: moodCount.count ?? 0, completedSpins: spinCount.count ?? 0,
      achievedGoals: goalCount.count ?? 0, totalShoutouts: shoutCount.count ?? 0,
      squadPosts: postCount.count ?? 0, totalXP: newXP,
      isComeback: comebackFlag && !existing,
    }

    const allBadges = (await supabase.from('badges').select('*')).data ?? []
    const newBadges = []

    for (const badge of allBadges) {
      if (existingSlugs.includes(badge.slug)) continue
      const check = BADGE_CHECKS[badge.slug]
      if (check && check(stats)) {
        await supabase.from('user_badges').insert({ user_id: user.id, badge_id: badge.id })
        newBadges.push(badge)
      }
    }

    // Challenge progress
    const { data: chs } = await supabase.from('challenges').select('*').eq('active', true).eq('approved', true).lte('start_date', today).gte('end_date', today)
    for (const ch of chs ?? []) {
      let prog = 0
      if (ch.metric === 'workouts' && form.workout) prog = 1
      if (ch.metric === 'water')   prog = form.water_glasses
      if (ch.metric === 'meals')   prog = form.meals
      if (ch.metric === 'sleep' && form.sleep_hours >= 7) prog = 1
      if (prog > 0) {
        const { data: cp } = await supabase.from('challenge_progress').select('*').eq('challenge_id', ch.id).eq('user_id', user.id).single()
        await supabase.from('challenge_progress').upsert({ challenge_id: ch.id, user_id: user.id, progress: (cp?.progress ?? 0) + prog }, { onConflict:'challenge_id,user_id' })
      }
    }

    await refreshUser()
    haptic(newBadges.length ? 'badge' : 'success')
    setExisting({ ...form, xp_earned: xpResult.total })
    setResult({ xp: xpResult, isPerfect: xpResult.isPerfect, weekComplete: weekJustCompleted, isComeback: comebackFlag && !existing, newBadges, milestones: milestones.filter(m => milestoneBonus > 0) })
    setSubmitting(false)
  }

  if (loading) return <div className="page"><div className="spinner" /></div>

  return (
    <div className="page">
      <h1 className="page-title fade-up">{existing ? 'Update' : "Today's"} Log 📋</h1>
      <p style={{ color:'var(--text-dim)', fontSize:'.88rem', marginBottom: comebackFlag && !existing ? 8 : 20 }} className="fade-up">
        {new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long' })}
        {prefill && !existing && <span style={{ color:'var(--accent)', marginLeft:8 }}>⚡ Pre-filled</span>}
      </p>

      {comebackFlag && !existing && (
        <div className="card fade-up" style={{ marginBottom:16, background:'rgba(139,92,246,.08)', borderColor:'rgba(139,92,246,.3)' }}>
          <p style={{ color:'var(--purple)', fontWeight:700, fontSize:'.9rem' }}>
            ⚡ Comeback Bonus! +50 XP for returning after 7+ days!
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:12 }}>

        {/* Mood */}
        <div className="card fade-up" style={{ animationDelay:'.03s', opacity:0 }}>
          <div style={{ fontFamily:'var(--font-d)', fontSize:'1.1rem', fontWeight:800, marginBottom:12 }}>How are you feeling? (+5 XP)</div>
          <div style={{ display:'flex', justifyContent:'space-between' }}>
            {MOODS.map(m => (
              <button key={m.key} type="button" onClick={() => { set('mood', form.mood === m.key ? null : m.key); haptic('light') }}
                style={{
                  display:'flex', flexDirection:'column', alignItems:'center', gap:4, padding:'8px 6px', borderRadius:12,
                  background: form.mood === m.key ? 'var(--accent-glow)' : 'transparent',
                  border: `1px solid ${form.mood === m.key ? 'var(--accent)' : 'transparent'}`,
                  transition:'all .15s', flex:1, cursor:'pointer',
                }}>
                <span style={{ fontSize:'1.6rem' }}>{m.emoji}</span>
                <span style={{ fontSize:'.6rem', color: form.mood === m.key ? 'var(--accent)' : 'var(--text-muted)', fontWeight:600 }}>{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Rest Day */}
        <div className={`card fade-up ${form.is_rest_day ? 'purple-border' : ''}`} style={{ animationDelay:'.06s', opacity:0 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <div style={{ fontFamily:'var(--font-d)', fontSize:'1.2rem', fontWeight:800 }}>🧘 Rest Day</div>
              <div style={{ color:'var(--text-dim)', fontSize:'.78rem' }}>
                Recovery · +20 XP · <span style={{ color: weekRestCount >= MAX_REST_DAYS_PER_WEEK ? 'var(--fire)' : 'var(--text-muted)' }}>
                  {weekRestCount}/{MAX_REST_DAYS_PER_WEEK} this week
                </span>
              </div>
              {restDayLimitHit && <div style={{ marginTop:4, fontSize:'.73rem', color:'var(--fire)', fontWeight:600 }}>⛔ Limit reached this week</div>}
            </div>
            <button type="button" className={`toggle ${form.is_rest_day ? 'on' : 'off'}`}
              onClick={() => { if (restDayLimitHit) return; haptic('light'); setForm(f => ({ ...f, is_rest_day: !f.is_rest_day, workout: false })) }}
              style={{ opacity: restDayLimitHit ? .4 : 1, cursor: restDayLimitHit ? 'not-allowed' : 'pointer', '--accent':'#8B5CF6' }}>
              <div className="toggle-knob" />
            </button>
          </div>
        </div>

        {!form.is_rest_day && (<>
          {/* Workout */}
          <div className={`card fade-up ${form.workout ? 'accent-border' : ''}`} style={{ animationDelay:'.09s', opacity:0 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: form.workout ? 14 : 0 }}>
              <div>
                <div style={{ fontFamily:'var(--font-d)', fontSize:'1.2rem', fontWeight:800 }}>💪 Workout</div>
                <div style={{ color:'var(--text-dim)', fontSize:'.78rem' }}>+50 XP</div>
              </div>
              <button type="button" className={`toggle ${form.workout ? 'on' : 'off'}`} onClick={() => { haptic('light'); set('workout', !form.workout) }}>
                <div className="toggle-knob" />
              </button>
            </div>
            {form.workout && (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                  {WORKOUT_TYPES.map(wt => (
                    <button key={wt.value} type="button" onClick={() => set('workout_type', wt.value)}
                      style={{
                        padding:'6px 12px', borderRadius:99, fontSize:'.8rem', fontWeight:600,
                        background: form.workout_type === wt.value ? wt.color : 'var(--bg-elevated)',
                        color: form.workout_type === wt.value ? '#08080e' : 'var(--text-dim)',
                        border:`1px solid ${form.workout_type === wt.value ? 'transparent' : 'var(--border)'}`,
                        transition:'all .15s',
                      }}>{wt.label}</button>
                  ))}
                </div>
                <input className="input" placeholder="Notes (optional)" value={form.workout_notes} onChange={e => set('workout_notes', e.target.value)} />
                <button type="button" onClick={() => setShowEntries(v => !v)}
                  style={{ textAlign:'left', color:'var(--accent)', fontSize:'.82rem', fontWeight:600, padding:0 }}>
                  {showEntries ? '▼' : '▶'} Log sets & reps (+10 XP)
                </button>
                {showEntries && (
                  <div style={{ background:'var(--bg-elevated)', borderRadius:12, padding:14 }}>
                    {form.workout_entries.map((e, i) => (
                      <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 0', borderBottom:'1px solid var(--border)', fontSize:'.82rem' }}>
                        <span style={{ flex:1 }}>{e.exercise}</span>
                        <span style={{ color:'var(--text-dim)' }}>{e.sets}×{e.reps}{e.weight ? ` @${e.weight}kg` : ''}</span>
                        <button type="button" onClick={() => removeEntry(i)} style={{ color:'var(--fire)' }}>×</button>
                      </div>
                    ))}
                    <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr', gap:6, marginTop:10 }}>
                      {[['Exercise','exercise','text'],['Sets','sets','number'],['Reps','reps','number'],['kg','weight','number']].map(([ph, key, type]) => (
                        <input key={key} className="input" style={{ padding:'8px 10px', fontSize:'.8rem' }} placeholder={ph} type={type} value={newEntry[key]} onChange={e => setNewEntry(n => ({...n, [key]:e.target.value}))} />
                      ))}
                    </div>
                    <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop:8 }} onClick={addEntry}>+ Add Exercise</button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Meals */}
          <div className="card fade-up" style={{ animationDelay:'.12s', opacity:0 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div><div style={{ fontFamily:'var(--font-d)', fontSize:'1.2rem', fontWeight:800 }}>🍽 Meals</div><div style={{ color:'var(--text-dim)', fontSize:'.78rem' }}>up to +50 XP</div></div>
              <Stepper value={form.meals} onChange={v => set('meals', v)} max={5} />
            </div>
          </div>

          {/* Water */}
          <div className="card fade-up" style={{ animationDelay:'.15s', opacity:0 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div><div style={{ fontFamily:'var(--font-d)', fontSize:'1.2rem', fontWeight:800 }}>💧 Water</div><div style={{ color:'var(--text-dim)', fontSize:'.78rem' }}>glasses · up to +40 XP</div></div>
              <Stepper value={form.water_glasses} onChange={v => set('water_glasses', v)} max={20} />
            </div>
            <div style={{ display:'flex', gap:3, marginTop:8, flexWrap:'wrap' }}>
              {Array.from({ length: Math.min(form.water_glasses, 12) }).map((_,i) => (
                <div key={i} style={{ width:9, height:9, borderRadius:'50%', background:'var(--accent)', opacity:.5+i*.04 }} />
              ))}
            </div>
          </div>

          {/* Sleep */}
          <div className="card fade-up" style={{ animationDelay:'.18s', opacity:0 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div><div style={{ fontFamily:'var(--font-d)', fontSize:'1.2rem', fontWeight:800 }}>😴 Sleep</div><div style={{ color:'var(--text-dim)', fontSize:'.78rem' }}>last night · +20 XP</div></div>
              <SleepStepper value={form.sleep_hours} onChange={v => set('sleep_hours', v)} />
            </div>
          </div>
        </>)}

        {/* No Junk */}
        <div className={`card fade-up ${form.no_junk ? 'accent-border' : ''}`} style={{ animationDelay:'.21s', opacity:0, cursor:'pointer' }} onClick={() => { haptic('light'); set('no_junk', !form.no_junk) }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <div style={{ fontFamily:'var(--font-d)', fontSize:'1.2rem', fontWeight:800 }}>🥗 No Junk Food</div>
              <div style={{ color:'var(--text-dim)', fontSize:'.78rem' }}>Ate clean all day · +10 XP</div>
            </div>
            <div style={{ width:28, height:28, borderRadius:8, flexShrink:0, background:form.no_junk?'var(--accent)':'var(--bg-elevated)', border:`2px solid ${form.no_junk?'var(--accent)':'var(--border)'}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1rem', transition:'all .15s', color:'#08080e', fontWeight:900 }}>
              {form.no_junk ? '✓' : ''}
            </div>
          </div>
        </div>

        {/* Shoutout */}
        <div className="card fade-up" style={{ animationDelay:'.24s', opacity:0 }}>
          <div style={{ fontFamily:'var(--font-d)', fontSize:'1.1rem', fontWeight:800, marginBottom:10 }}>🙌 Shoutout (optional)</div>
          <select className="input" style={{ marginBottom:8 }} value={form.shoutout_to ?? ''} onChange={e => set('shoutout_to', e.target.value || null)}>
            <option value="">Tag a teammate...</option>
            {squadMembers.map(m => <option key={m.id} value={m.id}>{m.username}</option>)}
          </select>
          {form.shoutout_to && (
            <input className="input" placeholder="Add a message..." value={form.shoutout_msg} onChange={e => set('shoutout_msg', e.target.value.slice(0, 100))} />
          )}
        </div>

        {/* XP Preview */}
        <div className="card fade-up" style={{ animationDelay:'.27s', opacity:0, background:'var(--accent-glow)', borderColor:'rgba(0,255,135,.2)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ color:'var(--text-dim)', fontSize:'.9rem' }}>XP Preview</span>
            <span style={{ fontFamily:'var(--font-d)', fontSize:'1.6rem', fontWeight:900, color:'var(--accent)' }}>
              +{calculateXP(form, { comeback: comebackFlag && !existing }).total} XP
            </span>
          </div>
        </div>

        <button type="submit" className="btn btn-primary fade-up" style={{ marginTop:6, animationDelay:'.3s', opacity:0 }} disabled={submitting}>
          {submitting ? '⏳ Saving...' : existing ? '🔄 Update Log' : '✅ Submit Check-In'}
        </button>
      </form>

      {result && <XPPopup result={result} onClose={() => { setResult(null); navigate('/') }} />}
    </div>
  )
}
