import { useEffect, useRef, useState } from 'react'
import { hostPeerRoom } from '../p2p/peerClient'

export default function HostPortalModal({ onClose, onHosted }) {
  const [password, setPassword] = useState('')
  const [unlocked, setUnlocked] = useState(false)
  const [error, setError] = useState('')
  const [shaking, setShaking] = useState(false)

  const [hosting, setHosting] = useState(false)
  const [roomCode, setRoomCode] = useState('')
  const [copied, setCopied] = useState(false)
  const peerRef = useRef(null)
  const connectedRef = useRef(false)

  useEffect(() => {
    return () => {
      if (!connectedRef.current) peerRef.current?.destroy()
    }
  }, [])

  const submitPassword = (e) => {
    e.preventDefault()
    if (password === 'kornsuck') {
      setUnlocked(true)
      setError('')
    } else {
      setError('Access denied — incorrect password.')
      setShaking(true)
      setTimeout(() => setShaking(false), 420)
    }
  }

  const startHosting = () => {
    setError('')
    setHosting(true)
    const session = hostPeerRoom({
      onOpen: (id) => setRoomCode(id),
      onConnect: () => {
        connectedRef.current = true
        onHosted({ role: 'host', myColor: 'w', roomCode: session.roomId, peer: session })
      },
      onError: (err) => {
        setError(err?.message || 'PeerJS connection error.')
        setHosting(false)
      },
    })
    peerRef.current = session
  }

  const copyCode = () => {
    if (!roomCode) return
    navigator.clipboard?.writeText(roomCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  const handleClose = () => {
    if (!connectedRef.current) peerRef.current?.destroy()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm" onClick={handleClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-sm rounded-3xl border border-white/15 bg-slate-900 p-6 shadow-[0_0_60px_rgba(245,158,11,0.2)] ${shaking ? 'animate-shake' : ''}`}
      >
        <div className="mb-4 flex items-center justify-between">
          <span className="font-display text-sm font-bold uppercase tracking-[0.2em] text-amber-300">
            {unlocked ? 'Secret Host Room' : 'Host Authentication'}
          </span>
          <button onClick={handleClose} className="text-sm text-slate-400 hover:text-white">✕</button>
        </div>

        {!unlocked ? (
          <form onSubmit={submitPassword} className="flex flex-col gap-3">
            <p className="text-xs text-slate-400">Enter the secret host password to unlock P2P room hosting.</p>
            <input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError('') }}
              placeholder="Password"
              className="rounded-xl border border-white/15 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-amber-400"
            />
            {error && <p className="text-xs font-semibold text-rose-400">{error}</p>}
            <button
              type="submit"
              className="mt-1 rounded-xl bg-amber-400 px-4 py-2.5 font-display text-xs font-black uppercase tracking-widest text-slate-950 transition hover:bg-amber-300"
            >
              Unlock Portal
            </button>
          </form>
        ) : !hosting ? (
          <div className="flex flex-col gap-4 text-center">
            <p className="text-xs text-slate-300">
              Authenticated! Create a direct peer-to-peer room via PeerJS and share the room code with your opponent.
            </p>
            {error && <p className="text-xs font-semibold text-rose-400">{error}</p>}
            <button
              onClick={startHosting}
              className="glow-btn rounded-xl bg-amber-400 px-5 py-3 font-display text-sm font-black uppercase tracking-widest text-slate-950 transition hover:bg-amber-300"
            >
              Host Room
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="text-xs uppercase tracking-widest text-slate-400">Room Code</span>
            <div className="flex items-center gap-2 rounded-xl border border-amber-400/40 bg-black/40 px-4 py-2.5">
              <span className="font-mono text-xl font-black tracking-widest text-amber-300">
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
            <div className="mt-1 flex items-center gap-2 text-xs text-sky-300">
              <span className="h-2 w-2 animate-ping rounded-full bg-sky-400" />
              Waiting for opponent to join…
            </div>
            {error && <p className="text-xs font-semibold text-rose-400">{error}</p>}
          </div>
        )}
      </div>
    </div>
  )
}
