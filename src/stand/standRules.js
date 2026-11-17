/**
 * JoJo's Bizarre Adventure Stand Chess rules & True-vs-AI FEN sync.
 *
 * True Board State: owned by React (includes Dino flags, Killer Queen bombs,
 * Bigmouth invisible piece, etc.).
 * AI Board State: `toAiFen(state)` omits any invisible piece so Stockfish
 * genuinely believes that square is empty.
 */
import {
  WHITE, BLACK, opp, fileOf, rankOf, idx, inBoard, toAlg, fromAlg, legalMoves, isAttacked,
} from '../game/rules'

export const STANDS = [
  {
    id: 'king-crimson',
    name: 'King Crimson',
    sub: 'Epitaph',
    color: 'crimson',
    icon: '👁️',
    desc: 'Erase time to preview Black’s next best move in red before you make your move.',
  },
  {
    id: 'killer-queen',
    name: 'Killer Queen',
    sub: 'First Bomb',
    color: 'pink',
    icon: '💣',
    desc: 'Assign to a White piece. Plant a 2-turn bomb on any enemy in line-of-sight; detonates in a 5-square cross.',
  },
  {
    id: 'hey-ya',
    name: 'Hey Ya!',
    sub: 'Pure Luck',
    color: 'amber',
    icon: '🍀',
    desc: '35% chance each turn to highlight White’s best move in gold. Active (2 uses): force Black to play a blunder!',
  },
  {
    id: 'scary-monsters',
    name: 'Scary Monsters',
    sub: 'Dino Infection',
    color: 'emerald',
    icon: '🦖',
    desc: 'Assign a Dino Leader. Captures by the Leader or any Dino convert the victim into a friendly green Dino piece!',
  },
  {
    id: 'bigmouth',
    name: 'Bigmouth Strikes Again',
    sub: 'Ambush Cloak',
    color: 'violet',
    icon: '👻',
    desc: 'Cloak a friendly piece for 3 rounds (3-round cooldown). Hidden from Stockfish; moving onto/through it shanks the attacker!',
  },
]

export function rollRandomStand() {
  return STANDS[Math.floor(Math.random() * STANDS.length)]
}

export function createStandState(standId = null) {
  const board = new Array(64).fill(null)
  const back = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r']
  for (let f = 0; f < 8; f++) {
    board[idx(f, 0)] = { t: back[f], c: WHITE, dino: false }
    board[idx(f, 1)] = { t: 'p', c: WHITE, dino: false }
    board[idx(f, 6)] = { t: 'p', c: BLACK, dino: false }
    board[idx(f, 7)] = { t: back[f], c: BLACK, dino: false }
  }
  return {
    standId,
    board,
    turn: WHITE,
    castling: 'KQkq',
    ep: -1,
    halfmove: 0,
    fullmove: 1,
    // Stand-specific state
    killerQueenSq: null,
    killerQueenAssigned: false,
    kqCooldown: 0,
    bombs: [], // { sq, turnsLeft }
    fatedMove: null, // { uci, from, to } for King Crimson Fate Lock
    kcCooldown: 0,
    heyYaUses: 2,
    heyYaCounter: Math.floor(Math.random() * 3) + 1,
    blunderArmed: false,
    dinoLeaderSq: null,
    dinoLeaderAssigned: false,
    invisible: null, // { sq, turnsLeft }
    cloakCooldown: 0,
  }
}

/**
 * Generates the FEN sent to Stockfish.
 * For Bigmouth Strikes Again, the invisible piece is completely omitted so
 * Stockfish thinks the square is empty.
 */
export function toAiFen(s, turnOverride = null) {
  const invSq = s.invisible ? s.invisible.sq : -1
  const rows = []
  for (let r = 7; r >= 0; r--) {
    let row = ''
    let empty = 0
    for (let f = 0; f < 8; f++) {
      const sq = idx(f, r)
      const p = sq === invSq ? null : s.board[sq]
      if (!p) { empty++; continue }
      if (empty) { row += empty; empty = 0 }
      row += p.c === WHITE ? p.t.toUpperCase() : p.t
    }
    if (empty) row += empty
    rows.push(row)
  }
  let castling = s.castling
  if (invSq === 0) castling = castling.replace('Q', '')
  if (invSq === 7) castling = castling.replace('K', '')
  const turn = turnOverride || s.turn
  const ep = turnOverride && turnOverride !== s.turn ? '-' : (s.ep >= 0 ? toAlg(s.ep) : '-')
  return `${rows.join('/')} ${turn} ${castling || '-'} ${ep} ${s.halfmove} ${s.fullmove}`
}

