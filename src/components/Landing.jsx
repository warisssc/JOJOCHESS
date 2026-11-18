import { useEffect, useRef, useState } from 'react'
import { customPieces } from './Pieces'
import { hostPeerRoom, joinPeerRoom } from '../p2p/peerClient'

export default function Landing({ onPlay, onStartP2P }) {
  const [joinCode, setJoinCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [hosting, setHosting] = useState(false)
  const [roomCode, setRoomCode] = useState('')
  const [copied, setCopied] = useState(false)
  const [p2pError, setP2pError] = useState('')

  const peerRef = useRef(null)
  const connectedRef = useRef(false)

  useEffect(() => {
    return () => {
      if (!connectedRef.current) peerRef.current?.destroy()
    }
  }, [])

  const handleHost = () => {
    setP2pError('')
    setHosting(true)
    setRoomCode('')
    peerRef.current?.destroy()

    const session = hostPeerRoom({
      onOpen: (id) => setRoomCode(id),
      onConnect: () => {
        connectedRef.current = true
        setHosting(false)
        onStartP2P({ role: 'host', myColor: 'w', roomCode: session.roomId, peer: session })
      },
      onError: (err) => {
        setP2pError(err?.message || 'Could not host room.')
        setHosting(false)
      },
    })
    peerRef.current = session
  }

  const cancelHost = () => {
    peerRef.current?.destroy()
    peerRef.current = null
    setHosting(false)
    setRoomCode('')
  }

  const copyCode = () => {
    if (!roomCode) return
    navigator.clipboard?.writeText(roomCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  const handleJoin = (e) => {
    e.preventDefault()
    const code = joinCode.trim().toUpperCase()
    if (!code) return
    setP2pError('')
    setJoining(true)
    peerRef.current?.destroy()

    const session = joinPeerRoom(code, {
      onConnect: () => {
        connectedRef.current = true
        setJoining(false)
        onStartP2P({ role: 'guest', myColor: 'b', roomCode: code, peer: session })
      },
      onError: (err) => {
        setP2pError(err?.message || 'Could not connect to room.')
        setJoining(false)
      },
    })
    peerRef.current = session
  }

  if (hosting) {
    return (
      <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 text-center">
        <div className="w-full max-w-sm rounded-3xl border border-amber-400/30 bg-slate-900/90 p-8 shadow-[0_0_60px_rgba(245,158,11,0.2)]">
          <div className="mb-2 font-display text-xs font-bold uppercase tracking-[0.25em] text-amber-300">
            P2P Matchmaking Lobby
          </div>
          <h2 className="font-display text-2xl font-black text-white">Waiting for opponent…</h2>
          <p className="mt-2 text-xs text-slate-400">Share this room code with a friend to start the 1v1 match.</p>

          <div className="mt-6 flex items-center justify-center gap-2 rounded-xl border border-amber-400/40 bg-black/40 px-4 py-3">
            <span className="font-mono text-2xl font-black tracking-widest text-amber-300">
              {roomCode || 'Generating…'}
            </span>
            {roomCode && (
              <button
                onClick={copyCode}
                className="rounded-lg bg-white/10 px-2.5 py-1 text-xs font-semibold text-slate-200 hover:bg-white/20"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            )}
          </div>

          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-sky-300">
            <span className="h-2 w-2 animate-ping rounded-full bg-sky-400" />
            Listening via PeerJS…
          </div>

          <button
            onClick={cancelHost}
            className="mt-6 w-full rounded-xl bg-white/10 px-4 py-2.5 text-xs font-semibold text-slate-300 transition hover:bg-white/20"
          >
            Cancel
          </button>
        </div>
      </main>
    )
  }

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
        Pierce yourself with the Stand Arrow, awaken 1 of 5 reality-bending Stand abilities, and battle Stockfish or a friend via P2P.
      </p>

      <button
        onClick={onPlay}
        className="glow-btn mt-10 rounded-full bg-amber-400 px-14 py-4 font-display text-lg font-black uppercase tracking-[0.25em] text-slate-950 transition hover:scale-105 hover:bg-amber-300 active:scale-95"
      >
        Play vs AI
      </button>

      {/* P2P Host & Join Controls */}
      <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
        <button
          onClick={handleHost}
          className="w-full rounded-xl border border-fuchsia-400/50 bg-fuchsia-500/15 px-5 py-3 font-display text-sm font-bold uppercase tracking-[0.2em] text-fuchsia-200 shadow-[0_0_25px_rgba(217,70,239,0.25)] transition hover:bg-fuchsia-500/25 active:scale-95"
        >
          Host Room
        </button>

        <form onSubmit={handleJoin} className="flex gap-2">
          <input
            type="text"
            value={joinCode}
            onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setP2pError('') }}
            placeholder="Room Code (e.g. JOJO-4F9K)"
            className="min-w-0 flex-1 rounded-xl border border-white/15 bg-black/40 px-3.5 py-2.5 font-mono text-xs uppercase tracking-wider text-white placeholder:text-slate-500 outline-none focus:border-sky-400"
          />
          <button
            type="submit"
            disabled={joining || !joinCode.trim()}
            className="rounded-xl bg-sky-500 px-4 py-2.5 font-display text-xs font-bold uppercase tracking-wider text-slate-950 transition hover:bg-sky-400 disabled:opacity-40"
          >
            {joining ? 'Joining…' : 'Join Room'}
          </button>
        </form>
        {p2pError && <p className="text-xs font-semibold text-rose-400">{p2pError}</p>}
      </div>
    </main>
  )
}
