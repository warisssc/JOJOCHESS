import { useState } from 'react'
import Landing from './components/Landing'
import StandScreen from './components/StandScreen'

export default function App() {
  const [screen, setScreen] = useState('landing')

  return (
    <div className="min-h-screen bg-grid">
      {screen === 'landing' && <Landing onPlay={() => setScreen('stand')} />}
      {screen === 'stand' && <StandScreen onMenu={() => setScreen('landing')} />}
    </div>
  )
}
