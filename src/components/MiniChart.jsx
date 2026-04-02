// Simple SVG-based charts - no dependencies

export function LineChart({ data = [], color = 'var(--accent)', height = 80, label = '' }) {
  if (!data.length) return null
  const W = 300, H = height
  const max = Math.max(...data.map(d => d.value), 1)
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * (W - 20) + 10
    const y = H - ((d.value / max) * (H - 20)) - 10
    return `${x},${y}`
  })
  const path = `M ${pts.join(' L ')}`
  const area = `M ${pts[0]} L ${pts.join(' L ')} L ${(data.length - 1) / (data.length - 1) * (W-20)+10},${H} L 10,${H} Z`

  return (
    <div>
      {label && <p style={{ fontSize: '.75rem', color: 'var(--text-dim)', marginBottom: 6 }}>{label}</p>}
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height }}>
        <defs>
          <linearGradient id={`g${color.replace(/[^a-z]/gi,'')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#g${color.replace(/[^a-z]/gi,'')})`} />
        <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {data.map((d, i) => {
          const x = (i / (data.length - 1)) * (W - 20) + 10
          const y = H - ((d.value / max) * (H - 20)) - 10
          return <circle key={i} cx={x} cy={y} r="3" fill={color} />
        })}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        {data.map((d, i) => (
          <span key={i} style={{ fontSize: '.62rem', color: 'var(--text-muted)' }}>{d.label}</span>
        ))}
      </div>
    </div>
  )
}

export function BarChart({ data = [], color = 'var(--accent)', height = 80, label = '' }) {
  if (!data.length) return null
  const max = Math.max(...data.map(d => d.value), 1)

  return (
    <div>
      {label && <p style={{ fontSize: '.75rem', color: 'var(--text-dim)', marginBottom: 8 }}>{label}</p>}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{
              width: '100%',
              height: `${(d.value / max) * (height - 24)}px`,
              minHeight: 4,
              background: color,
              borderRadius: '4px 4px 0 0',
              opacity: 0.7 + (d.value / max) * 0.3,
              transition: 'height .5s ease',
            }} />
            <span style={{ fontSize: '.62rem', color: 'var(--text-muted)' }}>{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
