/**
 * Chess rules + variant logic (Tank Warfare / Missile Command).
 *
 * The React app owns the *true* game state described here. Fairy-Stockfish / Stockfish
 * only ever sees a FEN derived from it (see `toFen`), so every custom mechanic
 * (tank trampling, missile strikes) is resolved here, in the front-end.
 *
 * Board layout: index = rank * 8 + file, rank 0 = rank "1", file 0 = file "a".
 * Piece = { t, c }  where t is one of
 *   p n b r q k   – standard pieces
 *   T             – Tank    (Tank Warfare)   – looks like a rook in the FEN
 *   M             – Missile (Missile Command) – looks like a bishop in the FEN
 */

export const WHITE = 'w'
export const BLACK = 'b'
export const MODES = { STANDARD: 'standard', TANK: 'tank', MISSILE: 'missile' }
export const MISSILE_COOLDOWN = 5

export const opp = (c) => (c === WHITE ? BLACK : WHITE)
export const fileOf = (i) => i & 7
export const rankOf = (i) => i >> 3
export const idx = (f, r) => r * 8 + f
export const inBoard = (f, r) => f >= 0 && f < 8 && r >= 0 && r < 8
export const toAlg = (i) => 'abcdefgh'[i & 7] + ((i >> 3) + 1)
export const fromAlg = (s) => (s.charCodeAt(0) - 97) + (parseInt(s[1], 10) - 1) * 8

const KNIGHT = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]]
const KING = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]]
const ORTHO = [[1, 0], [-1, 0], [0, 1], [0, -1]]
const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]]

// ---------------------------------------------------------------- state ----

export function createInitialState(mode = MODES.STANDARD, humanColor = WHITE) {
  const board = new Array(64).fill(null)
  const back = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r']
  for (let f = 0; f < 8; f++) {
    board[idx(f, 0)] = { t: back[f], c: WHITE }
    board[idx(f, 1)] = { t: 'p', c: WHITE }
    board[idx(f, 6)] = { t: 'p', c: BLACK }
    board[idx(f, 7)] = { t: back[f], c: BLACK }
  }
  const homeRank = humanColor === WHITE ? 0 : 7
  if (mode === MODES.TANK) {
    // Tank replaces the human player's queenside rook; AI keeps standard rook
    board[idx(0, homeRank)] = { t: 'T', c: humanColor }
  }
  if (mode === MODES.MISSILE) {
    // Missile replaces the human player's kingside bishop; AI keeps standard bishop
    board[idx(5, homeRank)] = { t: 'M', c: humanColor }
  }
  const state = {
    mode,
    board,
    turn: WHITE,
    castling: 'KQkq',
    ep: -1,
    halfmove: 0,
    fullmove: 1,
    cooldown: { w: 0, b: 0 },
    positions: {},
  }
  state.positions = { [positionKey(state)]: 1 }
  return state
}

export function positionKey(s) {
  let k = ''
  for (let i = 0; i < 64; i++) {
    const p = s.board[i]
    k += p ? (p.c === WHITE ? p.t.toUpperCase() : p.t) : '.'
  }
  return `${k} ${s.turn} ${s.castling} ${s.ep} ${s.cooldown.w}${s.cooldown.b}`
}

/** FEN handed to the engine (Tank → rook, Missile → bishop). */
export function toFen(s) {
  const rows = []
  for (let r = 7; r >= 0; r--) {
    let row = ''
    let empty = 0
    for (let f = 0; f < 8; f++) {
      const p = s.board[idx(f, r)]
      if (!p) { empty++; continue }
      if (empty) { row += empty; empty = 0 }
      let ch = p.t === 'T' ? 'r' : p.t === 'M' ? 'b' : p.t
      row += p.c === WHITE ? ch.toUpperCase() : ch
    }
    if (empty) row += empty
    rows.push(row)
  }
  return `${rows.join('/')} ${s.turn} ${s.castling || '-'} ${s.ep >= 0 ? toAlg(s.ep) : '-'} ${s.halfmove} ${s.fullmove}`
}

/** Position object for react-chessboard, using custom piece keys wT/bT/wM/bM. */
export function toPositionObject(s) {
  const out = {}
  for (let i = 0; i < 64; i++) {
    const p = s.board[i]
    if (p) out[toAlg(i)] = { pieceType: p.c + p.t.toUpperCase() }
  }
  return out
}

// -------------------------------------------------------------- attacks ----

function findKing(board, c) {
  for (let i = 0; i < 64; i++) if (board[i] && board[i].t === 'k' && board[i].c === c) return i
  return -1
}

