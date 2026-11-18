import { useState } from 'react'
import Landing from './components/Landing'
import StandScreen from './components/StandScreen'

export default function App() {
  const [screen, setScreen] = useState('landing')
  const [p2p, setP2p] = useState(null)

  const startSolo = () => {
    setP2p(null)
    setScreen('stand')
  }

  const startP2P = (session) => {
    setP2p(session)
    setScreen('stand')
  }

  const exitToMenu = () => {
    p2p?.peer?.destroy()
    setP2p(null)
    setScreen('landing')
  }

  return (
    <div className="min-h-screen bg-grid">
      {screen === 'landing' && <Landing onPlay={startSolo} onStartP2P={startP2P} />}
      {screen === 'stand' && <StandScreen p2p={p2p} onMenu={exitToMenu} />}
    </div>
  )
}
