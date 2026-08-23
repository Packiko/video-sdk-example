import { useSyncExternalStore } from 'react'
import { getLog, subscribeLog } from './eventLog'

// Live event panel: newest first, each entry = what the SDK did + a hint in
// plain Thai explaining why it matters.
export default function EventLogPanel() {
  const entries = useSyncExternalStore(subscribeLog, getLog, getLog)
  return (
    <aside style={{ border: '1px solid #ccc', borderRadius: 8, padding: 12, fontSize: 13, maxHeight: 480, overflowY: 'auto' }}>
      <strong>Event log</strong>
      {entries.length === 0 && <p style={{ color: '#888' }}>(ยังไม่มี event — ลองกดปุ่มฝั่งซ้ายดูครับ)</p>}
      <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0' }}>
        {[...entries].reverse().map((e, i) => (
          <li key={entries.length - i} style={{ marginBottom: 8, borderBottom: '1px solid #eee', paddingBottom: 6 }}>
            <span style={{ color: '#888' }}>{e.at}</span>{' '}
            <code style={{ background: '#f4f4f4', padding: '0 4px', borderRadius: 4 }}>{e.source}</code>{' '}
            {e.message}
            {e.hint && <div style={{ color: '#666', marginTop: 2 }}>💡 {e.hint}</div>}
          </li>
        ))}
      </ul>
    </aside>
  )
}
