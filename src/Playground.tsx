import { useState } from 'react'
import Record from './Record'
import Playback from './Playback'
import QueueDemo from './QueueDemo'
import EventLogPanel from './EventLogPanel'
import ProductionRecorder from './ProductionRecorder'

// Free-play mode: the real demos side-by-side with the live event log, so
// every button press shows what the SDK actually did underneath.
export default function Playground() {
  const [tab, setTab] = useState<'production' | 'queue' | 'playback' | 'minimal'>('production')
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, alignItems: 'start' }}>
      <div>
        <nav style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button onClick={() => setTab('production')} disabled={tab === 'production'}>Production record</button>
          <button onClick={() => setTab('queue')} disabled={tab === 'queue'}>Recovery queue</button>
          <button onClick={() => setTab('playback')} disabled={tab === 'playback'}>Playback</button>
          <button onClick={() => setTab('minimal')} disabled={tab === 'minimal'}>Minimal upload</button>
        </nav>
        {tab === 'production' ? <ProductionRecorder /> : tab === 'queue' ? <QueueDemo /> : tab === 'playback' ? <Playback /> : <Record />}
      </div>
      <EventLogPanel />
    </div>
  )
}
