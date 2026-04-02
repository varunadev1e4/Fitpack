import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { getRandomSpin } from '../lib/game'
import { haptic } from '../lib/haptics'

export default function SpinWheel({ userId, onClose }) {
  const [phase, setPhase]       = useState('idle')   // idle | spinning | result | done | already
  const [result, setResult]     = useState(null)
  const [existing, setExisting] = useState(null)
  const [angle, setAngle]       = useState(0)
  const [saving, setSaving]     = useState(false)

  const today = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    supabase.from('spin_results').select('*').eq('user_id', userId).eq('date', today).single()
      .then(({ data }) => {
        if (data) { setExisting(data); setPhase('already') }
      })
  }, [userId])

  function spin() {
    if (phase !== 'idle') return
    setPhase('spinning')
    haptic('spin')
    const picked = getRandomSpin()
    // Spin animation
    let ticks = 0
    const total = 30 + Math.floor(Math.random() * 20)
    const interval = setInterval(() => {
      ticks++
      setAngle(a => a + (360 / 8))
      if (ticks >= total) {
        clearInterval(interval)
        setResult(picked)
        setPhase('result')
        haptic('success')
      }
    }, 80)
  }

  async function markComplete() {
    setSaving(true)
    await supabase.from('spin_results').update({ completed: true }).eq('user_id', userId).eq('date', today)
    // Award XP
    const { data: u } = await supabase.from('users').select('xp').eq('id', userId).single()
    await supabase.from('users').update({ xp: (u?.xp ?? 0) + (existing?.xp_bonus ?? result?.xp ?? 0) }).eq('id', userId)
    haptic('badge')
    setSaving(false)
    onClose(true)
  }

  async function saveAndClose() {
    setSaving(true)
    await supabase.from('spin_results').insert({
      user_id: userId, date: today,
      challenge: result.label, xp_bonus: result.xp, completed: false,
    })
    setSaving(false)
    onClose(false)
  }

  const SEGMENTS = ['🏋️','🥗','💧','😴','🏃','🎯','💪','⚡']

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.9)', zIndex: 300,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: 24,
    }}>
      <div className="card accent-border fade-up" style={{ width: '100%', maxWidth: 360, textAlign: 'center' }}>
        <h2 style={{ fontFamily: 'var(--font-d)', fontSize: '1.8rem', fontWeight: 900, marginBottom: 4 }}>
          🎰 Daily Spin
        </h2>
        <p style={{ color: 'var(--text-dim)', fontSize: '.82rem', marginBottom: 20 }}>
          Complete the challenge for bonus XP!
        </p>

        {/* Wheel visual */}
        <div style={{
          width: 180, height: 180, margin: '0 auto 20px',
          borderRadius: '50%', position: 'relative', overflow: 'hidden',
          border: '4px solid var(--accent)',
          transform: `rotate(${angle}deg)`,
          transition: phase === 'spinning' ? 'none' : 'transform .5s ease',
          display: 'flex', flexWrap: 'wrap',
        }}>
          {SEGMENTS.map((s, i) => (
            <div key={i} style={{
              width: '50%', height: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '2rem',
              background: i % 2 === 0 ? 'var(--bg-elevated)' : 'var(--bg-card)',
            }}>{s}</div>
          ))}
        </div>

        {phase === 'idle' && (
          <>
            <button className="btn btn-primary" onClick={spin}>🎰 Spin!</button>
            <button className="btn btn-ghost" style={{ marginTop: 8 }} onClick={() => onClose(false)}>Not now</button>
          </>
        )}

        {phase === 'spinning' && (
          <p style={{ color: 'var(--accent)', fontFamily: 'var(--font-d)', fontSize: '1.3rem', fontWeight: 800 }}>
            Spinning...
          </p>
        )}

        {phase === 'result' && result && (
          <>
            <div style={{ padding: '16px', background: 'var(--accent-glow)', borderRadius: 14, marginBottom: 16 }}>
              <p style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 6 }}>Today's challenge:</p>
              <p style={{ fontFamily: 'var(--font-d)', fontSize: '1.3rem', fontWeight: 900, color: 'var(--accent)' }}>
                {result.label}
              </p>
              <p style={{ color: 'var(--gold)', fontWeight: 700, marginTop: 8 }}>+{result.xp} XP on completion!</p>
            </div>
            <button className="btn btn-primary" onClick={saveAndClose} disabled={saving}>
              {saving ? '...' : '✅ I accept this challenge!'}
            </button>
            <button className="btn btn-ghost" style={{ marginTop: 8 }} onClick={() => onClose(false)}>Skip</button>
          </>
        )}

        {phase === 'already' && existing && (
          <>
            <div style={{ padding: '16px', background: 'var(--accent-glow)', borderRadius: 14, marginBottom: 16 }}>
              <p style={{ color: 'var(--text-dim)', fontSize: '.82rem', marginBottom: 6 }}>Today's challenge:</p>
              <p style={{ fontFamily: 'var(--font-d)', fontSize: '1.2rem', fontWeight: 900 }}>{existing.challenge}</p>
              <p style={{ color: 'var(--gold)', fontWeight: 700, marginTop: 8 }}>+{existing.xp_bonus} XP</p>
            </div>
            {!existing.completed ? (
              <button className="btn btn-primary" onClick={markComplete} disabled={saving}>
                {saving ? '...' : '🏆 Mark as Complete!'}
              </button>
            ) : (
              <div style={{ color: 'var(--accent)', fontWeight: 700 }}>✅ Challenge completed today!</div>
            )}
            <button className="btn btn-ghost" style={{ marginTop: 8 }} onClick={() => onClose(false)}>Close</button>
          </>
        )}
      </div>
    </div>
  )
}
