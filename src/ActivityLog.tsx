import { useState } from 'react'

export type ActivityLevel = 'info' | 'success' | 'error'

export interface ActivityEntry {
  id: number
  at: string
  scope: string
  message: string
  detail?: string
  level: ActivityLevel
}

interface ActivityLogProps {
  entries: ActivityEntry[]
  onClear: () => void
}

function asText(entries: ActivityEntry[]): string {
  return entries.map((entry) => `[${entry.at}] [${entry.scope}] ${entry.message}${entry.detail ? ` · ${entry.detail}` : ''}`).join('\n')
}

export function ActivityLog({ entries, onClear }: ActivityLogProps) {
  const [copied, setCopied] = useState(false)
  // ponytail: newest first only at render time, state stays append-order for dedup
  const newestFirst = [...entries].reverse()

  async function copy(): Promise<void> {
    await navigator.clipboard.writeText(asText(newestFirst))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section className="activity-log" aria-labelledby="activity-log-title">
      <div className="activity-log-head">
        <div><span>Diagnostics</span><h2 id="activity-log-title">Activity Log</h2></div>
        <div className="activity-log-actions">
          <button onClick={() => void copy()} disabled={entries.length === 0}>{copied ? 'คัดลอกแล้ว ✓' : 'คัดลอก Log'}</button>
          <button onClick={onClear} disabled={entries.length === 0}>ล้าง</button>
        </div>
      </div>
      <p className="activity-log-safety">Log นี้ไม่บันทึก publishable key, user token, upload URL หรือ Playback URL</p>
      <div className="activity-log-list" role="log" aria-live="polite">
        {entries.length === 0 ? <p className="activity-log-empty">ยังไม่มีกิจกรรม</p> : newestFirst.map((entry) => (
          <div className={`activity-entry activity-entry--${entry.level}`} key={entry.id}>
            <time>{entry.at}</time>
            <strong>{entry.scope}</strong>
            <span>{entry.message}</span>
            {entry.detail && <code>{entry.detail}</code>}
          </div>
        ))}
      </div>
    </section>
  )
}
