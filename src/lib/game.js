// ============================================================
// FitPack v3 — Gamification Engine
// ============================================================

export const LEVELS = [
  { level: 1, name: 'Rookie',  emoji: '🌱', min: 0,     max: 499    },
  { level: 2, name: 'Grinder', emoji: '⚙️',  min: 500,   max: 1499   },
  { level: 3, name: 'Warrior', emoji: '⚔️',  min: 1500,  max: 3499   },
  { level: 4, name: 'Beast',   emoji: '🔥',  min: 3500,  max: 6999   },
  { level: 5, name: 'Legend',  emoji: '👑',  min: 7000,  max: Infinity },
]

export const MAX_REST_DAYS_PER_WEEK = 2

// ── Milestone XP bonuses ───────────────────────────────────
export const XP_MILESTONES = [
  { threshold: 1000,  bonus: 50,  badge: 'milestone_1k'   },
  { threshold: 2500,  bonus: 100, badge: 'milestone_2500'  },
  { threshold: 5000,  bonus: 200, badge: 'milestone_5k'    },
  { threshold: 10000, bonus: 300, badge: null              },
  { threshold: 25000, bonus: 500, badge: null              },
]

export function getNewMilestones(oldXP, newXP) {
  return XP_MILESTONES.filter(m => oldXP < m.threshold && newXP >= m.threshold)
}

// ── Spin Wheel ─────────────────────────────────────────────
export const SPIN_ITEMS = [
  { label: 'Do 50 push-ups today',        xp: 30  },
  { label: 'Drink 10 glasses of water',   xp: 20  },
  { label: 'Walk 5,000 steps',            xp: 25  },
  { label: 'No sugar for the day',        xp: 35  },
  { label: 'Sleep before 11pm',           xp: 25  },
  { label: 'Do 20 minutes of stretching', xp: 20  },
  { label: 'Eat 4 meals today',           xp: 20  },
  { label: 'Do 100 jumping jacks',        xp: 30  },
  { label: 'Meditate for 10 minutes',     xp: 20  },
  { label: 'No screen time after 10pm',   xp: 25  },
  { label: 'Drink only water today',      xp: 40  },
  { label: 'Do a 2-minute plank',         xp: 35  },
  { label: 'Cook your own meal today',    xp: 20  },
  { label: 'Workout buddy check-in call', xp: 25  },
  { label: '🎉 FREE DAY — just log!',     xp: 15  },
]

export function getRandomSpin() {
  return SPIN_ITEMS[Math.floor(Math.random() * SPIN_ITEMS.length)]
}

// ── Seasonal Events ────────────────────────────────────────
export function getActiveSeason() {
  const now  = new Date()
  const m    = now.getMonth() + 1 // 1-12
  const d    = now.getDate()

  if (m === 1  && d <= 15) return { name: 'New Year Blitz',   emoji: '🎆', color: '#00FF87' }
  if (m === 4  && d <= 14) return { name: 'Ramadan Strong',   emoji: '🌙', color: '#8B5CF6' }
  if (m >= 6  && m <= 8)   return { name: 'Summer Shred',     emoji: '☀️',  color: '#F59E0B' }
  if (m === 10)             return { name: 'October Challenge', emoji: '🎃', color: '#FF6B35' }
  if (m === 12 && d >= 15) return { name: 'Year-End Push',    emoji: '🏁', color: '#06B6D4' }
  return null
}

// ── Level helpers ──────────────────────────────────────────
export function getLevelInfo(xp) {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].min) return LEVELS[i]
  }
  return LEVELS[0]
}

export function getXPProgress(xp) {
  const lvl = getLevelInfo(xp)
  if (lvl.max === Infinity) return 100
  return Math.min(((xp - lvl.min) / (lvl.max - lvl.min + 1)) * 100, 100)
}

export function getXPToNext(xp) {
  const lvl = getLevelInfo(xp)
  if (lvl.max === Infinity) return 0
  return lvl.max - xp + 1
}

// ── Weekly Streak ──────────────────────────────────────────
export function getMondayISO(date = new Date()) {
  const d   = new Date(date)
  const day = d.getDay() || 7
  d.setDate(d.getDate() - day + 1)
  d.setHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10)
}

