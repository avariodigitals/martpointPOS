let notificationAudioContext: AudioContext | null = null

function getNotificationAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null
  const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextClass) return null
  notificationAudioContext ||= new AudioContextClass()
  return notificationAudioContext
}

export async function enableNotificationSound(): Promise<boolean> {
  try {
    const context = getNotificationAudioContext()
    if (!context) return false
    if (context.state !== "running") await context.resume()
    return context.state === "running"
  } catch {
    return false
  }
}

export function playNotificationSound() {
  const context = notificationAudioContext
  if (!context) return
  const play = () => {
    if (context.state !== "running") return
    const start = context.currentTime + 0.02
    ;[0, 0.24, 0.48].forEach((offset, index) => {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = "sine"
      oscillator.frequency.value = index === 1 ? 1046 : 880
      gain.gain.setValueAtTime(0.0001, start + offset)
      gain.gain.exponentialRampToValueAtTime(0.28, start + offset + 0.025)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.19)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start(start + offset)
      oscillator.stop(start + offset + 0.2)
    })
  }

  if (context.state === "running") play()
  else void context.resume().then(play).catch(() => undefined)
}
