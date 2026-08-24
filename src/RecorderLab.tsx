import { useEffect, useRef, useState } from 'react'
import { createRecorder, describeError, PackikoError, type CaptureHandle } from '@packiko/video-sdk'
import EventLogPanel from './EventLogPanel'
import ProductionRecorder from './ProductionRecorder'
import { logEvent } from './eventLog'
import { sdkConfig } from './sdk'

type LabMode = 'demo' | 'uat'
type LocalPhase = 'idle' | 'acquiring' | 'ready' | 'recording' | 'finalizing' | 'review' | 'error'

const recorder = createRecorder(sdkConfig)

function formatError(error: unknown): string {
  if (error instanceof PackikoError) return `${describeError(error.code, 'th')} (${error.code})`
  return error instanceof Error ? error.message : String(error)
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

interface CheckRowProps {
  label: string
  state: 'pass' | 'warn' | 'fail'
  detail: string
}

function CheckRow({ label, state, detail }: CheckRowProps) {
  const stateLabel = state === 'pass' ? 'พร้อม' : state === 'warn' ? 'ต้องตรวจ' : 'ยังไม่พร้อม'
  return (
    <li className="check-row">
      <span className={`check-dot check-dot--${state}`} aria-hidden="true" />
      <span className="check-label">{label}</span>
      <span className={`check-state check-state--${state}`}>{stateLabel}</span>
      <span className="check-detail">{detail}</span>
    </li>
  )
}

function SetupChecks({ mode }: { mode: LabMode }) {
  const hasMediaDevices = typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia)
  const hasMediaRecorder = typeof MediaRecorder !== 'undefined'
  const secure = typeof window !== 'undefined' && (window.isSecureContext || window.location.hostname === 'localhost')
  const hasKey = Boolean(sdkConfig.publicKey)

  return (
    <section className="preflight" aria-labelledby="preflight-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Preflight</p>
          <h2 id="preflight-title">ความพร้อมก่อนเริ่ม</h2>
        </div>
        <span className={`mode-badge mode-badge--${mode}`}>{mode === 'demo' ? 'Local only' : 'Video UAT'}</span>
      </div>
      <ul className="check-list">
        <CheckRow label="Camera API" state={hasMediaDevices ? 'pass' : 'fail'} detail={hasMediaDevices ? 'เบราว์เซอร์ขอสิทธิ์กล้องได้' : 'ไม่พบ mediaDevices.getUserMedia'} />
        <CheckRow label="MediaRecorder" state={hasMediaRecorder ? 'pass' : 'fail'} detail={hasMediaRecorder ? 'บันทึก WebM ได้' : 'เบราว์เซอร์นี้ไม่รองรับ'} />
        <CheckRow label="Secure context" state={secure ? 'pass' : 'fail'} detail={secure ? window.location.origin : 'เปิดผ่าน HTTPS หรือ localhost'} />
        {mode === 'uat' && (
          <>
            <CheckRow label="Publishable key" state={hasKey ? 'pass' : 'fail'} detail={hasKey ? 'โหลดจาก environment แล้ว' : 'ตั้ง VITE_PACKIKO_PUBLIC_KEY ใน .env'} />
            <CheckRow label="Origin allowlist" state="warn" detail={`ยืนยันกับ ThaiCloud ว่า ${window.location.origin} ลงทะเบียนแล้ว`} />
            <CheckRow label="Video API" state="warn" detail={sdkConfig.apiBaseUrl} />
          </>
        )}
      </ul>
    </section>
  )
}