export function getPrevMondayISO() {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  return getMondayISO(d)
}

export function calcWeeklyStreak(streakRow) {
  const weekId     = getMondayISO()
  const prevWeekId = getPrevMondayISO()

  if (!streakRow || !streakRow.current_week_id) {
    return { newStreak: 0, newLongest: 0, newWeekCheckins: 1, newWeekId: weekId, weekJustCompleted: false }
  }

  const { current_streak, longest_streak, current_week_id, current_week_checkins } = streakRow

  if (current_week_id === weekId) {
    const newCount          = current_week_checkins + 1
    const weekJustCompleted = newCount === 3
    const newStreak         = weekJustCompleted ? current_streak + 1 : current_streak
    const newLongest        = Math.max(longest_streak, newStreak)
    return { newStreak, newLongest, newWeekCheckins: newCount, newWeekId: weekId, weekJustCompleted }
  } else {
    const lastWeekKept = current_week_id === prevWeekId && current_week_checkins >= 3
    const baseStreak   = lastWeekKept ? current_streak : 0
    return { newStreak: baseStreak, newLongest: longest_streak, newWeekCheckins: 1, newWeekId: weekId, weekJustCompleted: false }
  }
}

export function displayStreak(s) { return s?.current_streak ?? 0 }
export function weekProgress(s)  { return Math.min(s?.current_week_checkins ?? 0, 3) }

// ── Junk food streak ───────────────────────────────────────
export function calcJunkStreak(checkIns) {
  // checkIns sorted descending by date
  let streak = 0
  for (const ci of checkIns) {
    if (ci.no_junk) streak++
    else break
  }
  return streak
}

// ── Comeback detection ─────────────────────────────────────
// Returns true if user has been away 7+ days (no check-ins)
export function isComeback(checkIns) {
  if (!checkIns.length) return false
  const latest    = new Date(checkIns[0].date)
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const diffDays  = Math.floor((yesterday - latest) / 86400000)
  return diffDays >= 7
}

// ── XP Calculation ─────────────────────────────────────────
export function calculateXP(form, opts = {}) {
  let xp = 0
  const breakdown = []

  if (form.is_rest_day) {
    xp += 20; breakdown.push({ label: '🧘 Rest Day', xp: 20 })
    if (form.no_junk) { xp += 10; breakdown.push({ label: '🥗 No Junk Food', xp: 10 }) }
    if (form.mood)    { xp += 5;  breakdown.push({ label: '😊 Mood logged', xp: 5 })   }
    if (opts.comeback){ xp += 50; breakdown.push({ label: '⚡ Comeback Bonus!', xp: 50 }) }
    return { total: xp, breakdown, isPerfect: false }
  }

  if (form.workout) {
    xp += 50; breakdown.push({ label: '💪 Workout', xp: 50 })
    if (form.workout_entries?.length > 0) { xp += 10; breakdown.push({ label: '📝 Detailed log', xp: 10 }) }
  }

  const mealXP = Math.min(form.meals * 10, 50)
  if (mealXP  > 0) { xp += mealXP;  breakdown.push({ label: `🍽 ${form.meals} meals`, xp: mealXP }) }

  const waterXP = Math.min(form.water_glasses * 5, 40)
  if (waterXP > 0) { xp += waterXP; breakdown.push({ label: `💧 ${form.water_glasses} glasses`, xp: waterXP }) }

  if (form.sleep_hours >= 1) { xp += 20; breakdown.push({ label: `😴 ${form.sleep_hours}h sleep`, xp: 20 }) }
  if (form.no_junk)          { xp += 10; breakdown.push({ label: '🥗 No Junk Food', xp: 10 })              }
  if (form.mood)             { xp += 5;  breakdown.push({ label: '😊 Mood logged', xp: 5 })                }

  const isPerfect = form.workout && form.meals >= 3 && form.water_glasses >= 6 && form.sleep_hours >= 6
  if (isPerfect) { xp += 50; breakdown.push({ label: '⭐ Perfect Day!', xp: 50 }) }

  if (opts.comeback) { xp += 50; breakdown.push({ label: '⚡ Comeback Bonus!', xp: 50 }) }

  return { total: xp, breakdown, isPerfect }
}

