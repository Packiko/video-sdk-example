import { useSyncExternalStore } from 'react'
import { getLog, subscribeLog } from './eventLog'

// Live event panel: newest first, each entry = what the SDK did + a hint in
// plain Thai explaining why it matters.
export default function EventLogPanel() {
  const entries = useSyncExternalStore(subscribeLog, getLog, getLog)
  return (
    <aside className="event-panel">
      <strong>ลำดับเหตุการณ์</strong>
      {entries.length === 0 && <p className="empty-copy">ยังไม่มีเหตุการณ์ เริ่มจากเปิดกล้องทางซ้าย</p>}
      <ul>
        {[...entries].reverse().map((e, i) => (
          <li key={entries.length - i}>
            <time>{e.at}</time>{' '}
            <code>{e.source}</code>{' '}
            {e.message}
            {e.hint && <div className="event-hint">{e.hint}</div>}
          </li>
        ))}
      </ul>
    </aside>
  )
}
