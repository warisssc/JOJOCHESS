// Quick sanity checks for the rules engine: node src/game/selftest.js
import assert from 'node:assert/strict'
import {
  createInitialState, legalMoves, applyMove, applyMissile, getStatus, toFen, fromAlg, toAlg, MODES, canFireMissile, isAttacked,
} from './rules.js'

function perft(s, d) {
  if (d === 0) return 1
  let n = 0
  for (const m of legalMoves(s)) n += perft(applyMove(s, m).state, d - 1)
  return n
}

const std = createInitialState(MODES.STANDARD)
assert.equal(toFen(std), 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
assert.equal(perft(std, 1), 20)
assert.equal(perft(std, 2), 400)
assert.equal(perft(std, 3), 8902)
assert.equal(perft(std, 4), 197281)
console.log('perft(1..4) OK')

// Tank: single-piercing from starting position (asymmetric: human w gets T on a1, AI b gets standard r on a8)
const tank = createInitialState(MODES.TANK, 'w')
assert.equal(tank.board[fromAlg('a1')].t, 'T')
assert.equal(tank.board[fromAlg('a8')].t, 'r')
assert.equal(toFen(tank), 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
const tm = legalMoves(tank).filter((m) => m.piece === 'T')
const targets = tm.map((m) => toAlg(m.to)).sort()
assert.deepEqual(targets, ['a3', 'a4', 'a5', 'a6', 'a7'], 'tank can pierce a2 and land on a3..a6 or capture a7, but not a8 or c1')
assert.ok(tm.some((m) => toAlg(m.to) === 'a7' && m.squashed.length === 2), 'tank crushes a2 and captures a7')
const { state: after, lost } = applyMove(tank, tm.find((m) => toAlg(m.to) === 'a7'))
assert.equal(after.board[fromAlg('a2')], null)
assert.equal(after.board[fromAlg('a7')].t, 'T')
assert.equal(lost.length, 2)
assert.ok(!after.castling.includes('Q'))
assert.equal(getStatus(after).over, false, 'move 1 Ta1xa7 is not an immediate checkmate')

// Tank: cannot capture, jump over, or move through a King (friendly or enemy), and respects pin/check
const empty = { ...createInitialState(MODES.TANK), board: new Array(64).fill(null), castling: '' }
empty.board[fromAlg('e1')] = { t: 'k', c: 'w' }
empty.board[fromAlg('e8')] = { t: 'k', c: 'b' }
empty.board[fromAlg('a1')] = { t: 'T', c: 'w' }
// Friendly king at e1 blocks horizontal movement past d1
const kingBlockMoves = legalMoves(empty).filter((m) => m.from === fromAlg('a1')).map((m) => toAlg(m.to))
assert.ok(!kingBlockMoves.includes('f1') && !kingBlockMoves.includes('e1'), 'tank cannot land on or pass through friendly king')
assert.ok(kingBlockMoves.includes('d1'))

// Enemy king at a5 blocks tank at a1 from reaching a6
const enemyKingState = { ...empty, board: empty.board.slice() }
enemyKingState.board[fromAlg('e8')] = null
enemyKingState.board[fromAlg('a5')] = { t: 'k', c: 'b' }
const ekMoves = legalMoves(enemyKingState).filter((m) => m.from === fromAlg('a1')).map((m) => toAlg(m.to))
assert.ok(!ekMoves.includes('a5') && !ekMoves.includes('a6'), 'tank cannot capture or pass through enemy king')

// Tank cannot squash a friendly piece that shields its own king from check
const pinState = { ...empty, board: empty.board.slice() }
pinState.board[fromAlg('e1')] = { t: 'k', c: 'w' }
pinState.board[fromAlg('c1')] = { t: 'p', c: 'w' }
pinState.board[fromAlg('b1')] = { t: 'r', c: 'b' } // wait: b1 rook attacks c1, not e1 unless c1 is removed
pinState.board[fromAlg('a1')] = { t: 'T', c: 'w' }
// Put black rook on a1? No, white tank is on a1, black rook on d1? Let's put white king on h1, white pawn on d1, white tank on a1, black rook on g1? No, black rook on g1 attacks h1 unless blocked.
// Put white king on h1, black rook on b1, white tank on c1? Wait: if tank on c1 moves to a1? No, that stays on rank 1.
// Put white king on e1, white pawn on e2, black rook on e8, white tank on a2: if tank squashes e2 and lands on f2, e1 is exposed to e8 rook!
const shieldState = { ...createInitialState(MODES.TANK), board: new Array(64).fill(null), castling: '' }
shieldState.board[fromAlg('e1')] = { t: 'k', c: 'w' }
shieldState.board[fromAlg('e2')] = { t: 'p', c: 'w' }
shieldState.board[fromAlg('e8')] = { t: 'k', c: 'b' }
shieldState.board[fromAlg('e7')] = { t: 'r', c: 'b' }
shieldState.board[fromAlg('a2')] = { t: 'T', c: 'w' }
const shieldMoves = legalMoves(shieldState).filter((m) => m.from === fromAlg('a2')).map((m) => toAlg(m.to))
assert.ok(!shieldMoves.includes('f2'), 'tank cannot squash e2 and leave own king in check from e7 rook')
assert.ok(shieldMoves.includes('d2') && !shieldMoves.includes('e2'))

// isAttacked single-piercing check
const atkBoard = new Array(64).fill(null)
atkBoard[fromAlg('e8')] = { t: 'k', c: 'b' }
atkBoard[fromAlg('a8')] = { t: 'T', c: 'w' }
atkBoard[fromAlg('c8')] = { t: 'p', c: 'b' }
assert.equal(isAttacked(atkBoard, fromAlg('e8'), 'w'), true, 'tank attacks through 1 blocker')
atkBoard[fromAlg('b8')] = { t: 'n', c: 'b' }
assert.equal(isAttacked(atkBoard, fromAlg('e8'), 'w'), false, 'tank does not attack through 2 blockers')
console.log('tank OK', toFen(after))

// Missile
const ms = createInitialState(MODES.MISSILE)
assert.equal(legalMoves(ms).some((m) => m.piece === 'M'), false)
assert.ok(canFireMissile(ms))
const { state: ms2 } = applyMissile(ms, fromAlg('e7'))
assert.equal(ms2.turn, 'b')
assert.equal(ms2.cooldown.w, 5)
assert.equal(ms2.board[fromAlg('e7')], null)
assert.equal(getStatus(ms2).over, false)
console.log('missile OK')