export function toStandPositionObject(s) {
  const out = {}
  const invSq = s.invisible ? s.invisible.sq : -1
  for (let i = 0; i < 64; i++) {
    if (i === invSq) continue // Hidden on UI while invisible
    const p = s.board[i]
    if (p) out[toAlg(i)] = { pieceType: p.c + p.t.toUpperCase() }
  }
  return out
}

export function standLegalMoves(s) {
  return legalMoves(s)
}

export function standStatus(s) {
  const k = s.board.findIndex((p) => p && p.t === 'k' && p.c === s.turn)
  const check = k >= 0 && isAttacked(s.board, k, opp(s.turn))
  const moves = standLegalMoves(s)
  if (moves.length === 0) {
    if (check) return { over: true, check, winner: opp(s.turn), reason: 'Checkmate' }
    return { over: true, check, winner: null, reason: 'Stalemate' }
  }
  return { over: false, check, winner: null, reason: '' }
}

/**
 * Killer Queen targeted bombing: returns enemy non-king squares currently
 * attacked (legal capture target) by the assigned Killer Queen piece.
 */
export function killerQueenTargets(s) {
  if (s.standId !== 'killer-queen' || s.killerQueenSq == null || s.kqCooldown > 0 || s.bombs.length > 0) return []
  const kq = s.board[s.killerQueenSq]
  if (!kq || kq.c !== WHITE) return []
  const moves = legalMoves(s)
  const targets = new Set()
  for (const m of moves) {
    if (m.from === s.killerQueenSq && m.capture && s.board[m.to]?.c === BLACK && s.board[m.to]?.t !== 'k') {
      targets.add(m.to)
    }
  }
  return [...targets]
}

const CORNER_RIGHTS = { 0: 'Q', 7: 'K', 56: 'q', 63: 'k' }

export function applyStandHumanMove(s, m) {
  const board = s.board.map((p) => (p ? { ...p } : null))
  const mover = board[m.from]
  const events = []
  let castling = s.castling
  let killerQueenSq = s.killerQueenSq
  let dinoLeaderSq = s.dinoLeaderSq
  let invisible = s.invisible ? { ...s.invisible } : null
  let cloakCooldown = s.cloakCooldown

  const isDinoAttacker =
    s.standId === 'scary-monsters' && (m.from === dinoLeaderSq || mover.dino)

  if (m.capture && !m.ep && isDinoAttacker && board[m.to] && board[m.to].t !== 'k') {
    // Scary Monsters infection: attacker stays on `from`, captured enemy becomes a friendly green Dino on `to`!
    const victim = board[m.to]
    board[m.to] = { t: victim.t, c: WHITE, dino: true }
    events.push(`🦖 SCARY MONSTERS! Infected ${victim.t.toUpperCase()} on ${toAlg(m.to)}!`)
  } else {
    for (const sq of m.squashed) board[sq] = null
    board[m.from] = null
    board[m.to] = m.promo ? { t: m.promo, c: WHITE, dino: mover.dino } : mover
    if (m.castle) {
      const home = rankOf(m.from) * 8
      if (m.castle === 'K') { board[home + 5] = board[home + 7]; board[home + 7] = null }
      else { board[home + 3] = board[home]; board[home] = null }
    }
    if (killerQueenSq === m.from) killerQueenSq = m.to
    if (dinoLeaderSq === m.from) dinoLeaderSq = m.to
    if (invisible && invisible.sq === m.from) invisible.sq = m.to
  }

  if (mover.t === 'k') castling = castling.replace(/[KQ]/g, '')
  for (const sq of [m.from, m.to, ...m.squashed]) if (CORNER_RIGHTS[sq]) castling = castling.replace(CORNER_RIGHTS[sq], '')

  // Killer Queen bomb countdown & 5-square cross detonation after 2 human turns
  const nextBombs = []
  const blastedSquares = []
  let kqCooldown = Math.max(0, s.kqCooldown - 1)
  for (const b of s.bombs) {
    const left = b.turnsLeft - 1
    if (left <= 0) {
      const bf = fileOf(b.sq), br = rankOf(b.sq)
      const cross = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]
      let destroyed = 0
      for (const [df, dr] of cross) {
        if (!inBoard(bf + df, br + dr)) continue
        const tsq = idx(bf + df, br + dr)
        if (board[tsq] && board[tsq].t !== 'k') {
          board[tsq] = null
          if (killerQueenSq === tsq) killerQueenSq = null
          if (dinoLeaderSq === tsq) dinoLeaderSq = null
          if (invisible && invisible.sq === tsq) invisible = null
          destroyed++
        }
        blastedSquares.push(tsq)
      }
      kqCooldown = 3
      events.push(`💣 KILLER QUEEN DETONATED on ${toAlg(b.sq)}! (${destroyed} piece${destroyed === 1 ? '' : 's'} vaporized · 3-turn cooldown)`)
    } else {
      nextBombs.push({ ...b, turnsLeft: left })
    }
  }

  // Bigmouth invisibility countdown
  if (invisible) {
    invisible.turnsLeft -= 1
    if (invisible.turnsLeft <= 0) {
      events.push(`👻 ${board[invisible.sq]?.t.toUpperCase() || 'Piece'} on ${toAlg(invisible.sq)} revealed! (3-round cooldown)`)
      invisible = null
      cloakCooldown = 3
    }
  } else if (cloakCooldown > 0) {
    cloakCooldown -= 1
  }

  const next = {
    ...s,
    board,
    turn: BLACK,
    castling,
    ep: m.double ? (m.from + m.to) / 2 : -1,
    halfmove: mover.t === 'p' || m.capture ? 0 : s.halfmove + 1,
    killerQueenSq,
    kqCooldown,
    kcCooldown: Math.max(0, s.kcCooldown - 1),
    heyYaCounter: Math.max(0, s.heyYaCounter - 1),
    bombs: nextBombs,
    dinoLeaderSq,
    invisible,
    cloakCooldown,
  }
  return { state: next, events, blastedSquares }
}

