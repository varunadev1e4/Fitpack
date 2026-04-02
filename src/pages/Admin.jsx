import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'

const TABS = ['Overview', 'Squad', 'Posts', 'Invites', 'Challenges']

function Overview({ stats }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
        {[
          { label: 'Total Members', val: stats.members, icon: '👥' },
          { label: 'Check-ins Today', val: stats.todayCI, icon: '✅' },
          { label: 'Active This Week', val: stats.activeWeek, icon: '🔥' },
          { label: 'Total XP', val: stats.totalXP?.toLocaleString(), icon: '⚡' },
        ].map(s => (
          <div key={s.label} className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem' }}>{s.icon}</div>
            <div style={{ fontFamily: 'var(--font-d)', fontSize: '1.8rem', fontWeight: 900 }}>{s.val ?? '–'}</div>
            <div style={{ color: 'var(--text-dim)', fontSize: '.7rem', textTransform: 'uppercase' }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SquadTab({ members, onAwardBadge, onMakeAdmin }) {
  const [badges, setBadges] = useState([])
  const [sel, setSel]       = useState(null)  // { userId, badgeSlug }

  useEffect(() => {
    supabase.from('badges').select('*').then(({ data }) => setBadges(data ?? []))
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p style={{ color: 'var(--text-dim)', fontSize: '.82rem', marginBottom: 6 }}>
        Tap a member to award a badge or toggle admin.
      </p>
      {members.map(m => (
        <div key={m.id} className="card" style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: sel?.userId === m.id ? 12 : 0 }}>
            <div className="avatar" style={{ background: m.avatar_color ?? '#00FF87' }}>
              {m.username?.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>{m.username} {m.is_admin && <span className="pill pill-gold">admin</span>}</div>
              <div style={{ color: 'var(--text-dim)', fontSize: '.75rem' }}>{(m.xp ?? 0).toLocaleString()} XP</div>
            </div>
            <button className="btn btn-ghost btn-xs" onClick={() => setSel(sel?.userId === m.id ? null : { userId: m.id })}>
              {sel?.userId === m.id ? 'Cancel' : 'Manage'}
            </button>
          </div>
          {sel?.userId === m.id && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <select className="input" style={{ fontSize: '.85rem' }}
                onChange={e => setSel(s => ({ ...s, badgeSlug: e.target.value }))}>
                <option value="">Award a badge...</option>
                {badges.map(b => <option key={b.id} value={b.slug}>{b.icon} {b.name}</option>)}
              </select>
              {sel.badgeSlug && (
                <button className="btn btn-primary btn-sm" onClick={() => { onAwardBadge(m.id, sel.badgeSlug, badges); setSel(null) }}>
                  🏅 Award Badge
                </button>
              )}
              <button className="btn btn-ghost btn-sm" onClick={() => onMakeAdmin(m.id, !m.is_admin)}>
                {m.is_admin ? '🔽 Remove Admin' : '🔼 Make Admin'}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function PostsTab({ userId, username }) {
  const [posts, setPosts]   = useState([])
  const [content, setContent] = useState('')
  const [posting, setPosting] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('squad_posts').select('*, users(username)').order('created_at', { ascending: false }).limit(20)
    setPosts(data ?? [])
  }

  async function post() {
    if (!content.trim()) return
    setPosting(true)
    await supabase.from('squad_posts').insert({ user_id: userId, content: content.trim(), pinned: true })
    setContent('')
    await load()
    setPosting(false)
  }

  async function deletePost(id) {
    await supabase.from('squad_posts').delete().eq('id', id)
    setPosts(p => p.filter(x => x.id !== id))
  }

  async function togglePin(post) {
    await supabase.from('squad_posts').update({ pinned: !post.pinned }).eq('id', post.id)
    setPosts(p => p.map(x => x.id === post.id ? { ...x, pinned: !x.pinned } : x))
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: 14 }}>
        <h3 style={{ fontFamily: 'var(--font-d)', fontWeight: 800, fontSize: '1rem', marginBottom: 10 }}>📣 New Announcement</h3>
        <textarea
          className="input"
          placeholder="Pin a message to the squad feed..."
          value={content}
          onChange={e => setContent(e.target.value.slice(0, 500))}
          style={{ minHeight: 80, resize: 'none' }}
        />
        <button className="btn btn-primary btn-sm" style={{ marginTop: 8 }} onClick={post} disabled={posting || !content.trim()}>
          {posting ? '...' : '📌 Pin to Feed'}
        </button>
      </div>
      {posts.map(p => (
        <div key={p.id} className="card" style={{ marginBottom: 8, borderColor: p.pinned ? 'rgba(245,158,11,.3)' : 'var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: '.75rem', color: 'var(--text-dim)' }}>{p.users?.username} {p.pinned && '📌'}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => togglePin(p)} style={{ fontSize: '.75rem', color: 'var(--gold)' }}>{p.pinned ? 'Unpin' : 'Pin'}</button>
              <button onClick={() => deletePost(p.id)} style={{ fontSize: '.75rem', color: 'var(--fire)' }}>Delete</button>
            </div>
          </div>
          <p style={{ fontSize: '.9rem' }}>{p.content}</p>
        </div>
      ))}
    </div>
  )
}

function InvitesTab({ userId }) {
  const [invites, setInvites] = useState([])
  const [generating, setGenerating] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('invite_links').select('*, users!invite_links_used_by_fkey(username)').eq('created_by', userId).order('created_at', { ascending: false })
    setInvites(data ?? [])
  }

  async function generate() {
    setGenerating(true)
    const code = Math.random().toString(36).slice(2, 10).toUpperCase()
    await supabase.from('invite_links').insert({ code, created_by: userId })
    await load()
    setGenerating(false)
  }

  function copy(code) {
    const url = `${window.location.origin}?invite=${code}`
    navigator.clipboard.writeText(url)
  }

  return (
    <div>
      <button className="btn btn-primary" style={{ marginBottom: 16 }} onClick={generate} disabled={generating}>
        {generating ? '...' : '🔗 Generate Invite Link'}
      </button>
      <p style={{ color: 'var(--text-dim)', fontSize: '.8rem', marginBottom: 14 }}>Links expire in 7 days.</p>
      {invites.map(inv => (
        <div key={inv.id} className="card" style={{ marginBottom: 8, opacity: inv.used_by ? 0.6 : 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-d)', fontWeight: 800, letterSpacing: '.1em' }}>{inv.code}</div>
              <div style={{ color: 'var(--text-dim)', fontSize: '.72rem', marginTop: 2 }}>
                {inv.used_by ? `Used by ${inv.users?.username}` : `Expires ${new Date(inv.expires_at).toLocaleDateString()}`}
              </div>
            </div>
            {!inv.used_by && (
              <button className="btn btn-ghost btn-xs" onClick={() => copy(inv.code)}>📋 Copy</button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function ChallengesAdminTab() {
  const [challenges, setChallenges] = useState([])

  useEffect(() => {
    supabase.from('challenges').select('*').eq('active', true).order('created_at', { ascending: false })
      .then(({ data }) => setChallenges(data ?? []))
  }, [])

  async function toggle(ch) {
    await supabase.from('challenges').update({ active: !ch.active }).eq('id', ch.id)
    setChallenges(prev => prev.map(c => c.id === ch.id ? { ...c, active: !c.active } : c))
  }

  async function approve(ch) {
    await supabase.from('challenges').update({ approved: true }).eq('id', ch.id)
    setChallenges(prev => prev.map(c => c.id === ch.id ? { ...c, approved: true } : c))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {challenges.map(ch => (
        <div key={ch.id} className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>{ch.title}</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                <span className={`pill ${ch.approved ? 'pill-accent' : 'pill-fire'}`}>{ch.approved ? 'Approved' : 'Pending'}</span>
                <span className="pill pill-blue">{ch.type}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {!ch.approved && <button className="btn btn-ghost btn-xs" onClick={() => approve(ch)}>Approve</button>}
              <button className="btn btn-ghost btn-xs" style={{ color: 'var(--fire)' }} onClick={() => toggle(ch)}>
                {ch.active ? 'Close' : 'Reopen'}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function Admin() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab]       = useState(0)
  const [members, setMembers] = useState([])
  const [stats, setStats]   = useState({})
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  const today = new Date().toISOString().slice(0, 10)
  const monday = (() => { const d = new Date(); const day = d.getDay()||7; d.setDate(d.getDate()-day+1); return d.toISOString().slice(0,10) })()

  useEffect(() => {
    async function load() {
      const { data: u } = await supabase.from('users').select('is_admin').eq('id', user.id).single()
      if (!u?.is_admin) { setIsAdmin(false); setLoading(false); return }
      setIsAdmin(true)

      const [{ data: allUsers }, { count: todayCI }, { data: weekUsers }] = await Promise.all([
        supabase.from('users').select('*').order('xp', { ascending: false }),
        supabase.from('check_ins').select('id', { count: 'exact' }).eq('date', today),
        supabase.from('check_ins').select('user_id').gte('date', monday),
      ])

      setMembers(allUsers ?? [])
      const totalXP = (allUsers ?? []).reduce((s, u) => s + (u.xp || 0), 0)
      const activeWeek = new Set((weekUsers ?? []).map(r => r.user_id)).size
      setStats({ members: allUsers?.length, todayCI, activeWeek, totalXP })
      setLoading(false)
    }
    load()
  }, [user.id])

  async function onAwardBadge(userId, slug, badges) {
    const badge = badges.find(b => b.slug === slug)
    if (!badge) return
    await supabase.from('user_badges').upsert({ user_id: userId, badge_id: badge.id }, { onConflict: 'user_id,badge_id' })
  }

  async function onMakeAdmin(userId, val) {
    await supabase.from('users').update({ is_admin: val }).eq('id', userId)
    setMembers(prev => prev.map(m => m.id === userId ? { ...m, is_admin: val } : m))
  }

  if (loading) return <div className="page"><div className="spinner" /></div>
  if (!isAdmin) return (
    <div className="page">
      <div className="empty">
        <div className="icon">🔒</div>
        <p>Admin access only.</p>
        <button className="btn btn-ghost btn-sm" style={{ marginTop: 16, width: 'auto' }} onClick={() => navigate('/')}>← Home</button>
      </div>
    </div>
  )

  return (
    <div className="page">
      <h1 className="page-title fade-up">Admin ⚙️</h1>
      <div className="tabs fade-up" style={{ marginBottom: 20, animationDelay: '.05s', opacity: 0 }}>
        {TABS.map((t, i) => <button key={t} className={`tab-btn ${tab === i ? 'active' : ''}`} onClick={() => setTab(i)}>{t}</button>)}
      </div>
      <div className="fade-in">
        {tab === 0 && <Overview stats={stats} />}
        {tab === 1 && <SquadTab members={members} onAwardBadge={onAwardBadge} onMakeAdmin={onMakeAdmin} />}
        {tab === 2 && <PostsTab userId={user.id} username={user.username} />}
        {tab === 3 && <InvitesTab userId={user.id} />}
        {tab === 4 && <ChallengesAdminTab />}
      </div>
    </div>
  )
}
