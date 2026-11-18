import { useEffect, useMemo, useState } from 'react'
import { Chessboard } from 'react-chessboard'
import { customPieces, PieceIcon } from './Pieces'
import StandCutscene from './StandCutscene'
import { useStandGame } from '../stand/useStandGame'
import { killerQueenTargets, standLegalMoves, toStandPositionObject } from '../stand/standRules'
import { fromAlg, toAlg } from '../game/rules'

const LIGHT = '#9ca3af'
const DARK = '#374151'

const AURA = {
  crimson: 'border-red-500/50 bg-red-500/10 shadow-[0_0_30px_rgba(239,68,68,0.25)]',
  pink: 'border-pink-500/50 bg-pink-500/10 shadow-[0_0_30px_rgba(236,72,153,0.25)]',
  amber: 'border-amber-400/50 bg-amber-500/10 shadow-[0_0_30px_rgba(245,158,11,0.25)]',
  emerald: 'border-emerald-400/50 bg-emerald-500/10 shadow-[0_0_30px_rgba(16,185,129,0.25)]',
  violet: 'border-violet-400/50 bg-violet-500/10 shadow-[0_0_30px_rgba(139,92,246,0.25)]',
}

export default function StandScreen({ p2p = null, onMenu }) {
  const g = useStandGame(p2p)
  const { game, stand, status, targetMode } = g
  const [selected, setSelected] = useState(null)
  const [promo, setPromo] = useState(null)
  const [adminUnlocked, setAdminUnlocked] = useState(false)
  const [showAdminModal, setShowAdminModal] = useState(false)
  const [adminPassword, setAdminPassword] = useState('')
  const [adminError, setAdminError] = useState('')
  const [adminShake, setAdminShake] = useState(false)

  const myColor = p2p ? p2p.myColor : 'w'
  const myTurn = Boolean(stand) && !status.over && game.turn === myColor && !g.thinking

  const submitAdminPassword = (e) => {
    e.preventDefault()
    if (adminPassword === 'kornsuck') {
      setAdminUnlocked(true)
      setShowAdminModal(false)
      setAdminPassword('')
      setAdminError('')
    } else {
      setAdminError('Incorrect password.')
      setAdminShake(true)
      setTimeout(() => setAdminShake(false), 420)
    }
  }
  const moves = useMemo(() => (myTurn ? standLegalMoves(game) : []), [game, myTurn])
  const selMoves = useMemo(() => (selected == null ? [] : moves.filter((m) => m.from === selected)), [moves, selected])
  const kqTargets = useMemo(() => killerQueenTargets(game), [game])

  useEffect(() => { setSelected(null); setPromo(null) }, [game])

  const attempt = (from, to) => {
    const cands = moves.filter((m) => m.from === from && m.to === to)
    if (!cands.length) return false
    if (cands.length > 1) { setPromo({ moves: cands }); return true }
    g.playHumanMove(cands[0])
    return true
  }

  const bombMap = useMemo(() => {
    const m = {}
    for (const b of game.bombs) m[b.sq] = b.turnsLeft
    return m
  }, [game.bombs])

  // Visual arrows for King Crimson (Red) and Hey Ya! (Gold)
  const arrows = useMemo(() => {
    const list = []
    if (game.fatedMove) {
      list.push({
        startSquare: toAlg(game.fatedMove.from),
        endSquare: toAlg(game.fatedMove.to),
        color: 'rgba(239, 68, 68, 0.92)',
      })
    }
    if (g.heyYaHint && myColor === 'w') {
      list.push({
        startSquare: toAlg(g.heyYaHint.from),
        endSquare: toAlg(g.heyYaHint.to),
        color: 'rgba(34, 197, 94, 0.95)',
      })
    }
    return list
  }, [game.fatedMove, g.heyYaHint, myColor])

  const squareStyles = useMemo(() => {
    const st = {}
    const add = (i, style) => { st[toAlg(i)] = { ...(st[toAlg(i)] || {}), ...style } }
    if (g.lastMove) {
      add(g.lastMove.from, { background: 'rgba(250, 204, 21, 0.3)' })
      add(g.lastMove.to, { background: 'rgba(250, 204, 21, 0.45)' })
    }
    if (game.fatedMove) {
      add(game.fatedMove.from, { boxShadow: 'inset 0 0 0 3px #ef4444' })
      add(game.fatedMove.to, { boxShadow: 'inset 0 0 0 3px #ef4444' })
    }
    if (g.heyYaHint && myColor === 'w') {
      add(g.heyYaHint.from, { boxShadow: 'inset 0 0 0 3px #22c55e' })
      add(g.heyYaHint.to, { boxShadow: 'inset 0 0 0 3px #22c55e' })
    }
    if (game.killerQueenSq != null) {
      add(game.killerQueenSq, { boxShadow: 'inset 0 0 18px rgba(236, 72, 153, 0.9)' })
    }
    for (let i = 0; i < 64; i++) {
      if (game.board[i]?.dino) {
        add(i, { boxShadow: 'inset 0 0 18px rgba(16, 185, 129, 0.95)', background: 'rgba(16, 185, 129, 0.25)' })
      }
    }
    if (targetMode === 'kq-bomb') {
      for (const tsq of kqTargets) {
        add(tsq, { boxShadow: 'inset 0 0 0 4px #ec4899', background: 'rgba(236, 72, 153, 0.55)', cursor: 'crosshair' })
      }
    }
    if (status.check) {
      const k = game.board.findIndex((p) => p && p.t === 'k' && p.c === game.turn)
      if (k >= 0) add(k, { background: 'radial-gradient(circle, rgba(239,68,68,0.95) 0%, rgba(239,68,68,0.15) 75%)' })
    }
    if (selected != null) add(selected, { background: 'rgba(168, 85, 247, 0.55)' })
    for (const m of selMoves) {
      if (m.capture) add(m.to, { background: 'radial-gradient(circle, transparent 55%, rgba(239,68,68,0.75) 58%)', cursor: 'pointer' })
      else add(m.to, { background: 'radial-gradient(circle, rgba(15,23,42,0.5) 20%, transparent 24%)', cursor: 'pointer' })
    }
    for (const sq of g.blastFx) {
      add(sq, { background: 'radial-gradient(circle, rgba(244,63,94,0.95) 0%, transparent 80%)', boxShadow: 'inset 0 0 24px #f43f5e' })
    }
    return st
  }, [g.lastMove, game, g.heyYaHint, g.blastFx, myColor, targetMode, kqTargets, status.check, selected, selMoves])

  const onSquareClick = ({ square }) => {
    if (!myTurn) return
    const sq = fromAlg(square)

    if (myColor === 'w') {
      if (targetMode === 'kq-assign') {
        if (game.board[sq]?.c === 'w') g.assignKillerQueen(sq)
        return
      }
      if (targetMode === 'kq-bomb') {
        if (kqTargets.includes(sq)) g.plantBomb(sq)
        return
      }
      if (targetMode === 'dino-assign') {
        if (game.board[sq]?.c === 'w') g.assignDinoLeader(sq)
        return
      }
      if (targetMode === 'bigmouth-cloak') {
        if (game.board[sq]?.c === 'w' && game.board[sq]?.t !== 'k') g.cloakPiece(sq)
        return
      }
    }

    if (selected != null && attempt(selected, sq)) return
    const p = game.board[sq]
    if (p && p.c === myColor && moves.some((m) => m.from === sq)) setSelected(sq === selected ? null : sq)
    else setSelected(null)
  }

  return (
    <main className="relative mx-auto flex min-h-screen max-w-6xl flex-col gap-4 overflow-hidden px-4 py-4">
      <StandCutscene cutscene={g.cutscene} onSkip={g.skipCutscene} />

      {/* In-Match Secret Admin Trigger (only renders in live 1v1 P2P match) */}
      {Boolean(p2p) && !adminUnlocked && (
        <button
          onClick={() => setShowAdminModal(true)}
          title="Match Settings"
          aria-label="Match Settings"
          className="fixed top-3 right-3 z-30 rounded-full p-2 text-base text-slate-500 opacity-40 transition hover:bg-white/10 hover:text-amber-300 hover:opacity-100"
        >
          ⚙️
        </button>
      )}

      <div className="menacing pointer-events-none fixed top-16 left-6 z-0 hidden select-none font-display text-4xl font-black text-fuchsia-500/25 lg:block">
        ゴゴゴゴ
      </div>
      <div className="menacing pointer-events-none fixed right-8 bottom-16 z-0 hidden select-none font-display text-4xl font-black text-fuchsia-500/25 lg:block" style={{ animationDelay: '-1.2s' }}>
        MENACING
      </div>

      {g.glitchFx && (
        <div className="king-crimson-glitch pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-red-600/35 mix-blend-screen" />
      )}

      {g.heyYaCheer && (
        <div className="hey-ya-slide fixed top-4 right-4 z-40 rounded-2xl border border-emerald-400 bg-emerald-500/20 px-4 py-2.5 text-sm font-bold text-emerald-200 shadow-[0_0_30px_rgba(34,197,94,0.4)] backdrop-blur-md">
          🍀 HEY YA!: &ldquo;You got this! Follow the Green Arrow!&rdquo;
        </div>
      )}

      {g.banner && (
        <div className="z-10 mx-auto w-full max-w-4xl rounded-xl border border-fuchsia-400/50 bg-slate-900/90 px-4 py-2.5 text-center font-display text-sm font-bold tracking-wide text-fuchsia-200 shadow-[0_0_25px_rgba(217,70,239,0.3)]">
          {g.banner.text}
        </div>
      )}

      <div className="z-10 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-center">
        <div className="relative flex w-full max-w-[min(100%,calc(100vh-10rem))] flex-col gap-2 self-center lg:self-start" style={{ minWidth: 'min(100%, 320px)' }}>
          <div className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-2 ring-1 ring-white/10">
            <span className="font-display text-sm font-bold tracking-wider text-white">
              {!stand
                ? 'AWAITING STAND ARROW'
                : status.over
                  ? status.reason
                  : g.thinking
                    ? 'STOCKFISH THINKING…'
                    : myTurn
                      ? `YOUR MOVE (${myColor === 'w' ? 'WHITE' : 'BLACK'})`
                      : `OPPONENT'S MOVE (${game.turn === 'w' ? 'WHITE' : 'BLACK'})`}
            </span>
            <span className="text-xs text-slate-400">
              {p2p ? (
                <span className="rounded bg-sky-500/20 px-2 py-0.5 font-mono text-sky-300">P2P · {p2p.roomCode}</span>
              ) : (
                <>Engine: {g.engineState === 'ready' ? 'Stockfish 19 ✓' : g.engineState === 'loading' ? 'loading…' : 'fallback'}</>
              )}
            </span>
          </div>

          <div className="relative w-full aspect-square rounded-xl overflow-hidden shadow-[0_0_60px_rgba(217,70,239,0.2)] ring-1 ring-white/10">
            <Chessboard
              options={{
                id: 'stand-board',
                position: toStandPositionObject(game),
                pieces: customPieces,
                arrows,
                boardOrientation: myColor === 'w' ? 'white' : 'black',
                lightSquareStyle: { backgroundColor: LIGHT },
                darkSquareStyle: { backgroundColor: DARK },
                squareStyles,
                animationDurationInMs: 200,
                allowDrawingArrows: false,
                allowDragging: myTurn && !targetMode,
                canDragPiece: ({ piece }) => myTurn && !targetMode && piece.pieceType[0] === myColor,
                onPieceDrag: ({ square }) => { if (square) setSelected(fromAlg(square)) },
                onPieceDrop: ({ sourceSquare, targetSquare }) => (targetSquare ? attempt(fromAlg(sourceSquare), fromAlg(targetSquare)) : false),
                onSquareClick,
                squareRenderer: ({ square, children }) => {
                  const sq = fromAlg(square)
                  const bTurns = bombMap[sq]
                  const isDino = game.board[sq]?.dino
                  const isKq = game.killerQueenSq === sq
                  const isInv = myColor === 'w' && game.invisible?.sq === sq
                  return (
                    <div className="relative h-full w-full">
                      {children}
                      {bTurns != null && (
                        <span className="pointer-events-none absolute top-0.5 right-0.5 z-10 rounded bg-pink-600 px-1 text-[10px] font-black text-white shadow">
                          💣{bTurns}
                        </span>
                      )}
                      {isDino && (
                        <span className="pointer-events-none absolute top-0.5 left-0.5 z-10 text-xs drop-shadow">🦖</span>
                      )}
                      {isKq && (
                        <span className="pointer-events-none absolute bottom-0.5 right-0.5 z-10 text-xs drop-shadow">💣</span>
                      )}
                      {isInv && (
                        <span className="pointer-events-none absolute inset-1 z-10 rounded-lg border-2 border-dashed border-violet-400/60" />
                      )}
                    </div>
                  )
                },
              }}
            />

            {!stand && (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950/80 p-6 text-center backdrop-blur-sm">
                <div className="mb-3 text-6xl">🏹</div>
                <h2 className="font-display text-2xl font-black tracking-widest text-amber-300">AWAKEN YOUR STAND</h2>
                {myColor === 'w' ? (
                  <>
                    <p className="mt-2 max-w-xs text-sm text-slate-300">
                      Pierce yourself with the Stand Arrow to unlock 1 of 5 reality-bending abilities.
                    </p>
                    <button
                      onClick={g.pierceWithArrow}
                      className="glow-btn mt-6 rounded-full bg-amber-400 px-8 py-3.5 font-display text-sm font-black uppercase tracking-[0.2em] text-slate-950 transition hover:scale-105 hover:bg-amber-300"
                    >
                      Pierce with Arrow
                    </button>
                  </>
                ) : (
                  <p className="mt-2 max-w-xs text-sm text-sky-300">
                    Waiting for Host (White) to pierce with the Stand Arrow…
                  </p>
                )}
              </div>
            )}

            {promo && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm" onClick={() => setPromo(null)}>
                <div className="flex gap-3 rounded-2xl bg-slate-900 p-4 ring-1 ring-white/15" onClick={(e) => e.stopPropagation()}>
                  {promo.moves.map((m) => (
                    <button
                      key={m.promo}
                      onClick={() => { setPromo(null); g.playHumanMove(m) }}
                      className="h-16 w-16 rounded-xl bg-slate-800 p-1 transition hover:scale-110 hover:bg-fuchsia-500/30 sm:h-20 sm:w-20"
                    >
                      <PieceIcon piece={{ c: myColor, t: m.promo }} size="100%" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <aside className="flex w-full flex-col gap-3 lg:w-84">
          {stand && (
            <div className={`rounded-2xl border p-4 ${AURA[stand.color] || AURA.amber}`}>
              <div className="flex items-center justify-between">
                <span className="font-display text-lg font-black text-white">{stand.icon} {stand.name}</span>
                <span className="rounded bg-black/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-200">{stand.sub}</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-200">{stand.desc}</p>

              {myColor === 'w' ? (
                <div className="mt-3 flex flex-col gap-2">
                  {stand.id === 'king-crimson' && (
                  <button
                    onClick={g.activateEpitaph}
                    disabled={!myTurn || Boolean(game.fatedMove) || game.kcCooldown > 0}
                    className={`w-full rounded-lg px-3 py-2.5 font-display text-xs font-bold uppercase tracking-wider transition ${
                      game.kcCooldown > 0
                        ? 'cursor-not-allowed bg-slate-700 text-slate-400 grayscale'
                        : 'bg-red-600 text-white hover:bg-red-500 disabled:opacity-40'
                    }`}
                  >
                    {game.fatedMove
                      ? `👁️ Fate Locked (${toAlg(game.fatedMove.from)}→${toAlg(game.fatedMove.to)})`
                      : game.kcCooldown > 0
                        ? `⏳ Cooldown: ${game.kcCooldown}`
                        : '👁️ Epitaph: Forecast & Lock Fate'}
                  </button>
                )}

                {stand.id === 'killer-queen' && (
                  <>
                    <button
                      onClick={() => g.setTargetMode(targetMode === 'kq-assign' ? null : 'kq-assign')}
                      disabled={!myTurn || game.killerQueenAssigned}
                      className={`w-full rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wider transition disabled:opacity-50 ${targetMode === 'kq-assign' ? 'bg-pink-400 text-slate-950' : 'bg-pink-600/80 text-white hover:bg-pink-500'}`}
                    >
                      {game.killerQueenAssigned
                        ? (game.killerQueenSq != null ? `💣 Bound @ ${toAlg(game.killerQueenSq)} (Locked)` : '💣 Killer Queen Destroyed')
                        : targetMode === 'kq-assign'
                          ? 'Click any White piece…'
                          : '💣 Assign Killer Queen (Once)'}
                    </button>
                    <button
                      onClick={() => g.setTargetMode(targetMode === 'kq-bomb' ? null : 'kq-bomb')}
                      disabled={!myTurn || kqTargets.length === 0 || game.kqCooldown > 0 || game.bombs.length > 0}
                      className={`w-full rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wider transition disabled:opacity-40 ${targetMode === 'kq-bomb' ? 'bg-amber-400 text-slate-950' : 'bg-rose-600 text-white hover:bg-rose-500'}`}
                    >
                      {game.bombs.length > 0
                        ? `💣 Bomb Armed (${game.bombs[0].turnsLeft}t)`
                        : game.kqCooldown > 0
                          ? `⏳ Bomb Recharging (${game.kqCooldown}t)`
                          : targetMode === 'kq-bomb'
                            ? 'Click attacked enemy…'
                            : `💥 Plant Bomb (${kqTargets.length} attacked)`}
                    </button>
                  </>
                )}

                {stand.id === 'hey-ya' && (
                  <button
                    onClick={g.armBlunder}
                    disabled={!myTurn || game.heyYaUses <= 0 || game.blunderArmed}
                    className="w-full rounded-lg bg-amber-500 px-3 py-2.5 font-display text-xs font-bold uppercase tracking-wider text-slate-950 transition hover:bg-amber-400 disabled:opacity-40"
                  >
                    {game.blunderArmed ? '🍀 Blunder Armed for Black!' : `🍀 Force Blunder (${game.heyYaUses} left)`}
                  </button>
                )}

                {stand.id === 'scary-monsters' && (
                  <button
                    onClick={() => g.setTargetMode(targetMode === 'dino-assign' ? null : 'dino-assign')}
                    disabled={!myTurn || game.dinoLeaderAssigned}
                    className={`w-full rounded-lg px-3 py-2.5 text-xs font-bold uppercase tracking-wider transition disabled:opacity-50 ${targetMode === 'dino-assign' ? 'bg-emerald-300 text-slate-950' : 'bg-emerald-600 text-white hover:bg-emerald-500'}`}
                  >
                    {game.dinoLeaderAssigned
                      ? (game.dinoLeaderSq != null ? `🦖 Leader @ ${toAlg(game.dinoLeaderSq)} (Locked)` : '🦖 Dino Leader Fallen')
                      : targetMode === 'dino-assign'
                        ? 'Click any White piece…'
                        : '🦖 Assign Dino Leader (Once)'}
                  </button>
                )}

                {stand.id === 'bigmouth' && (
                  <button
                    onClick={() => g.setTargetMode(targetMode === 'bigmouth-cloak' ? null : 'bigmouth-cloak')}
                    disabled={!myTurn || Boolean(game.invisible) || game.cloakCooldown > 0}
                    className={`w-full rounded-lg px-3 py-2.5 text-xs font-bold uppercase tracking-wider transition disabled:opacity-40 ${targetMode === 'bigmouth-cloak' ? 'bg-violet-300 text-slate-950' : 'bg-violet-600 text-white hover:bg-violet-500'}`}
                  >
                    {game.invisible
                      ? `👻 Cloaked @ ${toAlg(game.invisible.sq)} (${game.invisible.turnsLeft}r left)`
                      : game.cloakCooldown > 0
                        ? `⏳ Recharging (${game.cloakCooldown}r left)`
                        : targetMode === 'bigmouth-cloak'
                          ? 'Click White non-king piece…'
                          : '👻 Cloak Friendly Piece'}
                  </button>
                )}
                  </div>
                ) : (
                  <p className="mt-3 text-xs font-semibold text-sky-300">
                    Playing Black (Standard Chess) vs White’s Stand!
                  </p>
                )}
            </div>
          )}

          <div className="scroll-thin h-48 overflow-y-auto rounded-xl bg-black/30 p-2 font-mono text-xs ring-1 ring-white/10">
            {g.history.length === 0 && <p className="p-1 text-slate-500">No moves yet.</p>}
            {g.history.map((h, i) => (
              <div key={i} className="rounded px-2 py-0.5 odd:bg-white/[0.03]">
                <span className="mr-2 text-slate-500">{i + 1}.</span>
                <span className={h.color === 'w' ? 'text-amber-200' : 'text-sky-300'}>{h.san}</span>
              </div>
            ))}
          </div>

          {Boolean(p2p) && adminUnlocked && (
            <div className="rounded-xl border border-amber-400/50 bg-amber-500/10 p-3 shadow-[0_0_25px_rgba(245,158,11,0.2)]">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-display text-xs font-black uppercase tracking-widest text-amber-300">
                  👑 God Mode
                </span>
                <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-200">
                  ADMIN
                </span>
              </div>
              <button
                onClick={g.spawnExtraPawn}
                disabled={status.over}
                className="w-full rounded-lg bg-amber-400 px-3 py-2 font-display text-xs font-black uppercase tracking-wider text-slate-950 transition hover:bg-amber-300 active:scale-95 disabled:opacity-40"
              >
                + Spawn Extra Pawn
              </button>
            </div>
          )}

          <div className={`grid gap-3 ${myColor === 'w' ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {myColor === 'w' && (
              <button onClick={g.pierceWithArrow} className="rounded-lg bg-amber-500/15 px-3 py-2.5 text-xs font-semibold text-amber-200 ring-1 ring-amber-400/30 hover:bg-amber-500/25">
                🏹 Re-roll Stand
              </button>
            )}
            <button onClick={onMenu} className="rounded-lg bg-white/10 px-3 py-2.5 text-xs font-semibold text-slate-200 ring-1 ring-white/15 hover:bg-white/20">
              Main Menu
            </button>
          </div>
        </aside>
      </div>

      {showAdminModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
          onClick={() => setShowAdminModal(false)}
        >
          <form
            onSubmit={submitAdminPassword}
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-xs rounded-2xl border border-white/15 bg-slate-900 p-5 shadow-2xl ${adminShake ? 'animate-shake' : ''}`}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="font-display text-xs font-bold uppercase tracking-widest text-amber-300">
                Admin Access
              </span>
              <button type="button" onClick={() => setShowAdminModal(false)} className="text-xs text-slate-400 hover:text-white">✕</button>
            </div>
            <input
              type="password"
              autoFocus
              value={adminPassword}
              onChange={(e) => { setAdminPassword(e.target.value); setAdminError('') }}
              placeholder="Enter password"
              className="w-full rounded-xl border border-white/15 bg-black/40 px-3.5 py-2 text-sm text-white outline-none focus:border-amber-400"
            />
            {adminError && <p className="mt-2 text-xs font-semibold text-rose-400">{adminError}</p>}
            <button
              type="submit"
              className="mt-3 w-full rounded-xl bg-amber-400 px-4 py-2 font-display text-xs font-black uppercase tracking-widest text-slate-950 transition hover:bg-amber-300"
            >
              Unlock
            </button>
          </form>
        </div>
      )}

      {status.over && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-6 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-slate-900 p-8 text-center shadow-[0_0_80px_rgba(245,158,11,0.3)] ring-1 ring-white/15">
            <div className="font-display text-3xl font-black text-amber-300">{status.reason}</div>
            <p className="mt-2 text-slate-400">{status.winner ? `${status.winner === 'w' ? 'White' : 'Black'} wins!` : 'Draw!'}</p>
            <div className={`mt-6 grid gap-3 ${myColor === 'w' ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {myColor === 'w' && (
                <button onClick={g.pierceWithArrow} className="rounded-xl bg-amber-400 px-4 py-3 font-semibold text-slate-950 hover:bg-amber-300">Play Again</button>
              )}
              <button onClick={onMenu} className="rounded-xl bg-white/10 px-4 py-3 font-semibold hover:bg-white/20">Main Menu</button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
