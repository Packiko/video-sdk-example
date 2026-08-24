import { useState } from 'react'
import Learn from './Learn'
import Playground from './Playground'
import AuthModes from './AuthModes'
import { isAuthenticated, logout, subject } from './auth'

// ponytail: useState tab instead of react-router — 3 modes don't need a router
export default function App() {
  const [mode, setMode] = useState<'learn' | 'playground' | 'auth'>('learn')
  return (
    <main style={{ maxWidth: mode === 'playground' ? 1024 : 720, margin: '2rem auto', fontFamily: 'system-ui', padding: '0 1rem' }}>
      <h1>Packiko Video SDK Example</h1>
      {isAuthenticated() && (
        <p style={{ background: '#e6f4ea', border: '1px solid #b7dfc2', borderRadius: 8, padding: '6px 12px' }}>
          🔐 Mode B active — <code>sub: {subject()}</code> · ทุก request แนบ X-User-Token
          <button onClick={logout} style={{ marginLeft: 8 }}>Logout</button>
        </p>
      )}
      <nav style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button onClick={() => setMode('learn')} disabled={mode === 'learn'}>📖 Learn — ทีละขั้น</button>
        <button onClick={() => setMode('playground')} disabled={mode === 'playground'}>🎮 Playground — ลองเล่นจริง</button>
        <button onClick={() => setMode('auth')} disabled={mode === 'auth'}>🔐 Auth — เลือกโหมดยังไง</button>
      </nav>
      {mode === 'learn' ? <Learn /> : mode === 'playground' ? <Playground /> : <AuthModes />}
    </main>
  )
}
