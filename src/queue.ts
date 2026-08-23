import { createUploadQueue, registerBackgroundSync, type AttachResult, type UploadQueueStage } from '@packiko/video-sdk'
import { sdkConfig } from './sdk'
import { logEvent } from './eventLog'

// ponytail: this module owns app-wide singletons (the queue + its listeners +
// the SW message listener). A hot swap would create a second queue and stack
// duplicate handlers — force a full page reload on change instead.
if (import.meta.hot) {
  import.meta.hot.accept(() => import.meta.hot?.invalidate())
}

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
  logEvent('queue', `สร้างเอกสารของ ${orderRef} แล้ว → nudge()`, 'บอกคิวว่าเอกสารพร้อมแล้ว — job ที่จอดรอจะถูกเช็คใน cycle นี้เลย ไม่ต้องรอ timer')
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
    const existing = bindings.get(job.context.orderRef)
    // Idempotent by contract: a repeat call for the already-bound clip must
    // stay 'ok' — but a DIFFERENT clip against a bound order is a conflict,
    // not something to silently overwrite.
    if (existing !== undefined && existing !== job.videoId) {
      return { status: 'failed', code: 'order_already_bound' }
    }
    bindings.set(job.context.orderRef, job.videoId)
    return { status: 'ok', refId: `${job.context.orderRef}:${job.videoId}` }
  },
})

// ── Event-log wiring (demo-only): narrate every stage change + outcome ──────
const STAGE_HINTS: Record<UploadQueueStage, string> = {
  queued: 'คลิปถูกเก็บลงเครื่องแล้ว (durable) — ปิดแท็บ/เน็ตหลุด/เครื่องดับ ก็ไม่หาย',
  uploading: 'กำลังส่งไฟล์ขึ้น server',
  uploaded: 'ไฟล์ขึ้นถึง server แล้ว — จากนี้ต่อให้ retry ก็ไม่อัปไฟล์ซ้ำ',
  attaching: 'เอกสารพร้อมแล้ว — กำลังเรียก attach callback ของแอปเพื่อผูกคลิป',
  retry: 'รอรอบถัดไป — ถ้าจอดรอเอกสารอยู่ กด nudge เพื่อเช็คทันทีได้',
  review: 'ไปต่อเองไม่ได้ ต้องมีคนช่วย — แก้สาเหตุแล้วกด Retry',
}
const lastStages = new Map<string, UploadQueueStage>()
queue.subscribe(() => {
  const snap = queue.getSnapshot()
  for (const job of snap.jobs) {
    if (lastStages.get(job.id) !== job.stage) {
      lastStages.set(job.id, job.stage)
      logEvent('queue', `${job.context.orderRef} → ${job.stage}`, STAGE_HINTS[job.stage])
    }
  }
  for (const id of [...lastStages.keys()]) {
    if (!snap.jobs.some((j) => j.id === id)) lastStages.delete(id) // job finished & left the queue
  }
})
queue.onOutcome((o) => {
  if (o.status === 'bound') {
    logEvent('queue', `${o.context.orderRef} ผูกสำเร็จ → ${o.videoId}`, 'อัปโหลด + attach ครบ — คลิปในเครื่องถูกลบแล้ว')
  } else if (o.status === 'bind-failed') {
    logEvent('queue', `${o.context.orderRef} ผูกไม่สำเร็จ (${o.code})`, 'attach ตอบ failed — job รออยู่ใน review')
  } else {
    logEvent('queue', `${o.context.orderRef} อัปโหลดไม่สำเร็จ (${o.code})`, 'job รออยู่ใน review — กด Retry หลังแก้สาเหตุ')
  }
})

// Page side of the Background Sync recipe (see public/sw.js for the SW side):
// drain when the service worker asks.
if ('serviceWorker' in navigator) {
  void navigator.serviceWorker.register('/sw.js')
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'packiko-video:drain') {
      logEvent('sw', 'service worker ปลุกคิว (Background Sync)', 'เน็ตกลับมาแล้ว เบราว์เซอร์ปลุก SW → SW ส่งข้อความให้หน้าเว็บ drain')
      void queue.drain()
    }
  })
}

// One-shot sync registrations: re-register after each enqueue (cheap no-op if
// still pending). Best-effort — resolves false silently on Safari/Firefox.
export function requestBackgroundSync(): void {
  void registerBackgroundSync()
}
