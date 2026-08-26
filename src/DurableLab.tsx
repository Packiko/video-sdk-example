import { useEffect, useRef, useState } from 'react'
import {
  createDurableRecorder,
  createUploadQueue,
  describeError,
  PackikoError,
  type DurableRecordingSession,
  type UploadQueue,
  type UploadQueueStage,
} from '@packiko/video-sdk'
import { useUploadQueue } from '@packiko/video-sdk/react'
import type { ActivityLevel } from './ActivityLog'
import type { PlaybackConfig } from './PlaybackLab'

type DurableContext = { source: string }

const stageLabel: Record<UploadQueueStage, string> = {
  queued: 'รออัปโหลด',
  uploading: 'กำลังอัปโหลด',
  uploaded: 'อัปโหลดแล้ว',
  attaching: 'กำลังผูกเอกสาร',
  retry: 'รอลองใหม่',
  review: 'ต้องตรวจสอบ',
}

function messageFor(error: unknown): string {
  if (error instanceof PackikoError) return describeError(error.code, 'th')
  return error instanceof Error ? error.message : String(error)
}

interface DurableLabProps {
  config: PlaybackConfig
  orderRef: string
  externalUserRef: string
  merchantId: string
  onEvent: (scope: string, message: string, level?: ActivityLevel, detail?: string) => void
}

interface DurableCaptureProps extends DurableLabProps {
  queue: UploadQueue<DurableContext>
}