// ── Analytics ──────────────────────────────────────────────
export function calcConsistency(checkIns, days = 30) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  return Math.round((checkIns.filter(c => new Date(c.date) >= cutoff).length / days) * 100)
}

export function weakestMetric(checkIns) {
  if (!checkIns.length) return null
  const n = checkIns.filter(c => !c.is_rest_day)
  if (!n.length) return null
  const avgWater   = n.reduce((s, c) => s + c.water_glasses, 0) / n.length
  const avgMeals   = n.reduce((s, c) => s + c.meals, 0) / n.length
  const avgSleep   = n.reduce((s, c) => s + c.sleep_hours, 0) / n.length
  const pctWorkout = n.filter(c => c.workout).length / n.length
  return [
    { key: 'Water',   score: avgWater / 8,   label: `avg ${avgWater.toFixed(1)} glasses/day (target: 8)` },
    { key: 'Meals',   score: avgMeals / 4,   label: `avg ${avgMeals.toFixed(1)} meals/day (target: 4)` },
    { key: 'Sleep',   score: avgSleep / 8,   label: `avg ${avgSleep.toFixed(1)}h/night (target: 8)` },
    { key: 'Workout', score: pctWorkout,      label: `${Math.round(pctWorkout * 100)}% of days` },
  ].sort((a, b) => a.score - b.score)[0]
}

// Correlations: sleep vs workout rate
export function calcCorrelations(checkIns) {
  const results = []
  const n = checkIns.filter(c => !c.is_rest_day)
  if (n.length < 5) return results

  const goodSleep  = n.filter(c => c.sleep_hours >= 7)
  const poorSleep  = n.filter(c => c.sleep_hours  < 7)
  if (goodSleep.length > 2 && poorSleep.length > 2) {
    const rateGood = goodSleep.filter(c => c.workout).length / goodSleep.length
    const ratePoor = poorSleep.filter(c => c.workout).length / poorSleep.length
    results.push({
      insight: `On days after 7+ hrs sleep, you work out ${Math.round(rateGood * 100)}% of the time vs ${Math.round(ratePoor * 100)}% on less sleep.`,
      icon: '😴',
    })
  }

  const noJunkDays  = n.filter(c => c.no_junk)
  const junkDays    = n.filter(c => !c.no_junk)
  if (noJunkDays.length > 2 && junkDays.length > 2) {
    const wGood = noJunkDays.filter(c => c.workout).length / noJunkDays.length
    const wBad  = junkDays.filter(c => c.workout).length  / junkDays.length
    results.push({
      insight: `On no-junk days you work out ${Math.round(wGood * 100)}% of the time vs ${Math.round(wBad * 100)}% on junk days.`,
      icon: '🥗',
    })
  }

  const avgWater = n.reduce((s, c) => s + c.water_glasses, 0) / n.length
  const highWater = n.filter(c => c.water_glasses >= avgWater + 2)
  const lowWater  = n.filter(c => c.water_glasses  < avgWater - 2)
  if (highWater.length > 2 && lowWater.length > 2) {
    const sleepHigh = highWater.reduce((s, c) => s + c.sleep_hours, 0) / highWater.length
    const sleepLow  = lowWater.reduce((s, c)  => s + c.sleep_hours, 0) / lowWater.length
    results.push({
      insight: `On high-hydration days you average ${sleepHigh.toFixed(1)}h sleep vs ${sleepLow.toFixed(1)}h on low-hydration days.`,
      icon: '💧',
    })
  }

  return results
}

export function calcBestWeek(checkIns) {
  if (!checkIns.length) return 0
  const weekMap = {}
  checkIns.forEach(c => {
    const mon = getMondayISO(new Date(c.date))
    weekMap[mon] = (weekMap[mon] || 0) + (c.xp_earned || 0)
  })
  return Math.max(...Object.values(weekMap), 0)
}