function LocalRecorder() {
  const [phase, setPhase] = useState<LocalPhase>('idle')
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [playbackUrl, setPlaybackUrl] = useState('')
  const [clip, setClip] = useState<Blob | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState('')
  const previewRef = useRef<HTMLVideoElement>(null)
  const playbackRef = useRef<HTMLVideoElement>(null)
  const captureRef = useRef<CaptureHandle | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const playbackUrlRef = useRef('')

  useEffect(() => {
    if (previewRef.current) previewRef.current.srcObject = stream
  }, [stream])

  useEffect(() => {
    if (phase !== 'recording') return
    const startedAt = Date.now() - elapsed * 1000
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000)
    return () => window.clearInterval(timer)
  }, [phase])

  useEffect(() => {
    if (phase === 'review' && playbackRef.current) void playbackRef.current.play().catch(() => undefined)
  }, [phase, playbackUrl])

  useEffect(() => () => {
    abortRef.current?.abort()
    const capture = captureRef.current
    if (capture?.state === 'recording') void capture.stop().finally(() => capture.dispose())
    else capture?.dispose()
    if (playbackUrlRef.current) URL.revokeObjectURL(playbackUrlRef.current)
  }, [])

  function clearPlayback(): void {
    if (playbackUrlRef.current) URL.revokeObjectURL(playbackUrlRef.current)
    playbackUrlRef.current = ''
    setPlaybackUrl('')
    setClip(null)
  }

  async function openCamera(): Promise<void> {
    abortRef.current?.abort()
    clearPlayback()
    setError('')
    setElapsed(0)
    setPhase('acquiring')
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const capture = await recorder.capture({ signal: controller.signal })
      if (controller.signal.aborted) {
        capture.dispose()
        return
      }
      captureRef.current?.dispose()
      captureRef.current = capture
      setStream(capture.previewStream)
      setPhase('ready')
      logEvent('demo', 'เปิดกล้องสำเร็จ', 'โหมด Demo ยังไม่เรียก Video API')
    } catch (cause) {
      if (controller.signal.aborted) return
      setError(formatError(cause))
      setPhase('error')
    } finally {
      if (abortRef.current === controller) abortRef.current = null
    }
  }

  function startRecording(): void {
    const capture = captureRef.current
    if (!capture || capture.state !== 'idle') return
    setElapsed(0)
    setError('')
    capture.start()
    setPhase('recording')
    logEvent('demo', 'เริ่มบันทึก', 'ไฟล์ยังอยู่ในหน่วยความจำของแท็บนี้')
  }

  async function stopRecording(): Promise<void> {
    const capture = captureRef.current
    if (!capture || capture.state !== 'recording') return
    setPhase('finalizing')
    try {
      const blob = await capture.stop()
      capture.dispose()
      captureRef.current = null
      setStream(null)
      clearPlayback()
      const url = URL.createObjectURL(blob)
      playbackUrlRef.current = url
      setClip(blob)
      setPlaybackUrl(url)
      setPhase('review')
      logEvent('demo', `สร้างคลิป ${formatBytes(blob.size)}`, 'เล่นกลับและดาวน์โหลดได้ทันทีโดยไม่ใช้ key หรือ network')
    } catch (cause) {
      setError(formatError(cause))
      setPhase('error')
    }
  }

  function reset(): void {
    abortRef.current?.abort()
    abortRef.current = null
    captureRef.current?.dispose()
    captureRef.current = null
    setStream(null)
    clearPlayback()
    setElapsed(0)
    setError('')
    setPhase('idle')
  }

  function download(): void {
    if (!clip || !playbackUrl) return
    const anchor = document.createElement('a')
    anchor.href = playbackUrl
    anchor.download = `packiko-video-demo-${Date.now()}.webm`
    anchor.click()
  }

  const stateText: Record<LocalPhase, string> = {
    idle: 'พร้อมเริ่ม', acquiring: 'กำลังขอสิทธิ์กล้อง', ready: 'กล้องพร้อม', recording: `กำลังอัด ${formatDuration(elapsed)}`,
    finalizing: 'กำลังสร้างไฟล์', review: 'คลิปพร้อมเล่น', error: 'เกิดข้อผิดพลาด',
  }

  return (
    <section className="recorder-workspace" aria-labelledby="demo-recorder-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Try now</p>
          <h2 id="demo-recorder-title">อัดและเล่นกลับบนเครื่อง</h2>
        </div>
        <span className={`phase phase--${phase}`}>{stateText[phase]}</span>
      </div>

      <div className="media-stage">
        {stream && <video ref={previewRef} autoPlay muted playsInline aria-label="ภาพตัวอย่างจากกล้อง" />}
        {playbackUrl && <video ref={playbackRef} src={playbackUrl} controls playsInline aria-label="วิดีโอที่เพิ่งบันทึก" />}
        {!stream && !playbackUrl && (
          <div className="media-empty">
            <strong>ยังไม่ได้เปิดกล้อง</strong>
            <span>คลิปจะอยู่เฉพาะในเบราว์เซอร์และไม่ถูกอัปโหลด</span>
          </div>
        )}
        {phase === 'recording' && <span className="recording-indicator">REC {formatDuration(elapsed)}</span>}
      </div>

      <div className="command-bar">
        {(phase === 'idle' || phase === 'error') && <button className="button button--primary" onClick={() => void openCamera()}>เปิดกล้อง</button>}
        {phase === 'ready' && <button className="button button--record" onClick={startRecording}>เริ่มอัด</button>}
        {phase === 'recording' && <button className="button button--primary" onClick={() => void stopRecording()}>หยุดและดูคลิป</button>}
        {phase === 'review' && (
          <>
            <button className="button button--primary" onClick={download}>ดาวน์โหลด WebM</button>
            <button className="button button--secondary" onClick={reset}>อัดใหม่</button>
          </>
        )}
        {(phase === 'acquiring' || phase === 'finalizing') && <span className="working-copy">{stateText[phase]}...</span>}
      </div>
      {clip && <p className="clip-meta">ไฟล์ {formatBytes(clip.size)} · ไม่ส่งข้อมูลออกจากเครื่อง</p>}
      {error && <p className="error-message" role="alert">{error}</p>}
      <p className="scope-note">Demo นี้ยืนยัน camera → record → stop → playback เท่านั้น ไม่ได้ทดสอบ upload, durable recovery หรือ Partner attach</p>
    </section>
  )
}

