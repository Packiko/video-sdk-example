import { useState } from 'react'
import Learn from './Learn'
import Playground from './Playground'
import AuthModes from './AuthModes'
import RecorderLab from './RecorderLab'
import { isAuthenticated, logout, subject } from './auth'

export default function App() {
  const [mode, setMode] = useState<'lab' | 'learn' | 'playground' | 'auth'>('lab')
  return (
    <main className="app-shell">
      <header className="app-topbar">
        <div className="brand"><strong>Packiko Video</strong><span>Partner SDK Example</span></div>
        <nav className="app-nav" aria-label="หน้าตัวอย่าง">
          <button className={mode === 'lab' ? 'active' : ''} onClick={() => setMode('lab')}>Recorder Lab</button>
          <button className={mode === 'learn' ? 'active' : ''} onClick={() => setMode('learn')}>Integration guide</button>
          <button className={mode === 'playground' ? 'active' : ''} onClick={() => setMode('playground')}>Advanced tools</button>
          <button className={mode === 'auth' ? 'active' : ''} onClick={() => setMode('auth')}>Authentication</button>
        </nav>
      </header>
      {isAuthenticated() && (
        <p className="session-bar">
          Mode B active · <code>sub: {subject()}</code> · ทุก request แนบ X-User-Token
          <button onClick={logout} style={{ marginLeft: 8 }}>Logout</button>
        </p>
      )}
      <div className="app-content">
        {mode === 'lab' ? <RecorderLab /> : mode === 'learn' ? <Learn /> : mode === 'playground' ? <Playground /> : <AuthModes />}
      </div>
    </main>
  )
}
