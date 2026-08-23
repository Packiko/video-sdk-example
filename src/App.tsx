import { useState } from 'react'
import Record from './Record'
import Playback from './Playback'
import QueueDemo from './QueueDemo'

// ponytail: useState tab instead of react-router — 3 views don't need a router
export default function App() {
  const [tab, setTab] = useState<'record' | 'playback' | 'queue'>('record')
  return (
    <main style={{ maxWidth: 640, margin: '2rem auto', fontFamily: 'system-ui', padding: '0 1rem' }}>
      <h1>Packiko Video SDK Example</h1>
      <nav style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button onClick={() => setTab('record')} disabled={tab === 'record'}>Record</button>
        <button onClick={() => setTab('playback')} disabled={tab === 'playback'}>Playback</button>
        <button onClick={() => setTab('queue')} disabled={tab === 'queue'}>Queue</button>
      </nav>
      {tab === 'record' ? <Record /> : tab === 'playback' ? <Playback /> : <QueueDemo />}
    </main>
  )
}
