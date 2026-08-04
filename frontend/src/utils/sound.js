let audioContext

const getAudioContext = async () => {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext
  if (!AudioContextClass) return null

  if (!audioContext) audioContext = new AudioContextClass()

  if (audioContext.state === 'suspended') {
    await audioContext.resume()
  }

  return audioContext
}

// IN Sound: Ascending double-tone chime (880Hz -> 1318.5Hz), loud and clear
export const playInBeep = async () => {
  try {
    const ctx = await getAudioContext()
    if (!ctx) return
    const now = ctx.currentTime

    // Tone 1 (Lower pitch start - 880Hz A5)
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(880, now)

    gain1.gain.setValueAtTime(0.001, now)
    gain1.gain.exponentialRampToValueAtTime(0.8, now + 0.02)
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.2)

    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    osc1.start(now)
    osc1.stop(now + 0.2)

    // Tone 2 (Higher pitch finish - 1318.51Hz E6, sustained)
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(1318.51, now + 0.15)

    gain2.gain.setValueAtTime(0.001, now + 0.15)
    gain2.gain.exponentialRampToValueAtTime(0.85, now + 0.17)
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.48)

    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.start(now + 0.15)
    osc2.stop(now + 0.48)
  } catch {
    // Fail silently if blocked
  }
}

// OUT Sound: Descending double-tone chime (1318.5Hz -> 659.25Hz), loud and distinct
export const playOutBeep = async () => {
  try {
    const ctx = await getAudioContext()
    if (!ctx) return
    const now = ctx.currentTime

    // Tone 1 (Higher pitch start - 1318.51Hz E6)
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(1318.51, now)

    gain1.gain.setValueAtTime(0.001, now)
    gain1.gain.exponentialRampToValueAtTime(0.85, now + 0.02)
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.2)

    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    osc1.start(now)
    osc1.stop(now + 0.2)

    // Tone 2 (Lower pitch finish - 659.25Hz E5, sustained)
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(659.25, now + 0.15)

    gain2.gain.setValueAtTime(0.001, now + 0.15)
    gain2.gain.exponentialRampToValueAtTime(0.8, now + 0.17)
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.48)

    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.start(now + 0.15)
    osc2.stop(now + 0.48)
  } catch {
    // Fail silently if blocked
  }
}

// Flexible scan sound helper accepting 'IN' or 'OUT'
export const playScanBeep = async (type = 'IN') => {
  if (type === 'OUT' || type === 'out') {
    await playOutBeep()
  } else {
    await playInBeep()
  }
}