// ── Badge checks ───────────────────────────────────────────
export const BADGE_CHECKS = {
  first_checkin:  (s) => s.totalCheckIns >= 1,
  streak_3:       (s) => s.currentStreak >= 3,
  streak_8:       (s) => s.currentStreak >= 8,
  streak_20:      (s) => s.currentStreak >= 20,
  hydration_hero: (s) => s.latestWater >= 8,
  perfect_day:    (s) => s.latestPerfectDay === true,
  workout_10:     (s) => s.totalWorkouts >= 10,
  workout_50:     (s) => s.totalWorkouts >= 50,
  night_owl:      (s) => s.latestSleep >= 8,
  consistent_90:  (s) => s.consistency >= 90,
  week_complete:  (s) => s.weekJustCompleted === true,
  junk_streak_7:  (s) => s.junkStreak >= 7,
  junk_streak_30: (s) => s.junkStreak >= 30,
  mood_tracker:   (s) => s.totalMoods >= 10,
  comeback_kid:   (s) => s.isComeback && s.latestPerfectDay,
  milestone_1k:   (s) => s.totalXP >= 1000,
  milestone_2500: (s) => s.totalXP >= 2500,
  milestone_5k:   (s) => s.totalXP >= 5000,
  spin_master:    (s) => s.completedSpins >= 10,
  goal_setter:    (s) => s.achievedGoals >= 3,
  squad_post:     (s) => s.squadPosts >= 1,
  shoutout_king:  (s) => s.totalShoutouts >= 10,
}

// ── Mood ──────────────────────────────────────────────────
export const MOODS = [
  { key: 'dead',  emoji: '💀', label: 'Dead'  },
  { key: 'tired', emoji: '😴', label: 'Tired' },
  { key: 'meh',   emoji: '😐', label: 'Meh'   },
  { key: 'good',  emoji: '😊', label: 'Good'  },
  { key: 'fire',  emoji: '🔥', label: 'Fire'  },
]

// ── Avatar styles ──────────────────────────────────────────
export const AVATAR_STYLES = [
  { key: 'letter', label: 'Initial'    },
  { key: '🦁',     label: 'Lion'       },
  { key: '🐺',     label: 'Wolf'       },
  { key: '🦊',     label: 'Fox'        },
  { key: '🐻',     label: 'Bear'       },
  { key: '🦅',     label: 'Eagle'      },
  { key: '🐉',     label: 'Dragon'     },
  { key: '🦈',     label: 'Shark'      },
  { key: '🐯',     label: 'Tiger'      },
  { key: '🦍',     label: 'Gorilla'    },
  { key: '🤖',     label: 'Robot'      },
  { key: '👾',     label: 'Alien'      },
]

// ── Workout types ──────────────────────────────────────────
export const WORKOUT_TYPES = [
  { value: 'weights', label: '🏋️ Weights', color: '#00FF87' },
  { value: 'cardio',  label: '🏃 Cardio',  color: '#FF6B35' },
  { value: 'hiit',    label: '⚡ HIIT',     color: '#F59E0B' },
  { value: 'yoga',    label: '🧘 Yoga',     color: '#8B5CF6' },
  { value: 'sports',  label: '⚽ Sports',   color: '#06B6D4' },
  { value: 'walk',    label: '🚶 Walk',     color: '#84CC16' },
  { value: 'swim',    label: '🏊 Swim',     color: '#06B6D4' },
  { value: 'cycle',   label: '🚴 Cycle',    color: '#F97316' },
  { value: 'other',   label: '🤸 Other',    color: '#888899' },
]

export const AVATAR_COLORS = [
  '#00FF87','#FF6B35','#8B5CF6','#F59E0B',
  '#EC4899','#06B6D4','#84CC16','#F97316',
]

export function randomAvatarColor() {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]
}

export function getAvatarDisplay(user) {
  if (!user) return { type: 'letter', value: '?' }
  if (!user.avatar_style || user.avatar_style === 'letter') {
    return { type: 'letter', value: user.username?.charAt(0).toUpperCase() ?? '?' }
  }
  return { type: 'emoji', value: user.avatar_style }
}