/** Is `target` attacked by colour `by`?  Missiles never attack; Tanks have
 *  single-piercing along a rank/file (at most one non-king blocker). */
export function isAttacked(board, target, by) {
  const tf = fileOf(target), tr = rankOf(target)
  const at = (f, r) => (inBoard(f, r) ? board[idx(f, r)] : null)

  // pawns
  const pr = by === WHITE ? tr - 1 : tr + 1
  for (const df of [-1, 1]) {
    const p = at(tf + df, pr)
    if (p && p.c === by && p.t === 'p') return true
  }
  for (const [df, dr] of KNIGHT) {
    const p = at(tf + df, tr + dr)
    if (p && p.c === by && p.t === 'n') return true
  }
  for (const [df, dr] of KING) {
    const p = at(tf + df, tr + dr)
    if (p && p.c === by && p.t === 'k') return true
  }
  for (const [dirs, kinds] of [[ORTHO, 'rq'], [DIAG, 'bq']]) {
    for (const [df, dr] of dirs) {
      let f = tf + df, r = tr + dr
      while (inBoard(f, r)) {
        const p = board[idx(f, r)]
        if (p) {
          if (p.c === by && kinds.includes(p.t)) return true
          break
        }
        f += df; r += dr
      }
    }
  }
  // tanks (single-piercing: at most 1 non-king piece between target and Tank)
  for (const [df, dr] of ORTHO) {
    let f = tf + df, r = tr + dr
    let blockers = 0
    while (inBoard(f, r)) {
      const p = board[idx(f, r)]
      if (p) {
        if (p.c === by && p.t === 'T') return true
        if (p.t === 'k') break
        blockers++
        if (blockers > 1) break
      }
      f += df; r += dr
    }
  }
  return false
}

export function inCheck(s, c = s.turn) {
  const k = findKing(s.board, c)
  return k >= 0 && isAttacked(s.board, k, opp(c))
}

// ------------------------------------------------------------ move-gen ----

function mk(from, to, piece, extra = {}) {
  return { from, to, piece, promo: null, capture: false, ep: false, castle: null, double: false, squashed: [], trample: false, ...extra }
}

function pseudoMoves(s, forAttackCheckOnly = false) {
  const { board, turn: c } = s
  const moves = []
  for (let from = 0; from < 64; from++) {
    const p = board[from]
    if (!p || p.c !== c) continue
    const f = fileOf(from), r = rankOf(from)

    if (p.t === 'p') {
      const dir = c === WHITE ? 1 : -1
      const startRank = c === WHITE ? 1 : 6
      const lastRank = c === WHITE ? 7 : 0
      const push = (to, extra) => {
        if (rankOf(to) === lastRank) {
          for (const promo of ['q', 'r', 'b', 'n']) moves.push(mk(from, to, 'p', { ...extra, promo }))
        } else moves.push(mk(from, to, 'p', extra))
      }
      if (inBoard(f, r + dir) && !board[idx(f, r + dir)]) {
        push(idx(f, r + dir), {})
        if (r === startRank && !board[idx(f, r + 2 * dir)]) moves.push(mk(from, idx(f, r + 2 * dir), 'p', { double: true }))
      }
      for (const df of [-1, 1]) {
        if (!inBoard(f + df, r + dir)) continue
        const to = idx(f + df, r + dir)
        const t = board[to]
        if (t && t.c !== c && t.t !== 'k') push(to, { capture: true, squashed: [to] })
        else if (!t && to === s.ep) moves.push(mk(from, to, 'p', { capture: true, ep: true, squashed: [idx(f + df, r)] }))
      }
    } else if (p.t === 'n' || p.t === 'k') {
      for (const [df, dr] of p.t === 'n' ? KNIGHT : KING) {
        if (!inBoard(f + df, r + dr)) continue
        const to = idx(f + df, r + dr)
        const t = board[to]
        if (!t) moves.push(mk(from, to, p.t))
        else if (t.c !== c && t.t !== 'k') moves.push(mk(from, to, p.t, { capture: true, squashed: [to] }))
      }
      if (p.t === 'k' && !forAttackCheckOnly) addCastling(s, from, moves)
    } else if (p.t === 'b' || p.t === 'r' || p.t === 'q') {
      const dirs = p.t === 'b' ? DIAG : p.t === 'r' ? ORTHO : [...ORTHO, ...DIAG]
      for (const [df, dr] of dirs) {
        let nf = f + df, nr = r + dr
        while (inBoard(nf, nr)) {
          const to = idx(nf, nr)
          const t = board[to]
          if (!t) moves.push(mk(from, to, p.t))
          else {
            if (t.c !== c && t.t !== 'k') moves.push(mk(from, to, p.t, { capture: true, squashed: [to] }))
            break
          }
          nf += df; nr += dr
        }
      }
    } else if (p.t === 'T') {
      // Tank: rook-lines, single-piercing (passes through and squashes at most 1 non-king piece).
      for (const [df, dr] of ORTHO) {
        let nf = f + df, nr = r + dr
        let pierced = null
        while (inBoard(nf, nr)) {
          const to = idx(nf, nr)
          const t = board[to]
          if (t && t.t === 'k') break
          if (pierced === null) {
            if (!t) {
              moves.push(mk(from, to, 'T'))
            } else {
              if (t.c !== c) {
                moves.push(mk(from, to, 'T', { capture: true, squashed: [to] }))
              }
              pierced = to
            }
          } else {
            if (!t) {
              moves.push(mk(from, to, 'T', { squashed: [pierced], trample: true }))
            } else {
              if (t.c !== c) {
                moves.push(mk(from, to, 'T', { capture: true, squashed: [pierced, to], trample: true }))
              }
              break
            }
          }
          nf += df; nr += dr
        }
      }
    }
    // 'M' (missile) has no conventional moves.
  }
  return moves
}

