import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createRecorder,
  describeError,
  PackikoError,
  type CaptureHandle,
  type UploadJob,
} from '@packiko/video-sdk'
import { useUploadQueue } from '@packiko/video-sdk/react'
import { createDocument, hasDocument, queue, requestBackgroundSync, type Ctx } from './queue'
import { sdkConfig } from './sdk'
import { logEvent } from './eventLog'

type Phase = 'idle' | 'acquiring' | 'ready' | 'recording' | 'finalizing' | 'persisting' | 'durable' | 'bound' | 'error'

interface ProductionRecorderProps {
  initialOrderRef?: string
  onOrderRef?: (orderRef: string) => void
  onVideoId?: (videoId: string) => void
}

const recorder = createRecorder(sdkConfig)

function makeOrderRef(): string {
  return `partner-${Date.now()}`
}

function errorText(error: unknown): string {
  if (error instanceof PackikoError) return `${describeError(error.code, 'th')} (${error.code})`
  return error instanceof Error ? error.message : String(error)
}

function downloadBlob(blob: Blob, orderRef: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${orderRef || 'video-evidence'}.webm`
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export default function ProductionRecorder({ initialOrderRef, onOrderRef, onVideoId }: ProductionRecorderProps) {
  const { hydrated, jobs } = useUploadQueue(queue)
  const [orderRef, setOrderRef] = useState(initialOrderRef ?? makeOrderRef)
  const [phase, setPhase] = useState<Phase>('idle')
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState('')
  const [durableJobId, setDurableJobId] = useState('')
  const [videoId, setVideoId] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const captureRef = useRef<CaptureHandle | null>(null)
  const captureAbortRef = useRef<AbortController | null>(null)
  const bindingRef = useRef<Ctx | null>(null)
  const finalizeRef = useRef<Promise<void> | null>(null)
  const recoverableBlobRef = useRef<Blob | null>(null)
  const mountedRef = useRef(true)
  const onOrderRefRef = useRef(onOrderRef)
  const onVideoIdRef = useRef(onVideoId)
  onOrderRefRef.current = onOrderRef
  onVideoIdRef.current = onVideoId

  const clearCapture = useCallback((capture: CaptureHandle) => {
    capture.dispose()
    if (captureRef.current === capture) captureRef.current = null
    if (mountedRef.current) setPreviewStream(null)
  }, [])

  const finalize = useCallback((capture: CaptureHandle, binding: Ctx): Promise<void> => {
    if (finalizeRef.current) return finalizeRef.current

    const task = (async () => {
      try {
        if (mountedRef.current) {
          setPhase('finalizing')
          setError('')
        }
        const blob = await capture.stop()
        recoverableBlobRef.current = blob
        if (mountedRef.current) setPhase('persisting')

        const job = await queue.enqueue({
          blob,
          context: binding,
          orderRef: binding.orderRef,
          fileName: `${binding.orderRef}.webm`,
        })
        recoverableBlobRef.current = null
        requestBackgroundSync()
        logEvent('queue', `${binding.orderRef} durable แล้ว`, 'enqueue resolve หลัง Blob ถูกเก็บในเครื่อง จากนี้ network มาทีหลังได้')
        if (mountedRef.current) {
          setDurableJobId(job.id)
          setPhase('durable')
        }
      } catch (cause) {
        const message = errorText(cause)
        logEvent('queue', `${binding.orderRef} ยัง durable ไม่สำเร็จ`, message)
        if (mountedRef.current) {
          setError(message)
          setPhase('error')
        }
      } finally {
        clearCapture(capture)
        finalizeRef.current = null
      }
    })()

    finalizeRef.current = task
    return task
  }, [clearCapture])

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = previewStream
  }, [previewStream])

  useEffect(() => queue.onOutcome((outcome) => {
    if (outcome.context.orderRef !== bindingRef.current?.orderRef) return
    if (outcome.status === 'bound') {
      setVideoId(outcome.videoId)
      setPhase('bound')
      onVideoIdRef.current?.(outcome.videoId)
    }
  }), [])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      captureAbortRef.current?.abort()
      captureAbortRef.current = null
      const capture = captureRef.current
      const binding = bindingRef.current
      captureRef.current = null
      if (!capture) return
      if (capture.state === 'recording' && binding) void finalize(capture, binding)
      else capture.dispose()
    }
  }, [finalize])

  async function acquireCamera(): Promise<void> {
    captureAbortRef.current?.abort()
    const controller = new AbortController()
    captureAbortRef.current = controller
    setPhase('acquiring')
    setError('')
    try {
      const capture = await recorder.capture({ signal: controller.signal })
      if (!mountedRef.current || captureAbortRef.current !== controller) {
        capture.dispose()
        return
      }
      captureRef.current?.dispose()
      captureRef.current = capture
      setPreviewStream(capture.previewStream)
      setPhase('ready')
      capture.on('state', (state) => {
        if (state === 'error' && mountedRef.current) {
          setError('MediaRecorder หยุดทำงานก่อนสร้างคลิปสำเร็จ')
          setPhase('error')
        }
        if (state === 'stopped' && bindingRef.current) void finalize(capture, bindingRef.current)
      })
      logEvent('recorder', 'เปิดกล้องแล้ว', 'ยังไม่มี network request จนกว่า queue เริ่ม upload')
    } catch (cause) {
      if (controller.signal.aborted) return
      setError(errorText(cause))
      setPhase('error')
    } finally {
      if (captureAbortRef.current === controller) captureAbortRef.current = null
    }
  }

  function startRecording(): void {
    const capture = captureRef.current
    const ref = orderRef.trim()
    if (!capture || capture.state !== 'idle' || !ref) return
    const binding = { orderRef: ref }
    bindingRef.current = binding
    onOrderRefRef.current?.(ref)
    setDurableJobId('')
    setVideoId('')
    setError('')
    capture.start()
    setPhase('recording')
    logEvent('recorder', `เริ่มอัด ${ref}`, 'reference ถูก freeze แล้ว การเปลี่ยน input หลังจากนี้ไม่มีผลกับคลิปนี้')
  }

  function stopRecording(): void {
    const capture = captureRef.current
    const binding = bindingRef.current
    if (capture && binding) void finalize(capture, binding)
  }

  function startAnother(): void {
    captureAbortRef.current?.abort()
    captureAbortRef.current = null
    captureRef.current?.dispose()
    captureRef.current = null
    bindingRef.current = null
    recoverableBlobRef.current = null
    setPreviewStream(null)
    setOrderRef(makeOrderRef())
    setDurableJobId('')
    setVideoId('')
    setError('')
    setPhase('idle')
  }

  const activeRef = bindingRef.current?.orderRef
  const activeJob = jobs.find((job: UploadJob<Ctx>) => job.id === durableJobId || job.context.orderRef === activeRef)
  const busy = phase === 'acquiring' || phase === 'recording' || phase === 'finalizing' || phase === 'persisting'

  return (
    <section>
      <label>
        Order reference ของระบบ Partner
        <input
          value={orderRef}
          onChange={(event) => setOrderRef(event.target.value)}
          disabled={busy || phase === 'durable' || phase === 'bound'}
          style={{ display: 'block', width: '100%', boxSizing: 'border-box', margin: '6px 0 12px' }}
        />
      </label>

      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={{ display: previewStream ? 'block' : 'none', width: '100%', background: '#000', borderRadius: 8 }}
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '12px 0' }}>
        <button onClick={() => void acquireCamera()} disabled={phase !== 'idle' && phase !== 'error'}>เปิดกล้อง</button>
        <button onClick={startRecording} disabled={phase !== 'ready' || !orderRef.trim()}>เริ่มอัด</button>
        <button onClick={stopRecording} disabled={phase !== 'recording'}>หยุดและเก็บเข้าคิว</button>
        {(phase === 'durable' || phase === 'bound') && <button onClick={startAnother}>อัดรายการใหม่</button>}
      </div>

      <p>capture: <b>{phase}</b></p>
      {!hydrated && <p>กำลังอ่านคิวที่ค้างจากครั้งก่อน...</p>}
      {phase === 'persisting' && <p>กำลังเก็บ Blob ลงเครื่อง ห้ามถือว่าปลอดภัยจนขั้นตอนนี้สำเร็จ</p>}
      {activeJob && (
        <p>
          queue: <b>{activeJob.stage}</b>
          {activeJob.progress !== null && <> · {Math.round(activeJob.progress * 100)}%</>}
        </p>
      )}
      {phase === 'durable' && <p>คลิปอยู่ใน durable queue แล้ว ออกจากหน้านี้หรือออฟไลน์ได้</p>}
      {activeRef && phase === 'durable' && !hasDocument(activeRef) && (
        <button onClick={() => createDocument(activeRef)}>จำลอง Partner backend: สร้างเอกสารและผูกคลิป</button>
      )}
      {videoId && <p>videoId: <code>{videoId}</code></p>}
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      {recoverableBlobRef.current && (
        <button onClick={() => downloadBlob(recoverableBlobRef.current!, activeRef ?? orderRef)}>
          ดาวน์โหลดคลิปที่ยังเก็บเข้าคิวไม่สำเร็จ
        </button>
      )}
    </section>
  )
}
