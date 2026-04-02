import { useState } from 'react'
import { supabase } from '../lib/supabase'

const SLIDES = [
  {
    emoji: '🏋️',
    title: 'Welcome to FitPack',
    body: 'Your squad\'s fitness accountability hub. Log daily, earn XP, and level up together.',
    color: 'var(--accent)',
  },
  {
    emoji: '🔥',
    title: 'How Streaks Work',
    body: 'Log at least 3 check-ins per week to maintain your streak. Miss a full week and it resets — no recovery. Consistency is everything.',
    color: 'var(--fire)',
  },
  {
    emoji: '⚔️',
    title: 'Squad vs Squad',
    body: 'React to teammates\' check-ins, trash talk on the board, join a team, and defeat Boss Battles together. The crown goes to the weekly #1.',
    color: 'var(--purple)',
  },
]

export default function Onboarding({ userId, onDone }) {
  const [slide, setSlide] = useState(0)

  async function finish() {
    await supabase.from('users').update({ onboarded: true }).eq('id', userId)
    onDone()
  }

  const s = SLIDES[slide]
  const isLast = slide === SLIDES.length - 1

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 999,
      background: 'var(--bg)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: 32,
    }}>
      {/* Progress dots */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 48 }}>
        {SLIDES.map((_, i) => (
          <div key={i} style={{
            width: i === slide ? 24 : 8, height: 8,
            borderRadius: 99,
            background: i === slide ? s.color : 'var(--text-muted)',
            transition: 'all .3s',
          }} />
        ))}
      </div>

      {/* Content */}
      <div style={{ textAlign: 'center', maxWidth: 340 }} key={slide} className="fade-up">
        <div style={{ fontSize: '5rem', marginBottom: 24 }}>{s.emoji}</div>
        <h1 style={{
          fontFamily: 'var(--font-d)', fontSize: '2.4rem', fontWeight: 900,
          textTransform: 'uppercase', marginBottom: 16,
          color: s.color,
        }}>{s.title}</h1>
        <p style={{ color: 'var(--text-dim)', fontSize: '1rem', lineHeight: 1.7 }}>{s.body}</p>
      </div>

      {/* Buttons */}
      <div style={{ width: '100%', maxWidth: 340, marginTop: 48, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button
          className="btn"
          style={{ background: s.color, color: '#08080e' }}
          onClick={isLast ? finish : () => setSlide(s => s + 1)}
        >
          {isLast ? '🚀 Let\'s Go!' : 'Next →'}
        </button>
        {!isLast && (
          <button className="btn btn-ghost" onClick={finish} style={{ fontSize: '.9rem' }}>
            Skip
          </button>
        )}
      </div>
    </div>
  )
}
