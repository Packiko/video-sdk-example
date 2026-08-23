import { useState } from 'react'
import Record from './Record'
import Playback from './Playback'
import QueueDemo from './QueueDemo'
import EventLogPanel from './EventLogPanel'

// Free-play mode: the real demos side-by-side with the live event log, so
// every button press shows what the SDK actually did underneath.
export default function Playground() {
  const [tab, setTab] = useState<'record' | 'playback' | 'queue'>('queue')
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, alignItems: 'start' }}>
      <div>
        <nav style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button onClick={() => setTab('record')} disabled={tab === 'record'}>Record</button>
          <button onClick={() => setTab('playback')} disabled={tab === 'playback'}>Playback</button>
          <button onClick={() => setTab('queue')} disabled={tab === 'queue'}>Queue</button>
        </nav>
        {tab === 'record' ? <Record /> : tab === 'playback' ? <Playback /> : <QueueDemo />}
      </div>
      <EventLogPanel />
    </div>
  )
}