function addCastling(s, from, moves) {
  const { board, turn: c } = s
  const home = c === WHITE ? 0 : 56
  if (from !== home + 4) return
  const enemy = opp(c)
  const rooky = (i) => board[i] && board[i].c === c && (board[i].t === 'r' || board[i].t === 'T')
  const kRight = c === WHITE ? 'K' : 'k'
  const qRight = c === WHITE ? 'Q' : 'q'
  if (isAttacked(board, from, enemy)) return
  if (s.castling.includes(kRight) && rooky(home + 7) && !board[home + 5] && !board[home + 6] &&
    !isAttacked(board, home + 5, enemy) && !isAttacked(board, home + 6, enemy)) {
    moves.push(mk(from, home + 6, 'k', { castle: 'K' }))
  }
  if (s.castling.includes(qRight) && rooky(home) && !board[home + 1] && !board[home + 2] && !board[home + 3] &&
    !isAttacked(board, home + 3, enemy) && !isAttacked(board, home + 2, enemy)) {
    moves.push(mk(from, home + 2, 'k', { castle: 'Q' }))
  }
}

function applyToBoard(board, m) {
  const b = board.slice()
  const piece = b[m.from]
  for (const sq of m.squashed) b[sq] = null
  b[m.from] = null
  b[m.to] = m.promo ? { t: m.promo, c: piece.c } : piece
  if (m.castle) {
    const home = rankOf(m.from) * 8
    if (m.castle === 'K') { b[home + 5] = b[home + 7]; b[home + 7] = null }
    else { b[home + 3] = b[home]; b[home] = null }
  }
  return b
}

export function legalMoves(s) {
  const out = []
  const c = s.turn
  for (const m of pseudoMoves(s)) {
    const nb = applyToBoard(s.board, m)
    const k = findKing(nb, c)
    if (k >= 0 && !isAttacked(nb, k, opp(c))) out.push(m)
  }
  return out
}

export function movesFrom(s, from) {
  return legalMoves(s).filter((m) => m.from === from)
}

// -------------------------------------------------------------- missile ----

export function missileTargets(s, c = s.turn) {
  const t = []
  for (let i = 0; i < 64; i++) if (s.board[i] && s.board[i].c !== c && s.board[i].t !== 'k') t.push(i)
  return t
}

export function hasMissile(s, c) {
  return s.board.some((p) => p && p.c === c && p.t === 'M')
}

/** Why (if at all) can't `c` fire right now?  null = ready. */
export function missileBlockReason(s, c = s.turn) {
  if (s.mode !== MODES.MISSILE) return 'Not available in this mode'
  if (s.turn !== c) return 'Not your turn'
  if (!hasMissile(s, c)) return 'Your missile was destroyed'
  if (s.cooldown[c] > 0) return `Recharging – ${s.cooldown[c]} turn${s.cooldown[c] > 1 ? 's' : ''} left`
  if (inCheck(s, c)) return 'Cannot fire while in check'
  if (missileTargets(s, c).length === 0) return 'No targets'
  return null
}
export const canFireMissile = (s, c = s.turn) => missileBlockReason(s, c) === null

// ------------------------------------------------------- state advance ----

const CORNER_RIGHTS = { 0: 'Q', 7: 'K', 56: 'q', 63: 'k' }

