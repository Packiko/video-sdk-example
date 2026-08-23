import { useState } from 'react'
import Learn from './Learn'
import Playground from './Playground'

// ponytail: useState tab instead of react-router — 2 modes don't need a router
export default function App() {
  const [mode, setMode] = useState<'learn' | 'playground'>('learn')
  return (
    <main style={{ maxWidth: mode === 'learn' ? 720 : 1024, margin: '2rem auto', fontFamily: 'system-ui', padding: '0 1rem' }}>
      <h1>Packiko Video SDK Example</h1>
      <nav style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button onClick={() => setMode('learn')} disabled={mode === 'learn'}>📖 Learn — ทีละขั้น</button>
        <button onClick={() => setMode('playground')} disabled={mode === 'playground'}>🎮 Playground — ลองเล่นจริง</button>
      </nav>
      {mode === 'learn' ? <Learn /> : <Playground />}
    </main>
  )
}
