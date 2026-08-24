import { useEffect, useState } from 'react'
import { useUploadQueue } from '@packiko/video-sdk/react'
import { describeError, type UploadQueueOutcome } from '@packiko/video-sdk'
import { queue, createDocument, hasDocument, requestBackgroundSync, type Ctx } from './queue'

let nextOrder = 1

// Durable queue + deferred attach demo. Walkthrough:
// 1. Pick a clip → it enqueues under a fresh order WITHOUT a document → parks.
// 2. "Create document" → nudge() → the parked job binds in that same cycle.
// 3. Refresh mid-upload to see checkpoint resume; go offline to see retries.
export default function QueueDemo() {
  const { hydrated, jobs, storageError, retry, nudge, download } = useUploadQueue(queue)
  const [outcomes, setOutcomes] = useState<UploadQueueOutcome<Ctx>[]>([])
  // onOutcome returns its unsubscriber — exactly what useEffect wants back.
  useEffect(() => queue.onOutcome((o) => setOutcomes((prev) => [...prev, o])), [])

  const enqueueFile = async (file: File) => {
    const orderRef = `EX-${Date.now()}-${nextOrder++}`
    await queue.enqueue({ blob: file, context: { orderRef }, orderRef })
    requestBackgroundSync() // one-shot: re-register after each enqueue
  }

  if (!hydrated) return <p>Loading queue…</p>
  return (
    <section>
      <p>
        <label>
          Add a clip to the queue:{' '}
          <input
            type="file"
            accept="video/*"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void enqueueFile(file)
              e.target.value = ''
            }}
          />
        </label>
      </p>
      <p style={{ color: '#888', fontSize: 14 }}>
        Any local video file works — real integrations pass the recorder's blob straight to <code>enqueue()</code>, no file picking.
      </p>
      {storageError && <p style={{ color: 'crimson' }}>Local storage failing: {storageError}</p>}

      <h3>Jobs</h3>
      {jobs.length === 0 && <p>(queue empty)</p>}
      <ul>
        {jobs.map((job) => (
          <li key={job.id} style={{ marginBottom: 8 }}>
            <code>{job.context.orderRef}</code> — <strong>{job.stage}</strong>
            {job.progress !== null && ` ${Math.round(job.progress * 100)}%`}
            {job.lastError && ` · ${job.lastError.step}: ${job.lastError.code}`}
            {!hasDocument(job.context.orderRef) && (
              <button style={{ marginLeft: 8 }} onClick={() => createDocument(job.context.orderRef)}>
                Create document (nudge)
              </button>
            )}
            {(job.stage === 'review' || job.stage === 'retry') && (
              <button style={{ marginLeft: 8 }} onClick={() => void retry(job.id)}>
                Retry now
              </button>
            )}
            <button style={{ marginLeft: 8 }} onClick={() => download(job.id)}>
              Download clip
            </button>
          </li>
        ))}
      </ul>
      <p>
        <button onClick={() => void nudge()}>Re-check all parked jobs</button>
      </p>

      <h3>Outcomes</h3>
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