function advance(s, board, { from = -1, to = -1, piece = null, squashed = [], resetClock, ep = -1, cooldownSet = null }) {
  let castling = s.castling
  if (piece && piece.t === 'k') castling = castling.replace(piece.c === WHITE ? /[KQ]/g : /[kq]/g, '')
  for (const sq of [from, to, ...squashed]) if (CORNER_RIGHTS[sq]) castling = castling.replace(CORNER_RIGHTS[sq], '')
  const mover = s.turn
  const cooldown = { ...s.cooldown }
  if (cooldownSet != null) cooldown[mover] = cooldownSet
  else cooldown[mover] = Math.max(0, cooldown[mover] - 1)
  const next = {
    ...s,
    board,
    turn: opp(mover),
    castling,
    ep,
    halfmove: resetClock ? 0 : s.halfmove + 1,
    fullmove: s.fullmove + (mover === BLACK ? 1 : 0),
    cooldown,
  }
  const key = positionKey(next)
  next.positions = { ...s.positions, [key]: (s.positions[key] || 0) + 1 }
  return next
}

/** Apply a legal move. Returns the new state and the list of pieces that were destroyed. */
export function applyMove(s, m) {
  const piece = s.board[m.from]
  const lost = m.squashed.map((sq) => ({ sq, piece: s.board[sq] })).filter((x) => x.piece)
  const board = applyToBoard(s.board, m)
  const next = advance(s, board, {
    from: m.from, to: m.to, piece, squashed: m.squashed,
    resetClock: piece.t === 'p' || lost.length > 0,
    ep: m.double ? (m.from + m.to) / 2 : -1,
  })
  return { state: next, lost }
}

/** Fire the ballistic missile at `target` (square index of an enemy, non-king piece). */
export function applyMissile(s, target) {
  const victim = s.board[target]
  const board = s.board.slice()
  board[target] = null
  const next = advance(s, board, { squashed: [target], resetClock: true, cooldownSet: MISSILE_COOLDOWN })
  return { state: next, lost: [{ sq: target, piece: victim }] }
}

export function pickMissileTarget(s, rng = Math.random) {
  const t = missileTargets(s)
  return t[Math.floor(rng() * t.length)]
}

// --------------------------------------------------------------- status ----

function insufficientMaterial(s) {
  const minors = []
  for (let i = 0; i < 64; i++) {
    const p = s.board[i]
    if (!p || p.t === 'k') continue
    if (p.t === 'M') return false // a missile can still reshape the game
    if (p.t !== 'n' && p.t !== 'b') return false
    minors.push({ ...p, sq: i })
  }
  if (minors.length <= 1) return true
  if (minors.every((m) => m.t === 'b')) {
    const col = (m) => (fileOf(m.sq) + rankOf(m.sq)) % 2
    return minors.every((m) => col(m) === col(minors[0]))
  }
  return false
}

export function getStatus(s) {
  const check = inCheck(s)
  const moves = legalMoves(s)
  if (moves.length === 0 && !canFireMissile(s)) {
    if (check) return { over: true, check, winner: opp(s.turn), reason: 'Checkmate' }
    return { over: true, check, winner: null, reason: 'Stalemate' }
  }
  if (insufficientMaterial(s)) return { over: true, check, winner: null, reason: 'Insufficient material' }
  if (s.halfmove >= 100) return { over: true, check, winner: null, reason: '50-move rule' }
  if ((s.positions[positionKey(s)] || 0) >= 3) return { over: true, check, winner: null, reason: 'Threefold repetition' }
  return { over: false, check, winner: null, reason: '' }
}

// ------------------------------------------------------------- notation ----

export function describeMove(m, status) {
  let san
  if (m.castle) san = m.castle === 'K' ? 'O-O' : 'O-O-O'
  else if (m.piece === 'p') san = (m.capture ? 'abcdefgh'[fileOf(m.from)] + 'x' : '') + toAlg(m.to) + (m.promo ? '=' + m.promo.toUpperCase() : '')
  else if (m.piece === 'T') san = `T${toAlg(m.from)}${m.capture ? 'x' : '-'}${toAlg(m.to)}${m.squashed.length ? ` ✕${m.squashed.length}` : ''}`
  else san = m.piece.toUpperCase() + (m.capture ? 'x' : '') + toAlg(m.to)
  if (status?.over && status.winner) san += '#'
  else if (status?.check) san += '+'
  return san
}

export const describeMissile = (target, victim, status) =>
  `🚀 ${victim.t === 'T' ? 'T' : victim.t === 'M' ? 'M' : victim.t.toUpperCase()}${toAlg(target)}` + (status?.over && status.winner ? '#' : status?.check ? '+' : '')
