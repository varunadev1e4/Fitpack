import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { getMondayISO } from '../lib/game'

export default function WeeklySummary({ userId, username }) {
  const [summary, setSummary] = useState(null)
  const [dismissed, setDismissed] = useState(false)

  // Only show on Mondays
  const isMonday = new Date().getDay() === 1
  const dismissKey = `fitpack_summary_dismissed_${getMondayISO()}`

  useEffect(() => {
    if (!isMonday) return
    if (localStorage.getItem(dismissKey)) { setDismissed(true); return }

    async function load() {
      // Last week = previous Mon–Sun
      const thisMonday = getMondayISO()
      const lastMonday = new Date(new Date(thisMonday).getTime() - 7 * 86400000).toISOString().slice(0, 10)
      const lastSunday = new Date(new Date(thisMonday).getTime() - 1 * 86400000).toISOString().slice(0, 10)

      const { data: cis } = await supabase
        .from('check_ins')
        .select('*')
        .eq('user_id', userId)
        .gte('date', lastMonday)
        .lte('date', lastSunday)

      if (!cis || !cis.length) return

      const xpEarned   = cis.reduce((s, c) => s + (c.xp_earned || 0), 0)
      const workouts   = cis.filter(c => c.workout).length
      const noJunkDays = cis.filter(c => c.no_junk).length
      const checkIns   = cis.length
      const perfectDays = cis.filter(c =>
        c.workout && c.meals >= 3 && c.water_glasses >= 6 && c.sleep_hours >= 6
      ).length

      // Squad rank for that week
      const { data: allCIs } = await supabase
        .from('check_ins')
        .select('user_id, xp_earned')
        .gte('date', lastMonday)
        .lte('date', lastSunday)

      const totals = {}
      ;(allCIs ?? []).forEach(c => { totals[c.user_id] = (totals[c.user_id] || 0) + c.xp_earned })
      const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1])
      const rank   = sorted.findIndex(([uid]) => uid === userId) + 1

      setSummary({ xpEarned, workouts, noJunkDays, checkIns, perfectDays, rank, total: sorted.length })
    }
    load()
  }, [userId])

  function dismiss() {
    localStorage.setItem(dismissKey, '1')
    setDismissed(true)
  }

  if (!isMonday || dismissed || !summary) return null

  return (
    <div className="card accent-border fade-up" style={{ marginBottom: 16, position: 'relative' }}>
      <button onClick={dismiss} style={{ position: 'absolute', top: 12, right: 14, color: 'var(--text-muted)', fontSize: '1.2rem' }}>×</button>
      <p style={{ fontFamily: 'var(--font-d)', fontSize: '.8rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>
        📊 Last Week in Review
      </p>
      <h3 style={{ fontFamily: 'var(--font-d)', fontSize: '1.6rem', fontWeight: 900, marginBottom: 14 }}>
        You earned {summary.xpEarned.toLocaleString()} XP 🔥
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
        {[
          { val: summary.checkIns,   label: 'Check-ins', icon: '✅' },
          { val: summary.workouts,   label: 'Workouts',  icon: '💪' },
          { val: summary.noJunkDays, label: 'Clean days', icon: '🥗' },
        ].map(s => (
          <div key={s.label} style={{ textAlign: 'center', background: 'var(--bg-elevated)', borderRadius: 12, padding: '10px 6px' }}>
            <div style={{ fontSize: '1.1rem' }}>{s.icon}</div>
            <div style={{ fontFamily: 'var(--font-d)', fontSize: '1.5rem', fontWeight: 900 }}>{s.val}</div>
            <div style={{ color: 'var(--text-dim)', fontSize: '.65rem', textTransform: 'uppercase' }}>{s.label}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: 'var(--text-dim)', fontSize: '.85rem' }}>
          {summary.perfectDays > 0 && `⭐ ${summary.perfectDays} perfect day${summary.perfectDays > 1 ? 's' : ''} · `}
          Squad rank #{summary.rank} of {summary.total}
        </span>
        {summary.rank === 1 && <span className="pill pill-gold">👑 KING</span>}
      </div>
    </div>
  )
}