/**
 * Applies Stockfish's UCI move for Black.
 * If Bigmouth Strikes Again has an invisible White piece and Black's move
 * passes through or lands on that square, intercept & SHANK the Black piece!
 */
export function applyStandAiMove(s, uci) {
  const from = fromAlg(uci.slice(0, 2))
  const to = fromAlg(uci.slice(2, 4))
  const promo = uci[4] || null
  const board = s.board.map((p) => (p ? { ...p } : null))
  const mover = board[from]
  if (!mover) return { state: { ...s, turn: WHITE }, events: [], shankedSq: null }

  const invSq = s.invisible ? s.invisible.sq : -1
  if (invSq >= 0) {
    let intercepted = to === invSq
    if (!intercepted && (mover.t === 'r' || mover.t === 'b' || mover.t === 'q')) {
      const f1 = fileOf(from), r1 = rankOf(from)
      const f2 = fileOf(to), r2 = rankOf(to)
      const df = Math.sign(f2 - f1), dr = Math.sign(r2 - r1)
      let cf = f1 + df, cr = r1 + dr
      while (cf !== f2 || cr !== r2) {
        if (idx(cf, cr) === invSq) { intercepted = true; break }
        cf += df; cr += dr
      }
    }
    if (intercepted) {
      // SHANK! Destroy Stockfish's piece, cancel move, reveal invisible piece, start 3-round cooldown
      board[from] = null
      const next = {
        ...s,
        board,
        turn: WHITE,
        ep: -1,
        fullmove: s.fullmove + 1,
        invisible: null,
        cloakCooldown: 3,
      }
      return {
        state: next,
        events: [`🗡️ BIGMOUTH AMBUSH SHANK! ${mover.t.toUpperCase()} on ${toAlg(from)} was destroyed by the invisible piece on ${toAlg(invSq)}!`],
        shankedSq: invSq,
        from,
        to: invSq,
      }
    }
  }

  // Normal Black move
  let castling = s.castling
  let killerQueenSq = s.killerQueenSq
  let dinoLeaderSq = s.dinoLeaderSq
  const isEp = mover.t === 'p' && to === s.ep && !board[to]
  const isCapture = Boolean(board[to]) || isEp

  if (isEp) board[idx(fileOf(to), rankOf(from))] = null
  if (mover.t === 'k' && Math.abs(fileOf(to) - fileOf(from)) === 2) {
    const home = 56
    if (fileOf(to) === 6) { board[home + 5] = board[home + 7]; board[home + 7] = null }
    else { board[home + 3] = board[home]; board[home] = null }
  }
  board[from] = null
  board[to] = promo ? { t: promo, c: BLACK, dino: false } : mover

  if (killerQueenSq === to) killerQueenSq = null
  if (dinoLeaderSq === to) dinoLeaderSq = null
  if (mover.t === 'k') castling = castling.replace(/[kq]/g, '')
  for (const sq of [from, to]) if (CORNER_RIGHTS[sq]) castling = castling.replace(CORNER_RIGHTS[sq], '')

  const next = {
    ...s,
    board,
    turn: WHITE,
    castling,
    ep: mover.t === 'p' && Math.abs(rankOf(to) - rankOf(from)) === 2 ? (from + to) / 2 : -1,
    halfmove: mover.t === 'p' || isCapture ? 0 : s.halfmove + 1,
    fullmove: s.fullmove + 1,
    killerQueenSq,
    dinoLeaderSq,
  }
  return { state: next, events: [], shankedSq: null, from, to }
}