function DurableCapture({ queue, orderRef, externalUserRef, merchantId, onEvent }: DurableCaptureProps) {
  const [recorder] = useState(() => createDurableRecorder<DurableContext>({
    queue,
    getContext: () => ({
      orderRef,
      context: { source: 'react-durable-demo' },
      upload: { ...(externalUserRef ? { externalUserRef } : {}), ...(merchantId ? { merchantId } : {}) },
    }),
  }))
  const [session, setSession] = useState<DurableRecordingSession<DurableContext> | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const previewRef = useRef<HTMLVideoElement>(null)

  // Unmount = leaving the screen: dispose() rescues an in-flight clip into the queue.
  useEffect(() => () => recorder.dispose(), [recorder])

  useEffect(() => {
    if (previewRef.current) previewRef.current.srcObject = session?.previewStream ?? null
  }, [session])

  async function start(): Promise<void> {
    setBusy(true)
    setError('')
    try {
      setSession(await recorder.start())
      onEvent('Durable upload', 'เริ่มบันทึก — context ถูก freeze ที่จุดนี้')
    } catch (cause) {
      setError(messageFor(cause))
      onEvent('Durable upload', 'เปิดกล้องไม่สำเร็จ', 'error', messageFor(cause))
    } finally {
      setBusy(false)
    }
  }

  async function stop(): Promise<void> {
    if (!session) return
    setBusy(true)
    try {
      const job = await session.stop()
      setSession(null)
      onEvent('Durable upload', 'คลิป durable แล้ว ไม่ต้องใช้เน็ต — อัปโหลดต่อให้เองเบื้องหลัง', 'success', `job ${job.id}`)
    } catch (cause) {
      // Storage refused the clip: the Blob rides on the error so it can still be saved as a file.
      const blob = cause instanceof PackikoError && 'blob' in cause ? (cause as { blob?: Blob }).blob : undefined
      if (blob) {
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = `${orderRef}.webm`
        link.click()
        URL.revokeObjectURL(link.href)
      }
      setSession(null)
      setError(messageFor(cause))
      onEvent('Durable upload', 'บันทึกลง storage ไม่สำเร็จ', 'error', messageFor(cause))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="video-stage">
        {session ? <video ref={previewRef} autoPlay muted playsInline aria-label="ภาพจากกล้องสำหรับ durable recorder" />
          : <div className="video-placeholder"><strong>กล้องยังไม่เปิด</strong><span>กด "เริ่มบันทึก" เพื่อเปิดกล้องและอัดในคำสั่งเดียว</span></div>}
      </div>
      <div className="actions">
        <button className="record" onClick={() => void start()} disabled={busy || Boolean(session)}>เริ่มบันทึก</button>
        <button className="primary" onClick={() => void stop()} disabled={busy || !session}>หยุด (durable ทันที)</button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
    </>
  )
}

export function DurableLab({ config, orderRef, externalUserRef, merchantId, onEvent }: DurableLabProps) {
  // In a real app the queue is created once per app, not per screen — here it lives
  // with the tab so the demo can be configured from the Setup step.
  const [queue] = useState(() => createUploadQueue<DurableContext>(config))
  const [onScreen, setOnScreen] = useState(true)
  const { hydrated, jobs, storageError, retry, download } = useUploadQueue(queue)

  useEffect(() => queue.onOutcome((outcome) => {
    if (outcome.status === 'bound') onEvent('Durable upload', 'Video API ยืนยันการอัปโหลดแล้ว', 'success', `videoId ${outcome.videoId}`)
    else onEvent('Durable upload', 'งานในคิวไม่สำเร็จ', 'error', `${outcome.code}${outcome.message ? ' · ' + outcome.message : ''}`)
  }), [onEvent, queue])

  return (
    <section className="recorder-panel step-panel">
      <div className="step-number">2</div>
      <div className="section-title"><div><span>Durable upload</span><h2>อัดแบบคลิปไม่หาย แม้ออกจากหน้าจอ</h2></div><strong className="status">{onScreen ? 'อยู่ในหน้าจอ' : 'ออกจากหน้าจอแล้ว'}</strong></div>
      {onScreen ? (
        <DurableCapture queue={queue} config={config} orderRef={orderRef} externalUserRef={externalUserRef} merchantId={merchantId} onEvent={onEvent} />
      ) : (
        <p className="result">หน้าจออัดถูก unmount แล้ว — ถ้ากำลังอัดค้างอยู่ dispose() จะ finalize คลิปเข้าคิวให้ ไม่ทิ้ง ดูสถานะได้ในคิวด้านล่าง</p>
      )}
      <div className="actions">
        <button className="secondary" onClick={() => {
          setOnScreen((current) => !current)
          onEvent('Durable upload', onScreen ? 'จำลองออกจากหน้าจอกลางอัด (unmount)' : 'กลับเข้าหน้าจออัด')
        }}>{onScreen ? 'จำลองออกจากหน้าจอกลางอัด' : 'กลับเข้าหน้าจออัด'}</button>
      </div>
      <div className="section-title"><div><span>Upload queue</span><h2>คิวอัปโหลด</h2></div></div>
      {storageError && <p className="error" role="alert">Local storage มีปัญหา: {storageError}</p>}
      {!hydrated ? <p className="note">กำลังอ่านคิวที่ค้างอยู่…</p>
        : jobs.length === 0 ? <p className="note">ไม่มีงานค้าง — คลิปที่เข้าคิวแล้วรอด refresh, ปิดเบราว์เซอร์, เน็ตหลุด และ crash</p>
        : jobs.map((job) => (
          <div className="actions" key={job.id}>
            <span className="status">{stageLabel[job.stage]} · {job.orderRef}{job.progress !== null && job.stage === 'uploading' ? ` · ${Math.round(job.progress * 100)}%` : ''}{job.videoId ? ` · videoId ${job.videoId}` : ''}</span>
            {(job.stage === 'retry' || job.stage === 'review') && <button className="secondary" onClick={() => void retry(job.id)}>ลองใหม่</button>}
            <button className="secondary" onClick={() => download(job.id)}>ดาวน์โหลดคลิป</button>
          </div>
        ))}
      <p className="note">ข้อจำกัดจริงของเบราว์เซอร์: refresh/ปิดแท็บ<em>ระหว่าง</em>อัดเป็น best effort และไฟดับกลางอัดคลิปหาย — แต่ refresh หลังกดหยุดสำเร็จปลอดภัย คิว resume ให้ตอนเปิดใหม่</p>
    </section>
  )
}
