import { useEffect, useRef } from 'react'
import { useRecorder } from '@packiko/video-sdk/react'
import { sdkConfig } from './sdk'

// orderRef is required by UseRecorderOptions (attached to the upload for attribution).
// ponytail: hardcoded demo ref — a real integrator passes their own order reference.
const DEMO_ORDER_REF = 'demo-order-001'

export default function Record() {
  const { previewStream, state, progress, videoId, error, start, stop } = useRecorder({
    ...sdkConfig,
    orderRef: DEMO_ORDER_REF,
  })
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = previewStream
  }, [previewStream])

  return (
    <section>
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
