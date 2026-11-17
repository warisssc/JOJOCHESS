import { useCallback, useEffect, useRef, useState } from 'react'
import { StockfishEngine } from '../engine/stockfishClient'
import { sfx } from './soundFx'
import {
  applyStandAiMove, applyStandHumanMove, createStandState,
  rollRandomStand, STANDS, standLegalMoves, standStatus, toAiFen,
} from './standRules'
import { describeMove, fromAlg, legalMoves, toAlg } from '../game/rules'

export function useStandGame() {
  const [game, setGame] = useState(() => createStandState(null))
  const [history, setHistory] = useState([])
  const [lastMove, setLastMove] = useState(null)
  const [thinking, setThinking] = useState(false)
  const [engineState, setEngineState] = useState('loading')
  const [banner, setBanner] = useState(null) // { text, style }
  const [cutscene, setCutscene] = useState(null) // { icon, title, subtitle, color }
  const [targetMode, setTargetMode] = useState(null) // 'kq-assign' | 'kq-bomb' | 'dino-assign' | 'bigmouth-cloak'
  const [glitchFx, setGlitchFx] = useState(false)
  const [heyYaHint, setHeyYaHint] = useState(null) // { from, to }
  const [heyYaCheer, setHeyYaCheer] = useState(false)
  const [blastFx, setBlastFx] = useState([])

  const engineRef = useRef(null)
  const bannerTimer = useRef(null)
  const cutsceneTimer = useRef(null)
  const status = standStatus(game)
  const stand = STANDS.find((s) => s.id === game.standId) || null

  useEffect(() => {
    const engine = new StockfishEngine()
    engineRef.current = engine
    engine.start().then(() => setEngineState('ready')).catch(() => setEngineState('fallback'))
    return () => { engine.terminate(); engineRef.current = null }
  }, [])

  const popup = useCallback((text, style = 'default') => {
    setBanner({ text, style })
    if (bannerTimer.current) clearTimeout(bannerTimer.current)
    bannerTimer.current = setTimeout(() => setBanner(null), 5000)
  }, [])

  const playCutscene = useCallback((data) => {
    setCutscene(data)
    if (cutsceneTimer.current) clearTimeout(cutsceneTimer.current)
    cutsceneTimer.current = setTimeout(() => setCutscene(null), 1150)
  }, [])

  const skipCutscene = useCallback(() => {
    if (cutsceneTimer.current) clearTimeout(cutsceneTimer.current)
    setCutscene(null)
  }, [])

  const pierceWithArrow = useCallback(() => {
    const chosen = rollRandomStand()
    sfx.draftOpen()
    setGame(createStandState(chosen.id))
    setHistory([])
    setLastMove(null)
    setHeyYaHint(null)
    setHeyYaCheer(false)
    setTargetMode(null)
    playCutscene({
      icon: chosen.icon,
      title: chosen.name,
      subtitle: `STAND AWAKENED — ${chosen.sub}`,
      color: chosen.color,
    })
    popup(`🏹 STAND AWAKENED: ${chosen.name.toUpperCase()} (${chosen.sub})!`, chosen.color)
  }, [popup, playCutscene])

  const playHumanMove = useCallback((move) => {
    if (!game.standId || game.turn !== 'w' || status.over) return
    setHeyYaHint(null)
    setHeyYaCheer(false)
    setTargetMode(null)

    const { state: next, events, blastedSquares } = applyStandHumanMove(game, move)
    const st = standStatus(next)
    const san = describeMove(move, st)
    if (blastedSquares.length) {
      sfx.lightning()
      setBlastFx(blastedSquares)
      setTimeout(() => setBlastFx([]), 900)
      playCutscene({
        icon: '💥',
        title: 'KILLER QUEEN',
        subtitle: 'BITES THE DUST — DETONATION!',
        color: 'pink',
      })
    } else if (events.some((e) => e.includes('SCARY MONSTERS'))) {
      sfx.chaos()
      playCutscene({
        icon: '🦖',
        title: 'SCARY MONSTERS',
        subtitle: 'DINO INFECTION SPREADS!',
        color: 'emerald',
      })
    } else if (move.capture) sfx.capture()
    else sfx.move()

    if (events.length) popup(events.join(' '), 'crimson')
    setGame(next)
    setLastMove({ from: move.from, to: move.to })
    setHistory((h) => [...h, { san, color: 'w' }])
  }, [game, status.over, popup, playCutscene])

  // ---- Stand 1: King Crimson (Epitaph + Fate Lock)
  const activateEpitaph = useCallback(async () => {
    if (game.standId !== 'king-crimson' || game.turn !== 'w' || status.over || game.fatedMove || game.kcCooldown > 0) return
    sfx.chaos()
    setGlitchFx(true)
    setTimeout(() => setGlitchFx(false), 950)
    playCutscene({
      icon: '👁️',
      title: 'KING CRIMSON',
      subtitle: 'EPITAPH — TIME HAS BEEN ERASED!',
      color: 'crimson',
    })

    let uci = null
    try {
      const res = await engineRef.current?.analyze(toAiFen(game, 'b'), { movetime: 250 })
      uci = res?.bestmove || null
    } catch { /* fallback */ }

    if (!uci) {
      const bMoves = legalMoves({ ...game, turn: 'b' })
      if (bMoves.length) {
        const m = bMoves[Math.floor(Math.random() * bMoves.length)]
        uci = toAlg(m.from) + toAlg(m.to) + (m.promo || '')
      }
    }
    if (uci) {
      const from = fromAlg(uci.slice(0, 2))
      const to = fromAlg(uci.slice(2, 4))
      setGame((g) => ({ ...g, fatedMove: { uci, from, to } }))
      popup(`👁️ EPITAPH FATE LOCKED: Black MUST play ${uci.slice(0, 2)} → ${uci.slice(2, 4)}!`, 'crimson')
    }
  }, [game, status.over, popup, playCutscene])

  // ---- Stand 2: Killer Queen (Once per game)
  const assignKillerQueen = useCallback((sq) => {
    const p = game.board[sq]
    if (!p || p.c !== 'w' || game.killerQueenAssigned) return
    sfx.cardPick()
    setGame((g) => ({ ...g, killerQueenSq: sq, killerQueenAssigned: true }))
    setTargetMode(null)
    playCutscene({
      icon: '💣',
      title: 'KILLER QUEEN',
      subtitle: `PERMANENTLY BOUND TO ${p.t.toUpperCase()} ON ${toAlg(sq)}!`,
      color: 'pink',
    })
    popup(`💣 Killer Queen permanently bound to ${p.t.toUpperCase()} on ${toAlg(sq)}!`, 'pink')
  }, [game.board, game.killerQueenAssigned, popup, playCutscene])

  const plantBomb = useCallback((sq) => {
    const p = game.board[sq]
    if (!p || p.c !== 'b' || p.t === 'k' || game.kqCooldown > 0 || game.bombs.length > 0) return
    sfx.chaos()
    setGame((g) => ({ ...g, bombs: [...g.bombs, { sq, turnsLeft: 2 }] }))
    setTargetMode(null)
    playCutscene({
      icon: '💣',
      title: 'FIRST BOMB',
      subtitle: `PLANTED ON ${toAlg(sq)} — 2 TURNS TO DETONATION!`,
      color: 'pink',
    })
    popup(`💣 First Bomb planted on ${toAlg(sq)}! Detonates in 2 turns.`, 'pink')
  }, [game.kqCooldown, game.bombs.length, popup, playCutscene])

  // ---- Stand 3: Hey Ya!
  const armBlunder = useCallback(() => {
    if (game.standId !== 'hey-ya' || game.heyYaUses <= 0 || game.blunderArmed) return
    sfx.cardPick()
    setGame((g) => ({ ...g, heyYaUses: g.heyYaUses - 1, blunderArmed: true }))
    playCutscene({
      icon: '🍀',
      title: 'HEY YA!',
      subtitle: 'ULTIMATE LUCK — BLACK WILL BLUNDER!',
      color: 'amber',
    })
    popup('🍀 HEY YA! Black’s next move is cursed to be a BLUNDER!', 'amber')
  }, [game.standId, game.heyYaUses, game.blunderArmed, popup, playCutscene])

  // ---- Stand 4: Scary Monsters (Once per game)
  const assignDinoLeader = useCallback((sq) => {
    const p = game.board[sq]
    if (!p || p.c !== 'w' || game.dinoLeaderAssigned) return
    sfx.cardPick()
    setGame((g) => {
      const board = g.board.map((x, i) => (i === sq ? { ...x, dino: true } : x))
      return { ...g, board, dinoLeaderSq: sq, dinoLeaderAssigned: true }
    })
    setTargetMode(null)
    playCutscene({
      icon: '🦖',
      title: 'SCARY MONSTERS',
      subtitle: `USHAAA! ${p.t.toUpperCase()} ON ${toAlg(sq)} IS THE DINO LEADER!`,
      color: 'emerald',
    })
    popup(`🦖 ${p.t.toUpperCase()} on ${toAlg(sq)} is permanently the Dino Leader!`, 'emerald')
  }, [game.board, game.dinoLeaderAssigned, popup, playCutscene])

  // ---- Stand 5: Bigmouth Strikes Again
  const cloakPiece = useCallback((sq) => {
    const p = game.board[sq]
    if (!p || p.c !== 'w' || p.t === 'k' || game.invisible || game.cloakCooldown > 0) return
    sfx.chaos()
    setGame((g) => ({ ...g, invisible: { sq, turnsLeft: 3 } }))
    setTargetMode(null)
    playCutscene({
      icon: '👻',
      title: 'BIGMOUTH STRIKES AGAIN',
      subtitle: `${p.t.toUpperCase()} ON ${toAlg(sq)} VANISHED FOR 3 ROUNDS!`,
      color: 'violet',
    })
    popup(`👻 ${p.t.toUpperCase()} on ${toAlg(sq)} turned INVISIBLE for 3 rounds!`, 'violet')
  }, [game.board, game.invisible, game.cloakCooldown, popup, playCutscene])

  // ---- Black AI Turn (honors King Crimson Fate Lock!)
  useEffect(() => {
    if (!game.standId || status.over || game.turn !== 'b') return
    let cancelled = false
    setThinking(true)
    const started = Date.now()

    ;(async () => {
      const engine = engineRef.current
      let uci = null
      let fateBroken = false

      // 1. Check King Crimson Fate Lock
      if (game.fatedMove) {
        const legal = standLegalMoves(game)
        const isStillLegal = legal.some((m) => (toAlg(m.from) + toAlg(m.to) + (m.promo || '')) === game.fatedMove.uci)
        if (isStillLegal) {
          uci = game.fatedMove.uci
        } else {
          fateBroken = true
        }
      }

      // 2. Otherwise query Stockfish
      if (!uci) {
        const aiFen = toAiFen(game)
        try {
          if (engine && !engine.dead) {
            if (game.blunderArmed) {
              const res = await engine.analyze(aiFen, { movetime: 300, multiPv: 20 })
              uci = res.lines?.length ? res.lines[res.lines.length - 1].move : res.bestmove
            } else {
              const res = await engine.analyze(aiFen, { movetime: 320 })
              uci = res.bestmove
            }
          }
        } catch { /* fallback */ }

        if (!uci) {
          const bMoves = standLegalMoves(game)
          if (bMoves.length) {
            const m = bMoves[Math.floor(Math.random() * bMoves.length)]
            uci = toAlg(m.from) + toAlg(m.to) + (m.promo || '')
          }
        }
      }

      const wait = Math.max(0, 550 - (Date.now() - started))
      await new Promise((r) => setTimeout(r, wait))
      if (cancelled) return
      setThinking(false)
      if (!uci) return

      const wasBlunder = game.blunderArmed
      const wasFated = Boolean(game.fatedMove && !fateBroken)
      const { state: afterAi, events, shankedSq, from, to } = applyStandAiMove(game, uci)
      const nextState = {
        ...afterAi,
        blunderArmed: false,
        fatedMove: null,
        kcCooldown: game.fatedMove ? 2 : afterAi.kcCooldown,
      }
      const st = standStatus(nextState)

      if (shankedSq != null) {
        sfx.lightning()
        setBlastFx([shankedSq])
        setTimeout(() => setBlastFx([]), 900)
        playCutscene({
          icon: '🗡️',
          title: 'AMBUSH SHANK!',
          subtitle: 'BIGMOUTH STRIKES AGAIN REVEALED!',
          color: 'violet',
        })
        popup(events[0], 'violet')
        setHistory((h) => [...h, { san: `🗡️ SHANK @ ${toAlg(shankedSq)}`, color: 'b' }])
      } else {
        sfx.move()
        if (fateBroken) popup('👁️ Fated move was illegal! Black calculated a new move.', 'crimson')
        else if (wasFated) popup(`👁️ FATE FULFILLED: Black was forced to play ${uci}!`, 'crimson')
        else if (wasBlunder) popup('🍀 HEY YA! Black blundered!', 'amber')
        setLastMove(from != null ? { from, to } : null)
        setHistory((h) => [...h, { san: `${uci}${st.check ? '+' : ''}`, color: 'b' }])
      }
      setGame(nextState)

      // Hey Ya! Reliable 1-3 turn counter trigger at start of White's turn
      if (!st.over && nextState.standId === 'hey-ya' && nextState.heyYaCounter <= 0) {
        let bestUci = null
        if (engine && !engine.dead) {
          try {
            const hint = await engine.analyze(toAiFen(nextState, 'w'), { movetime: 250 })
            bestUci = hint?.bestmove || null
          } catch { /* fallback below */ }
        }
        if (!bestUci) {
          const wMoves = standLegalMoves(nextState)
          if (wMoves.length) {
            const m = wMoves[Math.floor(Math.random() * wMoves.length)]
            bestUci = toAlg(m.from) + toAlg(m.to) + (m.promo || '')
          }
        }
        if (!cancelled) {
          const nextCounter = Math.floor(Math.random() * 3) + 1
          setGame((g) => ({ ...g, heyYaCounter: nextCounter }))
          if (bestUci) {
            setHeyYaCheer(true)
            setHeyYaHint({ from: fromAlg(bestUci.slice(0, 2)), to: fromAlg(bestUci.slice(2, 4)) })
            sfx.cardPick()
            playCutscene({
              icon: '🍀',
              title: 'HEY YA!',
              subtitle: `PURE LUCK — TRY ${bestUci.slice(0, 2)} → ${bestUci.slice(2, 4)}!`,
              color: 'amber',
            })
            popup(`🍀 HEY YA! Green arrow shows White’s best move (${bestUci.slice(0, 2)} → ${bestUci.slice(2, 4)})!`, 'amber')
          }
        }
      }
    })()

    return () => { cancelled = true }
  }, [game, status.over, popup, playCutscene])

  return {
    game,
    stand,
    status,
    history,
    lastMove,
    thinking,
    engineState,
    banner,
    cutscene,
    skipCutscene,
    targetMode,
    setTargetMode,
    glitchFx,
    heyYaHint,
    heyYaCheer,
    blastFx,
    pierceWithArrow,
    playHumanMove,
    activateEpitaph,
    assignKillerQueen,
    plantBomb,
    armBlunder,
    assignDinoLeader,
    cloakPiece,
  }
}
