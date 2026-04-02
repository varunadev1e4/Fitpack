import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'

export default function Login() {
  const { login, loading, error } = useAuth()
  const [username, setUsername] = useState('')
  const [pin, setPin] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    await login(username.trim(), pin)
  }

  return (
    <div style={{
      minHeight:'100dvh', display:'flex', flexDirection:'column',
      justifyContent:'center', padding:'32px 24px',
      background:'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(0,255,135,.07) 0%, transparent 70%)',
    }}>
      <div style={{ textAlign:'center', marginBottom:48 }} className="fade-up">
        <div style={{ fontSize:'3.5rem', marginBottom:8 }}>🏋️</div>
        <h1 style={{
          fontFamily:'var(--font-d)', fontSize:'3.2rem', fontWeight:900,
          textTransform:'uppercase', letterSpacing:'.06em',
          background:'linear-gradient(135deg, #00FF87, #00cfff)',
          WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
        }}>FitPack</h1>
        <p style={{ color:'var(--text-dim)', fontSize:'.9rem', marginTop:6 }}>
          Squad accountability. Leveled up. 🔥
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:16 }}>
        <div className="fade-up" style={{ animationDelay:'.08s', opacity:0 }}>
          <label className="input-label">Username</label>
          <input
            className="input"
            placeholder="your_username"
            value={username}
            onChange={e => setUsername(e.target.value.toLowerCase().replace(/\s/g,'_'))}
            autoCapitalize="none" autoCorrect="off" required
          />
        </div>

        <div className="fade-up" style={{ animationDelay:'.14s', opacity:0 }}>
          <label className="input-label">6-Digit PIN</label>
          <input
            className="input"
            type="password"
            inputMode="numeric"
            maxLength={6}
            placeholder="● ● ● ● ● ●"
            value={pin}
            onChange={e => setPin(e.target.value.replace(/\D/g,'').slice(0,6))}
            required
          />
          <p style={{ color:'var(--text-muted)', fontSize:'.73rem', marginTop:5, paddingLeft:4 }}>
            New here? Your account is created automatically.
          </p>
        </div>

        {error && (
          <div style={{ background:'rgba(255,80,80,.1)', border:'1px solid rgba(255,80,80,.25)', borderRadius:12, padding:'12px 16px', color:'#ff6b6b', fontSize:'.9rem' }}>
            {error}
          </div>
        )}

        <div className="fade-up" style={{ animationDelay:'.2s', opacity:0, marginTop:8 }}>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || username.length < 2 || pin.length !== 6}
          >
            {loading ? '⏳ Hold on...' : '⚡ Let\'s Go'}
          </button>
        </div>
      </form>

      <p style={{ textAlign:'center', color:'var(--text-muted)', fontSize:'.73rem', marginTop:32 }}>
        Share your username with the squad 🤝
      </p>
    </div>
  )
}
