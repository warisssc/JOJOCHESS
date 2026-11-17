/**
 * Lightweight Web Audio API arcade sound synthesizer (no external assets needed).
 */
let ctx = null
let muted = false

function getCtx() {
  if (muted || typeof window === 'undefined') return null
  if (!ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (AudioCtx) ctx = new AudioCtx()
  }
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

export function setMuted(m) { muted = m }
export function isMuted() { return muted }

function tone(freq, dur = 0.09, type = 'triangle', gainVal = 0.08, delay = 0) {
  const c = getCtx()
  if (!c) return
  const t = c.currentTime + delay
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  gain.gain.setValueAtTime(gainVal, t)
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur)
  osc.connect(gain)
  gain.connect(c.destination)
  osc.start(t)
  osc.stop(t + dur)
}

export const sfx = {
  move: () => tone(320, 0.06, 'sine', 0.06),
  capture: () => { tone(180, 0.08, 'sawtooth', 0.09); tone(110, 0.1, 'square', 0.06, 0.03) },
  draftOpen: () => { tone(440, 0.08, 'triangle', 0.08, 0); tone(554, 0.08, 'triangle', 0.08, 0.07); tone(659, 0.14, 'triangle', 0.09, 0.14) },
  cardPick: () => { tone(523, 0.07, 'sine', 0.08, 0); tone(784, 0.15, 'sine', 0.1, 0.06) },
  chaos: () => { tone(260, 0.1, 'sawtooth', 0.08, 0); tone(390, 0.1, 'sawtooth', 0.08, 0.06); tone(520, 0.15, 'square', 0.08, 0.12) },
  lightning: () => { tone(140, 0.18, 'sawtooth', 0.12, 0); tone(85, 0.25, 'square', 0.1, 0.05) },
  undo: () => { tone(420, 0.06, 'sine', 0.06, 0); tone(300, 0.08, 'sine', 0.06, 0.05) },
}
