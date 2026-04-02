// Shows last 90 days as a heatmap (GitHub-style)
export default function CalendarHeatmap({ checkIns = [] }) {
  const today = new Date()
  const days = 90

  // Build a set of checked-in dates
  const ciMap = {}
  checkIns.forEach(c => {
    ciMap[c.date] = { workout: c.workout, is_rest: c.is_rest_day, xp: c.xp_earned }
  })

  // Build columns (weeks), oldest first
  const cells = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const iso = d.toISOString().slice(0, 10)
    const ci = ciMap[iso]
    cells.push({ iso, ci, dow: d.getDay() })
  }

  // Group into columns of 7 (Sun=0..Sat=6)
  const cols = []
  let col = []
  cells.forEach((cell, idx) => {
    col.push(cell)
    if (col.length === 7 || idx === cells.length - 1) {
      cols.push(col)
      col = []
    }
  })

  function cellColor(cell) {
    if (!cell.ci) return 'var(--bg-elevated)'
    if (cell.ci.is_rest) return 'rgba(139,92,246,0.5)'
    if (cell.ci.workout) return 'var(--accent)'
    return 'rgba(0,255,135,0.35)'
  }

  const totalDays = checkIns.length
  const workoutDays = checkIns.filter(c => c.workout).length

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: '.78rem', color: 'var(--text-dim)' }}>Last 90 days</span>
        <span style={{ fontSize: '.78rem', color: 'var(--text-dim)' }}>
          {totalDays} check-ins · {workoutDays} workouts
        </span>
      </div>
      <div className="heatmap">
        {cols.map((col, ci) => (
          <div key={ci} className="heatmap-col">
            {col.map((cell, di) => (
              <div
                key={di}
                className="heatmap-cell"
                title={`${cell.iso}${cell.ci ? ` · +${cell.ci.xp}XP` : ' · no log'}`}
                style={{ background: cellColor(cell) }}
              />
            ))}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 10, fontSize: '.7rem', color: 'var(--text-muted)' }}>
        <span><span style={{ display:'inline-block', width:10, height:10, borderRadius:2, background:'var(--accent)', marginRight:4 }} />Workout</span>
        <span><span style={{ display:'inline-block', width:10, height:10, borderRadius:2, background:'rgba(0,255,135,.35)', marginRight:4 }} />Logged</span>
        <span><span style={{ display:'inline-block', width:10, height:10, borderRadius:2, background:'rgba(139,92,246,.5)', marginRight:4 }} />Rest</span>
        <span><span style={{ display:'inline-block', width:10, height:10, borderRadius:2, background:'var(--bg-elevated)', marginRight:4 }} />None</span>
      </div>
    </div>
  )
}
