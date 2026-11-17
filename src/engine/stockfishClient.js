/**
 * Thin UCI client around a Stockfish WebAssembly Web Worker.
 *
 * The worker script is the single-threaded "lite" Stockfish 19 build copied into
 * /public/engine (so it works without SharedArrayBuffer / COOP+COEP headers).
 * To use a hosted build or Fairy-Stockfish instead, just change `ENGINE_URL` –
 * the protocol (UCI) is identical:
 *   e.g. 'https://cdn.jsdelivr.net/npm/stockfish@19.0.1/bin/stockfish-19-lite-single.js'
 *   (cross-origin worker scripts need a same-origin Blob wrapper, see `createWorker`).
 */

export const ENGINE_URL = `${import.meta.env.BASE_URL}engine/stockfish-19-lite-single.js`

function createWorker(url) {
  if (/^https?:\/\//.test(url) && new URL(url).origin !== location.origin) {
    const blob = new Blob([`importScripts(${JSON.stringify(url)});`], { type: 'text/javascript' })
    return new Worker(URL.createObjectURL(blob))
  }
  return new Worker(url)
}

export class StockfishEngine {
  constructor(url = ENGINE_URL) {
    this.url = url
    this.worker = null
    this.listeners = new Set()
    this.queue = Promise.resolve()
    this.ready = null
    this.dead = false
  }

  start() {
    if (this.ready) return this.ready
    this.ready = new Promise((resolve, reject) => {
      try {
        this.worker = createWorker(this.url)
      } catch (e) {
        this.dead = true
        reject(e)
        return
      }
      this.worker.onmessage = (e) => {
        const line = typeof e.data === 'string' ? e.data : String(e.data)
        for (const l of [...this.listeners]) l(line)
      }
      this.worker.onerror = (e) => {
        this.dead = true
        reject(e)
      }
      const wait = (token) => new Promise((res) => {
        const l = (line) => { if (line.startsWith(token)) { this.listeners.delete(l); res() } }
        this.listeners.add(l)
      })
      const timer = setTimeout(() => { this.dead = true; reject(new Error('Engine start timeout')) }, 15000)
      this.send('uci')
      wait('uciok')
        .then(() => { this.send('setoption name Threads value 1'); this.send('isready'); return wait('readyok') })
        .then(() => { clearTimeout(timer); resolve() })
    })
    this.ready.catch(() => { this.dead = true })
    return this.ready
  }

  send(cmd) {
    this.worker?.postMessage(cmd)
  }

  /**
   * Analyse a FEN. Resolves with { bestmove: 'e2e4' | null, score } where score is in
   * centipawns from the side-to-move's point of view (mates mapped to ±100000).
   * Calls are serialised.
   */
  analyze(fen, { movetime = 300, searchmoves = [], multiPv = 1 } = {}) {
    const run = async () => {
      await this.start()
      return new Promise((resolve, reject) => {
        let score = 0
        const pvMap = new Map()
        const timer = setTimeout(() => {
          this.listeners.delete(l)
          this.send('stop')
          if (multiPv > 1) this.send('setoption name MultiPV value 1')
          reject(new Error('Engine search timeout'))
        }, movetime + 4000)
        const l = (line) => {
          if (line.startsWith('info') && line.includes(' score ') && line.includes(' pv ')) {
            const m = line.match(/score (cp|mate) (-?\d+)/)
            const mpv = line.match(/multipv (\d+)/)
            const pv = line.match(/ pv ([a-h][1-8][a-h][1-8][qrbn]?)/)
            if (m) {
              const n = parseInt(m[2], 10)
              const sc = m[1] === 'cp' ? n : (n > 0 ? 100000 - n * 100 : -100000 - n * 100)
              const idx = mpv ? parseInt(mpv[1], 10) : 1
              if (idx === 1) score = sc
              if (pv) pvMap.set(idx, { move: pv[1], score: sc })
            }
          } else if (line.startsWith('bestmove')) {
            clearTimeout(timer)
            this.listeners.delete(l)
            if (multiPv > 1) this.send('setoption name MultiPV value 1')
            const mv = line.split(' ')[1]
            const lines = [...pvMap.entries()].sort((a, b) => a[0] - b[0]).map((x) => x[1])
            resolve({ bestmove: !mv || mv === '(none)' || mv === 'none' ? null : mv, score, lines })
          }
        }
        this.listeners.add(l)
        if (multiPv > 1) this.send(`setoption name MultiPV value ${multiPv}`)
        this.send(`position fen ${fen}`)
        this.send(`go movetime ${movetime}${searchmoves.length ? ' searchmoves ' + searchmoves.join(' ') : ''}`)
      })
    }
    const p = this.queue.then(run, run)
    this.queue = p.catch(() => {})
    return p
  }

  terminate() {
    this.dead = true
    this.worker?.terminate()
    this.worker = null
    this.listeners.clear()
  }
}
