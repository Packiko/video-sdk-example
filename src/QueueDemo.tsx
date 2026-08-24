import { useEffect, useState } from 'react'
import { useUploadQueue } from '@packiko/video-sdk/react'
import { describeError, type UploadQueueOutcome } from '@packiko/video-sdk'
import { queue, createDocument, hasDocument, type Ctx } from './queue'

// App-wide recovery tray. Recording enters this queue from ProductionRecorder;
// this component only observes and operates jobs, so it may mount/unmount freely.
export default function QueueDemo() {
  const { hydrated, jobs, storageError, retry, nudge, download } = useUploadQueue(queue)
  const [outcomes, setOutcomes] = useState<UploadQueueOutcome<Ctx>[]>([])
  useEffect(() => queue.onOutcome((o) => setOutcomes((prev) => [...prev, o])), [])

  if (!hydrated) return <p>Loading queue…</p>
  return (
    <section>
      {storageError && <p style={{ color: 'crimson' }}>Local storage failing: {storageError}</p>}

      <h3>Recovery queue</h3>
      {jobs.length === 0 && <p>ไม่มีคลิปค้างในเครื่อง</p>}
      <ul>
        {jobs.map((job) => (
          <li key={job.id} style={{ marginBottom: 8 }}>
            <code>{job.context.orderRef}</code> — <strong>{job.stage}</strong>
            {job.progress !== null && ` ${Math.round(job.progress * 100)}%`}
            {job.lastError && ` · ${job.lastError.step}: ${job.lastError.code}`}
            {job.nextRetryAt && ` · ลองอีกครั้ง ${new Date(job.nextRetryAt).toLocaleTimeString()}`}
            {!hasDocument(job.context.orderRef) && (
              <button style={{ marginLeft: 8 }} onClick={() => createDocument(job.context.orderRef)}>
                สร้างเอกสาร Partner และ nudge
              </button>
            )}
            {(job.stage === 'review' || job.stage === 'retry') && (
              <button style={{ marginLeft: 8 }} onClick={() => void retry(job.id)}>
                ลองใหม่ตอนนี้
              </button>
            )}
            <button style={{ marginLeft: 8 }} onClick={() => download(job.id)}>
              ดาวน์โหลดคลิป
            </button>
          </li>
        ))}
      </ul>
      <p>
        <button onClick={() => void nudge()} disabled={jobs.length === 0}>ตรวจงานที่จอดรอทั้งหมด</button>
      </p>

      <h3>ผลลัพธ์ใน session นี้</h3>
      {outcomes.length === 0 && <p>ยังไม่มีผลลัพธ์ใหม่</p>}
      <ul>
        {outcomes.map((o, i) => (
          <li key={i}>
            {o.status === 'bound' && `bound: ${o.context.orderRef} → ${o.videoId} (${o.refId})`}
            {o.status === 'bind-failed' && `bind failed: ${o.context.orderRef} (${o.code})`}
            {o.status === 'upload-failed' && `upload failed: ${o.context.orderRef} — ${describeError(o.code, 'en')}`}
          </li>
        ))}
      </ul>
    </section>
  )
}
