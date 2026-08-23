import { createUploadQueue, registerBackgroundSync, type AttachResult } from '@packiko/video-sdk'
import { sdkConfig } from './sdk'

// The partner context carried opaquely by the queue. The SDK never reads it —
// it only hands it back in callbacks and outcomes.
export type Ctx = { orderRef: string }

// ── Simulated partner backend ───────────────────────────────────────────────
// A real integration checks its own API here. This demo keeps an in-memory
// "order document" store so you can watch the deferred-attach flow: enqueue a
// clip BEFORE its document exists → the job parks → create the document →
// nudge() binds it in that same cycle.
const documents = new Set<string>()
const bindings = new Map<string, string>() // orderRef → videoId (makes attach idempotent)

export function hasDocument(orderRef: string): boolean {
  return documents.has(orderRef)
}

export function createDocument(orderRef: string): void {
  documents.add(orderRef)
  // The moment the document is ready, bind in the current cycle — no timer wait.
  void queue.nudge((job) => job.context.orderRef === orderRef)
}

export function listBindings(): ReadonlyMap<string, string> {
  return bindings
}

// One queue instance per app — jobs keep settling after screens unmount.
export const queue = createUploadQueue<Ctx>(sdkConfig, {
  releaseWhen: (job) => documents.has(job.context.orderRef),
  attach: (job): AttachResult => {
    if (!documents.has(job.context.orderRef)) return { status: 'parked' } // gate re-arms
    bindings.set(job.context.orderRef, job.videoId) // repeat call for a bound clip stays 'ok'
    return { status: 'ok', refId: `${job.context.orderRef}:${job.videoId}` }
  },
})

// Page side of the Background Sync recipe (see public/sw.js for the SW side):
// drain when the service worker asks.
if ('serviceWorker' in navigator) {
  void navigator.serviceWorker.register('/sw.js')
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'packiko-video:drain') void queue.drain()
  })
}

// One-shot sync registrations: re-register after each enqueue (cheap no-op if
// still pending). Best-effort — resolves false silently on Safari/Firefox.
export function requestBackgroundSync(): void {
  void registerBackgroundSync()
}
