import { useState } from 'react'
import { supabase } from '../lib/supabase'

const EMOJIS = ['🔥', '💪', '👏', '❤️', '😤']

export default function ReactionBar({ checkInId, userId, initialReactions = [] }) {
  const [reactions, setReactions] = useState(initialReactions)

  // Group by emoji
  const counts = {}
  EMOJIS.forEach(e => { counts[e] = 0 })
  reactions.forEach(r => { counts[r.emoji] = (counts[r.emoji] || 0) + 1 })

  const myReaction = reactions.find(r => r.user_id === userId)?.emoji

  async function react(emoji) {
    if (myReaction === emoji) {
      // Remove reaction
      await supabase.from('reactions').delete().eq('check_in_id', checkInId).eq('user_id', userId)
      setReactions(prev => prev.filter(r => r.user_id !== userId))
    } else {
      // Upsert reaction
      await supabase.from('reactions').upsert({ check_in_id: checkInId, user_id: userId, emoji }, { onConflict: 'check_in_id,user_id' })
      setReactions(prev => {
        const filtered = prev.filter(r => r.user_id !== userId)
        return [...filtered, { check_in_id: checkInId, user_id: userId, emoji }]
      })
    }
  }

  // Only show emojis that have reactions OR all if none
  const hasAny = Object.values(counts).some(c => c > 0)

  return (
    <div className="reaction-bar" style={{ marginTop: 10 }}>
      {EMOJIS.map(emoji => {
        const count = counts[emoji]
        if (!hasAny || count > 0 || !hasAny) {
          return (
            <button
              key={emoji}
              className={`reaction-btn ${myReaction === emoji ? 'mine' : ''}`}
              onClick={() => react(emoji)}
            >
              <span>{emoji}</span>
              {count > 0 && <span style={{ fontWeight: 700, fontSize: '.78rem' }}>{count}</span>}
            </button>
          )
        }
        return null
      })}
    </div>
  )
}
