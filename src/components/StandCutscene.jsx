const THEME = {
  crimson: {
    bg: 'from-red-950/90 via-slate-950/95 to-red-900/90',
    border: 'border-red-500',
    text: 'text-red-400',
    glow: 'drop-shadow-[0_0_35px_rgba(239,68,68,0.9)]',
  },
  pink: {
    bg: 'from-pink-950/90 via-slate-950/95 to-fuchsia-900/90',
    border: 'border-pink-500',
    text: 'text-pink-400',
    glow: 'drop-shadow-[0_0_35px_rgba(236,72,153,0.9)]',
  },
  amber: {
    bg: 'from-amber-950/90 via-slate-950/95 to-yellow-900/90',
    border: 'border-amber-400',
    text: 'text-amber-300',
    glow: 'drop-shadow-[0_0_35px_rgba(250,204,21,0.9)]',
  },
  emerald: {
    bg: 'from-emerald-950/90 via-slate-950/95 to-green-900/90',
    border: 'border-emerald-400',
    text: 'text-emerald-400',
    glow: 'drop-shadow-[0_0_35px_rgba(16,185,129,0.9)]',
  },
  violet: {
    bg: 'from-violet-950/90 via-slate-950/95 to-purple-900/90',
    border: 'border-violet-400',
    text: 'text-violet-300',
    glow: 'drop-shadow-[0_0_35px_rgba(139,92,246,0.9)]',
  },
}

export default function StandCutscene({ cutscene, onSkip }) {
  if (!cutscene) return null
  const t = THEME[cutscene.color] || THEME.amber

  return (
    <div
      onClick={onSkip}
      className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-black/60 backdrop-blur-xs"
    >
      <div
        className={`stand-cutscene speedlines relative flex w-full max-w-2xl flex-col items-center overflow-hidden border-y-4 bg-gradient-to-r px-8 py-8 text-center shadow-2xl ${t.bg} ${t.border}`}
      >
        <span className="pointer-events-none absolute top-2 left-4 font-display text-2xl font-black text-white/25">
          ゴゴゴゴ
        </span>
        <span className="pointer-events-none absolute right-4 bottom-2 font-display text-2xl font-black text-white/25">
          ドドドド
        </span>
        <div className={`text-6xl sm:text-7xl ${t.glow}`}>{cutscene.icon}</div>
        <div className={`mt-3 font-display text-3xl font-black uppercase tracking-[0.22em] sm:text-4xl ${t.text} ${t.glow}`}>
          {cutscene.title}
        </div>
        <div className="mt-2 font-display text-sm font-bold uppercase tracking-[0.18em] text-white">
          {cutscene.subtitle}
        </div>
      </div>
    </div>
  )
}
