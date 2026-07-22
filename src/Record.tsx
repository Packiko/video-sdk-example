import { useEffect, useRef, useState } from 'react'
import { useRecorder } from '@packiko/video-sdk/react'
import type { VideoItem } from '@packiko/video-sdk'
import { sdkConfig } from './sdk'

// orderRef is required by UseRecorderOptions (attached to the upload for attribution).
// ponytail: hardcoded demo ref — a real integrator passes their own order reference.
const DEMO_ORDER_REF = 'demo-order-001'

// Optional item-details snapshot (SDK 0.2.0) — product data only, never personal data.
// Snake_case fields mirror the wire shape; validated client-side before any byte uploads
// (items_invalid / duplicate_item_sku). One required-only item, one with optional weight_g.
// ponytail: hardcoded demo items — a real integrator sends the order's actual line items.
const DEMO_ITEMS: VideoItem[] = [
  { sku: 'SKU-RED-TEE-M', name: 'เสื้อยืดสีแดง ไซซ์ M', qty: 2 },
  { sku: 'SKU-MUG-CERAMIC', name: 'แก้วเซรามิก', qty: 1, weight_g: 350 },
]

export default function Record() {
  // Optional partner/ZORT merchant id — omitted = non-ZORT upload. The hook reads
  // upload options at stop-time, so the latest typed value is what gets sent.
  const [merchantId, setMerchantId] = useState('')
  const { previewStream, state, progress, videoId, error, start, stop } = useRecorder({
    ...sdkConfig,
    orderRef: DEMO_ORDER_REF,
    upload: { items: DEMO_ITEMS, ...(merchantId ? { merchantId } : {}) },
  })
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = previewStream
  }, [previewStream])

  return (
    <section>
      <input value={merchantId} onChange={(e) => setMerchantId(e.target.value)}
        placeholder="merchant_id (optional — partner/ZORT)"
        style={{ width: '100%', boxSizing: 'border-box', marginBottom: 12 }} />

      <video ref={videoRef} autoPlay muted playsInline
        style={{ width: '100%', background: '#000', borderRadius: 8 }} />

      <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
        {/* Mirror the SDK's start() guard: idle AND the capture handle is ready
            (previewStream is set in the same step captureRef becomes non-null). */}
        <button onClick={start} disabled={!(state === 'idle' && previewStream)}>Start</button>
        <button onClick={stop} disabled={state !== 'recording'}>Stop</button>
      </div>

      <p>state: <b>{state}</b></p>
      {progress != null && <p>upload: {Math.round(progress * 100)}%</p>}
      {error && <p style={{ color: 'crimson' }}>{error.code}: {error.message}</p>}

      {videoId && (
        <p>
          videoId: <code>{videoId}</code>{' '}
          <button onClick={() => navigator.clipboard.writeText(videoId)}>copy</button>
        </p>
      )}
    </section>
  )
}
