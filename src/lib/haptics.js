// Haptic feedback helper — wraps navigator.vibrate safely

export function haptic(pattern = 'light') {
  if (!navigator.vibrate) return
  const patterns = {
    light:   [30],
    medium:  [60],
    success: [40, 30, 80],
    error:   [100, 50, 100],
    badge:   [50, 30, 50, 30, 100],
    spin:    [20, 20, 20, 20, 20, 20, 60],
  }
  navigator.vibrate(patterns[pattern] ?? patterns.light)
}
