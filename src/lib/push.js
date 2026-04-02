// Web Push Notification helper
// Requires VITE_VAPID_PUBLIC_KEY env var for server-push
// Client-side local notifications work without VAPID

export async function requestPermission() {
  if (!('Notification' in window)) return 'unsupported'
  const perm = await Notification.requestPermission()
  return perm // 'granted' | 'denied' | 'default'
}

export function scheduleLocalReminder(timeHHMM = '20:00') {
  // Store preferred time in localStorage; service worker will fire it
  localStorage.setItem('fitpack_reminder_time', timeHHMM)
}

export function getReminderTime() {
  return localStorage.getItem('fitpack_reminder_time') || '20:00'
}

export function sendLocalNotification(title, body, icon = '/icon-192.png') {
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon })
  }
}

// Call this on app load to fire reminder if it's the right time and user hasn't checked in
export async function maybeFireReminder(hasCheckedInToday) {
  if (hasCheckedInToday) return
  if (Notification.permission !== 'granted') return
  const now = new Date()
  const [h, m] = getReminderTime().split(':').map(Number)
  if (now.getHours() === h && now.getMinutes() >= m && now.getMinutes() < m + 5) {
    sendLocalNotification("⏰ FitPack Reminder", "You haven't logged today yet! Don't break your streak 🔥")
  }
}
