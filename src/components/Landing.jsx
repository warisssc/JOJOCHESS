import { customPieces } from './Pieces'

export default function Landing({ onPlay }) {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 text-center">
      <div className="menacing pointer-events-none absolute top-14 left-10 hidden select-none font-display text-5xl font-black text-fuchsia-500/25 sm:block">
        ゴゴゴゴ
      </div>
      <div className="menacing pointer-events-none absolute right-10 bottom-14 hidden select-none font-display text-5xl font-black text-amber-400/20 sm:block" style={{ animationDelay: '-1.3s' }}>
        MENACING
      </div>

      <div className="mb-8 flex items-end gap-4">
        <div className="float h-20 w-20 sm:h-28 sm:w-28">{customPieces.wQ()}</div>
        <div className="float h-24 w-24 sm:h-36 sm:w-36" style={{ animationDelay: '-1.3s' }}>{customPieces.wK()}</div>
        <div className="float h-20 w-20 sm:h-28 sm:w-28" style={{ animationDelay: '-2.6s' }}>{customPieces.bK()}</div>
      </div>

      <h1 className="font-display text-4xl font-black tracking-[0.2em] text-white drop-shadow-[0_0_28px_rgba(245,158,11,0.55)] sm:text-6xl">
        JOJO <span className="text-amber-400">CHESS</span>
      </h1>
      <p className="mt-4 max-w-md text-sm tracking-wide text-slate-400 sm:text-base">
        Pierce yourself with the Stand Arrow, awaken 1 of 5 reality-bending Stand abilities, and battle Stockfish.
      </p>

      <button
        onClick={onPlay}
        className="glow-btn mt-10 rounded-full bg-amber-400 px-14 py-4 font-display text-lg font-black uppercase tracking-[0.25em] text-slate-950 transition hover:scale-105 hover:bg-amber-300 active:scale-95"
      >
        Play
      </button>
    </main>
  )
}