export default function RecorderLab() {
  const [mode, setMode] = useState<LabMode>('demo')
  const hasKey = Boolean(sdkConfig.publicKey)

  return (
    <div className="lab-layout">
      <header className="lab-header">
        <div>
          <p className="eyebrow">Recorder Lab</p>
          <h1>ทดลอง Video SDK จากเส้นทางเดียว</h1>
          <p>เริ่มจากอัดและเล่นกลับบนเครื่อง แล้วค่อยสลับไปเชื่อม Video UAT เมื่อมี key และ origin พร้อม</p>
        </div>
        <div className="mode-switch" aria-label="เลือกโหมดทดลอง">
          <button className={mode === 'demo' ? 'active' : ''} onClick={() => setMode('demo')}>Demo บนเครื่อง</button>
          <button className={mode === 'uat' ? 'active' : ''} onClick={() => setMode('uat')}>เชื่อม UAT จริง</button>
        </div>
      </header>

      <SetupChecks mode={mode} />

      {mode === 'demo' ? (
        <div className="lab-columns">
          <LocalRecorder />
          <EventLogPanel />
        </div>
      ) : hasKey ? (
        <div className="lab-columns">
          <section className="recorder-workspace">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Live integration</p>
                <h2>อัดเข้าคิวและผูกเอกสาร Partner</h2>
              </div>
            </div>
            <ProductionRecorder />
          </section>
          <EventLogPanel />
        </div>
      ) : (
        <section className="setup-block">
          <p className="eyebrow">Setup required</p>
          <h2>เพิ่ม publishable key ก่อนทดสอบ UAT</h2>
          <p>สร้างไฟล์ <code>.env</code> แล้วเปิด dev server ใหม่ หลังจากนั้นตรวจว่า origin นี้ถูกเพิ่มใน allowlist</p>
          <pre><code>{`VITE_PACKIKO_API_BASE_URL=https://video-uat.packiko.com\nVITE_PACKIKO_PUBLIC_KEY=pk_your_uat_key`}</code></pre>
          <p>ยังไม่มี key สามารถกลับไปใช้ Demo บนเครื่องเพื่อทดสอบกล้อง การอัด และ playback ได้ครบ</p>
        </section>
      )}
    </div>
  )
}
