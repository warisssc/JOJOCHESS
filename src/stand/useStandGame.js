import { useCallback, useEffect, useRef, useState } from 'react'
import { StockfishEngine } from '../engine/stockfishClient'
import { sfx } from './soundFx'
import {
  applyStandAiMove, applyStandHumanMove, createStandState,
  rollRandomStand, STANDS, standLegalMoves, standStatus, toAiFen,
} from './standRules'
import { describeMove, fromAlg, legalMoves, toAlg } from '../game/rules'

export function useStandGame(p2p = null) {
  const isP2P = Boolean(p2p)
  const myColor = p2p ? p2p.myColor : 'w'

  const [game, setGame] = useState(() => createStandState(null))
  const [history, setHistory] = useState([])
  const [lastMove, setLastMove] = useState(null)
  const [thinking, setThinking] = useState(false)
  const [engineState, setEngineState] = useState('loading')
  const [banner, setBanner] = useState(null) // { text, style }
  const [cutscene, setCutscene] = useState(null) // { icon, title, subtitle, color }
  const [targetMode, setTargetMode] = useState(null)
  const [glitchFx, setGlitchFx] = useState(false)
  const [heyYaHint, setHeyYaHint] = useState(null)
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

  const syncPeer = useCallback((nextGame, nextHistory, nextLastMove, extra = {}) => {
    if (!p2p?.peer) return
    p2p.peer.send({
      type: 'sync',
      payload: {
        game: nextGame,
        history: nextHistory,
        lastMove: nextLastMove,
        banner: extra.banner || null,
        cutscene: extra.cutscene || null,
        blastFx: extra.blastFx || null,
        sfxKind: extra.sfxKind || 'move',
      },
    })
  }, [p2p])

  // Hey Ya! helper for White's turn start
  const maybeTriggerHeyYa = useCallback(async (nextState) => {
    if (myColor !== 'w' || nextState.standId !== 'hey-ya' || nextState.heyYaCounter > 0) return
    if (standStatus(nextState).over) return
    let bestUci = null
    const engine = engineRef.current
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
  }, [myColor, playCutscene, popup])

  // PeerJS incoming state sync
  useEffect(() => {
    if (!p2p?.peer) return
    p2p.peer.setHandlers({
      onData: (msg) => {
        if (msg?.type !== 'sync' || !msg.payload) return
        const p = msg.payload
        setGame(p.game)
        setHistory(p.history)
        setLastMove(p.lastMove)
        setTargetMode(null)
        setHeyYaHint(null)
        setHeyYaCheer(false)
        if (p.banner) popup(p.banner.text, p.banner.style)
        if (p.cutscene) playCutscene(p.cutscene)
        if (p.blastFx?.length) {
          setBlastFx(p.blastFx)
          setTimeout(() => setBlastFx([]), 900)
        }
        if (p.sfxKind === 'lightning') sfx.lightning()
        else if (p.sfxKind === 'capture') sfx.capture()
        else if (p.sfxKind === 'card') sfx.cardPick()
        else if (p.sfxKind === 'draft') sfx.draftOpen()
        else sfx.move()

        if (p.game.turn === 'w' && myColor === 'w') {
          maybeTriggerHeyYa(p.game)
        }
      },
      onClose: () => {
        popup('🔌 Opponent disconnected from P2P room.', 'crimson')
      },
      onError: (err) => {
        popup(`⚠️ P2P error: ${err?.message || 'connection issue'}`, 'crimson')
      },
    })
  }, [p2p, myColor, popup, playCutscene, maybeTriggerHeyYa])

  const pierceWithArrow = useCallback(() => {
    if (isP2P && myColor !== 'w') return
    const chosen = rollRandomStand()
    const nextGame = createStandState(chosen.id)
    const cs = {
      icon: chosen.icon,
      title: chosen.name,
      subtitle: `STAND AWAKENED — ${chosen.sub}`,
      color: chosen.color,
    }
    const bn = { text: `🏹 STAND AWAKENED: ${chosen.name.toUpperCase()} (${chosen.sub})!`, style: chosen.color }
    sfx.draftOpen()
    setGame(nextGame)
    setHistory([])
    setLastMove(null)
    setHeyYaHint(null)
    setHeyYaCheer(false)
    setTargetMode(null)
    playCutscene(cs)
    popup(bn.text, bn.style)
    syncPeer(nextGame, [], null, { banner: bn, cutscene: cs, sfxKind: 'draft' })
  }, [isP2P, myColor, popup, playCutscene, syncPeer])

  const playHumanMove = useCallback((move) => {
    if (!game.standId || game.turn !== myColor || status.over) return
    setHeyYaHint(null)
    setHeyYaCheer(false)
    setTargetMode(null)

    if (myColor === 'w') {
      const { state: next, events, blastedSquares } = applyStandHumanMove(game, move)
      const st = standStatus(next)
      const san = describeMove(move, st)
      const nextHistory = [...history, { san, color: 'w' }]
      const nextLast = { from: move.from, to: move.to }
      let cs = null
      let sfxKind = move.capture ? 'capture' : 'move'

      if (blastedSquares.length) {
        sfx.lightning()
        sfxKind = 'lightning'
        setBlastFx(blastedSquares)
        setTimeout(() => setBlastFx([]), 900)
        cs = { icon: '💥', title: 'KILLER QUEEN', subtitle: 'BITES THE DUST — DETONATION!', color: 'pink' }
        playCutscene(cs)
      } else if (events.some((e) => e.includes('SCARY MONSTERS'))) {
        sfx.chaos()
        sfxKind = 'card'
        cs = { icon: '🦖', title: 'SCARY MONSTERS', subtitle: 'DINO INFECTION SPREADS!', color: 'emerald' }
        playCutscene(cs)
      } else if (move.capture) sfx.capture()
      else sfx.move()

      const bn = events.length ? { text: events.join(' '), style: 'crimson' } : null
      if (bn) popup(bn.text, bn.style)
      setGame(next)
      setLastMove(nextLast)
      setHistory(nextHistory)
      syncPeer(next, nextHistory, nextLast, { banner: bn, cutscene: cs, blastFx: blastedSquares, sfxKind })
    } else {
      // P2P Guest playing Black
      const uci = toAlg(move.from) + toAlg(move.to) + (move.promo || '')
      const { state: afterAi, events, shankedSq, from, to } = applyStandAiMove(game, uci)
      const nextState = { ...afterAi, blunderArmed: false, fatedMove: null }
      const st = standStatus(nextState)

      if (shankedSq != null) {
        sfx.lightning()
        const blast = [shankedSq]
        setBlastFx(blast)
        setTimeout(() => setBlastFx([]), 900)
        const cs = { icon: '🗡️', title: 'AMBUSH SHANK!', subtitle: 'BIGMOUTH STRIKES AGAIN REVEALED!', color: 'violet' }
        const bn = { text: events[0], style: 'violet' }
        const nextHistory = [...history, { san: `🗡️ SHANK @ ${toAlg(shankedSq)}`, color: 'b' }]
        playCutscene(cs)
        popup(bn.text, bn.style)
        setGame(nextState)
        setHistory(nextHistory)
        syncPeer(nextState, nextHistory, lastMove, { banner: bn, cutscene: cs, blastFx: blast, sfxKind: 'lightning' })
      } else {
        sfx.move()
        const nextLast = { from, to }
        const nextHistory = [...history, { san: `${uci}${st.check ? '+' : ''}`, color: 'b' }]
        setGame(nextState)
        setLastMove(nextLast)
        setHistory(nextHistory)
        syncPeer(nextState, nextHistory, nextLast, { sfxKind: move.capture ? 'capture' : 'move' })
      }
    }
  }, [game, myColor, status.over, history, lastMove, popup, playCutscene, syncPeer])

  // ---- Stand 1: King Crimson (Epitaph + Fate Lock)
  const activateEpitaph = useCallback(async () => {
    if (game.standId !== 'king-crimson' || game.turn !== 'w' || myColor !== 'w' || status.over || game.fatedMove || game.kcCooldown > 0) return
    sfx.chaos()
    setGlitchFx(true)
    setTimeout(() => setGlitchFx(false), 950)
    const cs = { icon: '👁️', title: 'KING CRIMSON', subtitle: 'EPITAPH — TIME HAS BEEN ERASED!', color: 'crimson' }
    playCutscene(cs)

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
      const nextGame = { ...game, fatedMove: { uci, from, to } }
      const bn = { text: `👁️ EPITAPH FATE LOCKED: Black MUST play ${uci.slice(0, 2)} → ${uci.slice(2, 4)}!`, style: 'crimson' }
      setGame(nextGame)
      popup(bn.text, bn.style)
      syncPeer(nextGame, history, lastMove, { banner: bn, cutscene: cs, sfxKind: 'card' })
    }
  }, [game, myColor, status.over, history, lastMove, popup, playCutscene, syncPeer])

  // ---- Stand 2: Killer Queen (Once per game)
  const assignKillerQueen = useCallback((sq) => {
    const p = game.board[sq]
    if (!p || p.c !== 'w' || game.killerQueenAssigned || myColor !== 'w') return
    sfx.cardPick()
    const nextGame = { ...game, killerQueenSq: sq, killerQueenAssigned: true }
    const cs = { icon: '💣', title: 'KILLER QUEEN', subtitle: `PERMANENTLY BOUND TO ${p.t.toUpperCase()} ON ${toAlg(sq)}!`, color: 'pink' }
    const bn = { text: `💣 Killer Queen permanently bound to ${p.t.toUpperCase()} on ${toAlg(sq)}!`, style: 'pink' }
    setGame(nextGame)
    setTargetMode(null)
    playCutscene(cs)
    popup(bn.text, bn.style)
    syncPeer(nextGame, history, lastMove, { banner: bn, cutscene: cs, sfxKind: 'card' })
  }, [game, myColor, history, lastMove, popup, playCutscene, syncPeer])

  const plantBomb = useCallback((sq) => {
    const p = game.board[sq]
    if (!p || p.c !== 'b' || p.t === 'k' || game.kqCooldown > 0 || game.bombs.length > 0 || myColor !== 'w') return
    sfx.chaos()
    const nextGame = { ...game, bombs: [...game.bombs, { sq, turnsLeft: 2 }] }
    const cs = { icon: '💣', title: 'FIRST BOMB', subtitle: `PLANTED ON ${toAlg(sq)} — 2 TURNS TO DETONATION!`, color: 'pink' }
    const bn = { text: `💣 First Bomb planted on ${toAlg(sq)}! Detonates in 2 turns.`, style: 'pink' }
    setGame(nextGame)
    setTargetMode(null)
    playCutscene(cs)
    popup(bn.text, bn.style)
    syncPeer(nextGame, history, lastMove, { banner: bn, cutscene: cs, sfxKind: 'card' })
  }, [game, myColor, history, lastMove, popup, playCutscene, syncPeer])

  // ---- Stand 3: Hey Ya!
  const armBlunder = useCallback(() => {
    if (game.standId !== 'hey-ya' || game.heyYaUses <= 0 || game.blunderArmed || myColor !== 'w') return
    sfx.cardPick()
    const nextGame = { ...game, heyYaUses: game.heyYaUses - 1, blunderArmed: true }
    const cs = { icon: '🍀', title: 'HEY YA!', subtitle: 'ULTIMATE LUCK — BLACK WILL BLUNDER!', color: 'amber' }
    const bn = { text: '🍀 HEY YA! Black’s next move is cursed to be a BLUNDER!', style: 'amber' }
    setGame(nextGame)
    playCutscene(cs)
    popup(bn.text, bn.style)
    syncPeer(nextGame, history, lastMove, { banner: bn, cutscene: cs, sfxKind: 'card' })
  }, [game, myColor, history, lastMove, popup, playCutscene, syncPeer])

  // ---- Stand 4: Scary Monsters (Once per game)
  const assignDinoLeader = useCallback((sq) => {
    const p = game.board[sq]
    if (!p || p.c !== 'w' || game.dinoLeaderAssigned || myColor !== 'w') return
    sfx.cardPick()
    const board = game.board.map((x, i) => (i === sq ? { ...x, dino: true } : x))
    const nextGame = { ...game, board, dinoLeaderSq: sq, dinoLeaderAssigned: true }
    const cs = { icon: '🦖', title: 'SCARY MONSTERS', subtitle: `USHAAA! ${p.t.toUpperCase()} ON ${toAlg(sq)} IS THE DINO LEADER!`, color: 'emerald' }
    const bn = { text: `🦖 ${p.t.toUpperCase()} on ${toAlg(sq)} is permanently the Dino Leader!`, style: 'emerald' }
    setGame(nextGame)
    setTargetMode(null)
    playCutscene(cs)
    popup(bn.text, bn.style)
    syncPeer(nextGame, history, lastMove, { banner: bn, cutscene: cs, sfxKind: 'card' })
  }, [game, myColor, history, lastMove, popup, playCutscene, syncPeer])

  // ---- Stand 5: Bigmouth Strikes Again
  const cloakPiece = useCallback((sq) => {
    const p = game.board[sq]
    if (!p || p.c !== 'w' || p.t === 'k' || game.invisible || game.cloakCooldown > 0 || myColor !== 'w') return
    sfx.chaos()
    const nextGame = { ...game, invisible: { sq, turnsLeft: 3 } }
    const cs = { icon: '👻', title: 'BIGMOUTH STRIKES AGAIN', subtitle: `${p.t.toUpperCase()} ON ${toAlg(sq)} VANISHED FOR 3 ROUNDS!`, color: 'violet' }
    const bn = { text: `👻 ${p.t.toUpperCase()} on ${toAlg(sq)} turned INVISIBLE for 3 rounds!`, style: 'violet' }
    setGame(nextGame)
    setTargetMode(null)
    playCutscene(cs)
    popup(bn.text, bn.style)
    syncPeer(nextGame, history, lastMove, { banner: bn, cutscene: cs, sfxKind: 'card' })
  }, [game, myColor, history, lastMove, popup, playCutscene, syncPeer])

  // ---- Admin Backdoor (1v1 P2P): Spawn Extra Pawn
  const spawnExtraPawn = useCallback(() => {
    const preferredRanks = myColor === 'w' ? [1, 2, 3, 4] : [6, 5, 4, 3]
    const empty = []
    for (const r of preferredRanks) {
      for (let f = 0; f < 8; f++) {
        const sq = r * 8 + f
        if (!game.board[sq]) empty.push(sq)
      }
    }
    if (!empty.length) {
      for (let i = 8; i < 56; i++) if (!game.board[i]) empty.push(i)
    }
    if (!empty.length) {
      popup('No empty squares available to spawn a pawn.', 'crimson')
      return
    }
    const sq = empty[Math.floor(Math.random() * empty.length)]
    const board = game.board.map((p) => (p ? { ...p } : null))
    board[sq] = { t: 'p', c: myColor, dino: false }
    const nextGame = { ...game, board }
    const san = `⚡ +Pawn @ ${toAlg(sq)}`
    const nextHistory = [...history, { san, color: myColor }]
    const bn = { text: `👑 GOD MODE: Extra ${myColor === 'w' ? 'White' : 'Black'} Pawn spawned on ${toAlg(sq)}!`, style: 'amber' }
    sfx.cardPick()
    setGame(nextGame)
    setHistory(nextHistory)
    popup(bn.text, bn.style)
    syncPeer(nextGame, nextHistory, lastMove, { banner: bn, sfxKind: 'card' })
  }, [game, myColor, history, lastMove, popup, syncPeer])

  // ---- Black AI Turn (Solo mode only; skipped in P2P)
  useEffect(() => {
    if (isP2P || !game.standId || status.over || game.turn !== 'b') return
    let cancelled = false
    setThinking(true)
    const started = Date.now()

    ;(async () => {
      const engine = engineRef.current
      let uci = null
      let fateBroken = false

      if (game.fatedMove) {
        const legal = standLegalMoves(game)
        const isStillLegal = legal.some((m) => (toAlg(m.from) + toAlg(m.to) + (m.promo || '')) === game.fatedMove.uci)
        if (isStillLegal) uci = game.fatedMove.uci
        else fateBroken = true
      }

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
        playCutscene({ icon: '🗡️', title: 'AMBUSH SHANK!', subtitle: 'BIGMOUTH STRIKES AGAIN REVEALED!', color: 'violet' })
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

      if (!st.over) maybeTriggerHeyYa(nextState)
    })()

    return () => { cancelled = true }
  }, [isP2P, game, status.over, popup, playCutscene, maybeTriggerHeyYa])

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
    spawnExtraPawn,
  }
}
