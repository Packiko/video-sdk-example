import { useEffect, useRef, useState } from 'react'
import { createPlayer, createRecorder, describeError, PackikoError, type CaptureHandle } from '@packiko/video-sdk'
import { useRecorder } from '@packiko/video-sdk/react'
import { sdkConfig } from './sdk'

type Mode = 'demo' | 'integration'
type DemoState = 'idle' | 'opening' | 'ready' | 'recording' | 'saving' | 'complete' | 'error'

const demoRecorder = createRecorder(sdkConfig)

function messageFor(error: unknown): string {
  if (error instanceof PackikoError) return describeError(error.code, 'th')
  return error instanceof Error ? error.message : String(error)
}

function LocalDemo() {
  const [state, setState] = useState<DemoState>('idle')
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [clipUrl, setClipUrl] = useState('')
  const [error, setError] = useState('')
  const previewRef = useRef<HTMLVideoElement>(null)
  const captureRef = useRef<CaptureHandle | null>(null)
  const clipUrlRef = useRef('')

  useEffect(() => {
    if (previewRef.current) previewRef.current.srcObject = stream
  }, [stream])

  useEffect(() => () => {
    const capture = captureRef.current
    if (capture?.state === 'recording') void capture.stop().finally(() => capture.dispose())
    else capture?.dispose()
    if (clipUrlRef.current) URL.revokeObjectURL(clipUrlRef.current)
  }, [])

  function clearClip(): void {
    if (clipUrlRef.current) URL.revokeObjectURL(clipUrlRef.current)
    clipUrlRef.current = ''
    setClipUrl('')
  }

  async function openCamera(): Promise<void> {
    setState('opening')
    setError('')
    clearClip()
    try {
      captureRef.current?.dispose()
      const capture = await demoRecorder.capture()
      captureRef.current = capture
      setStream(capture.previewStream)
      setState('ready')
    } catch (cause) {
      setError(messageFor(cause))
      setState('error')
    }
  }

  function start(): void {
    const capture = captureRef.current
    if (!capture || capture.state !== 'idle') return
    capture.start()
    setState('recording')
  }

  async function stop(): Promise<void> {
    const capture = captureRef.current
    if (!capture || capture.state !== 'recording') return
    setState('saving')
    try {
      const clip = await capture.stop()
      capture.dispose()
      captureRef.current = null
      setStream(null)
      const url = URL.createObjectURL(clip)
      clipUrlRef.current = url
      setClipUrl(url)
      setState('complete')
    } catch (cause) {
      setError(messageFor(cause))
      setState('error')
    }
  }

  function reset(): void {
    captureRef.current?.dispose()
    captureRef.current = null
    setStream(null)
    clearClip()
    setError('')
    setState('idle')
  }

  const status: Record<DemoState, string> = {
    idle: 'พร้อมเริ่ม', opening: 'กำลังเปิดกล้อง', ready: 'กล้องพร้อม', recording: 'กำลังบันทึก',
    saving: 'กำลังเตรียมวิดีโอ', complete: 'วิดีโอพร้อมเล่น', error: 'ไม่สำเร็จ',
  }

  return (
    <section className="recorder-panel">
      <div className="section-title">
        <div><span>ทดลองทันที</span><h2>บันทึกและเล่นวิดีโอ</h2></div>
        <strong className={`status status--${state}`}>{status[state]}</strong>
      </div>
      <div className="video-stage">
        {stream && <video ref={previewRef} autoPlay muted playsInline aria-label="ภาพจากกล้อง" />}
        {clipUrl && <video src={clipUrl} autoPlay controls playsInline aria-label="วิดีโอที่บันทึก" />}
        {!stream && !clipUrl && <div className="video-placeholder"><strong>กล้องยังไม่เปิด</strong><span>วิดีโอทดลองจะไม่ถูกอัปโหลด</span></div>}
      </div>
      <div className="actions">
        {(state === 'idle' || state === 'error') && <button className="primary" onClick={() => void openCamera()}>เปิดกล้อง</button>}
        {state === 'ready' && <button className="record" onClick={start}>เริ่มบันทึก</button>}
        {state === 'recording' && <button className="primary" onClick={() => void stop()}>หยุดและเล่นวิดีโอ</button>}
        {state === 'complete' && <button className="secondary" onClick={reset}>บันทึกใหม่</button>}
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <p className="note">โหมดทดลองใช้กล้องในเบราว์เซอร์เท่านั้น ไม่มีข้อมูลส่งออกจากเครื่อง</p>
    </section>
  )
}

function IntegrationRecorder({ orderRef }: { orderRef: string }) {
  const { previewStream, state, progress, videoId, error, start, stop, restart } = useRecorder({
    ...sdkConfig,
    orderRef,
  })
  const previewRef = useRef<HTMLVideoElement>(null)
  const [playbackUrl, setPlaybackUrl] = useState('')
  const [playbackError, setPlaybackError] = useState('')

  useEffect(() => {
    if (previewRef.current) previewRef.current.srcObject = previewStream
  }, [previewStream])

  async function playVideo(): Promise<void> {
    if (!videoId) return
    setPlaybackError('')
    try {
      const result = await createPlayer(sdkConfig).resolvePlaybackUrl(videoId)
      setPlaybackUrl(result.url)
    } catch (cause) {
      setPlaybackError(messageFor(cause))
    }
  }

  const label = state === 'recording' ? 'กำลังบันทึก' : state === 'uploading' || state === 'stopped'
    ? 'กำลังบันทึกหลักฐาน' : state === 'uploaded' ? 'บันทึกสำเร็จ' : state === 'error' ? 'ไม่สำเร็จ' : 'กล้องพร้อม'

  return (
    <section className="recorder-panel">
      <div className="section-title"><div><span>บัญชีทดสอบ</span><h2>บันทึกหลักฐานวิดีโอ</h2></div><strong className="status">{label}</strong></div>
      <div className="video-stage">
        {playbackUrl ? <video src={playbackUrl} autoPlay controls playsInline /> : <video ref={previewRef} autoPlay muted playsInline />}
      </div>
      {progress !== null && state === 'uploading' && <progress value={progress} max={1} aria-label="กำลังบันทึกหลักฐาน" />}
      <div className="actions">
        <button className="record" onClick={start} disabled={state !== 'idle' || !previewStream}>เริ่มบันทึก</button>
        <button className="primary" onClick={() => void stop()} disabled={state !== 'recording'}>หยุดและบันทึก</button>
        {state === 'error' && <button className="secondary" onClick={restart}>ลองอีกครั้ง</button>}
        {videoId && <button className="secondary" onClick={() => void playVideo()}>เปิดวิดีโอ</button>}
      </div>
      {videoId && <p className="result">บันทึกสำเร็จ · videoId <code>{videoId}</code></p>}
      {error && <p className="error" role="alert">{messageFor(error)}</p>}
      {playbackError && <p className="error" role="alert">{playbackError}</p>}
    </section>
  )
}

function IntegrationGuide() {
  return (
    <section className="guide" aria-labelledby="integration-title">
      <div className="section-title"><div><span>Quick start</span><h2 id="integration-title">เชื่อมต่อใน React</h2></div></div>
      <ol>
        <li><strong>ติดตั้งแพ็กเกจ</strong><code>pnpm add @packiko/video-sdk</code></li>
        <li><strong>ใส่ค่าบัญชี</strong><code>VITE_PACKIKO_PUBLIC_KEY=pk_your_key</code></li>
        <li><strong>เก็บ videoId</strong><span>เมื่อสถานะสำเร็จ ให้นำ ID ไปผูกกับเอกสารของระบบคุณ</span></li>
      </ol>
      <details>
        <summary>ตัวอย่าง public API</summary>
        <pre><code>{`const video = useRecorder({
  apiBaseUrl: VIDEO_API_URL,
  publicKey: VIDEO_PUBLIC_KEY,
  orderRef: order.id,
})

video.start()
await video.stop()

// เมื่อ video.state === 'uploaded'
await partnerApi.saveVideoId(order.id, video.videoId)`}</code></pre>
      </details>
      <p className="note">SDK จัดการงานภายในของบริการวิดีโอ ตัวอย่างนี้แสดงเฉพาะ contract ที่แอป Partner ต้องเรียกและผลลัพธ์ที่ต้องเก็บ</p>
    </section>
  )
}

export default function RecorderLab() {
  const [mode, setMode] = useState<Mode>('demo')
  const [orderRef, setOrderRef] = useState('partner-order-001')
  const hasKey = Boolean(sdkConfig.publicKey)

  return (
    <>
      <header className="hero">
        <div><span>Partner example</span><h1>เพิ่มวิดีโอหลักฐานในระบบของคุณ</h1><p>ทดลองกล้องก่อน แล้วใช้ public API ชุดสั้นเพื่อรับ videoId กลับไปผูกกับเอกสาร</p></div>
        <div className="mode-switch" aria-label="เลือกโหมด">
          <button className={mode === 'demo' ? 'active' : ''} onClick={() => setMode('demo')}>ทดลองกล้อง</button>
          <button className={mode === 'integration' ? 'active' : ''} onClick={() => setMode('integration')}>เชื่อมบัญชีทดสอบ</button>
        </div>
      </header>

      {mode === 'demo' ? <LocalDemo /> : (
        <>
          {hasKey ? (
            <>
              <label className="order-field">Order reference<input value={orderRef} onChange={(event) => setOrderRef(event.target.value)} /></label>
              <IntegrationRecorder orderRef={orderRef} />
            </>
          ) : (
            <section className="setup">
              <span>ต้องตั้งค่าก่อน</span><h2>เพิ่ม publishable key ของบัญชีทดสอบ</h2>
              <pre><code>{`VITE_PACKIKO_API_BASE_URL=https://video-uat.packiko.com\nVITE_PACKIKO_PUBLIC_KEY=pk_your_key`}</code></pre>
              <p>จากนั้นเปิด dev server ใหม่ และตรวจว่า origin ปัจจุบันได้รับอนุญาตสำหรับ key นี้</p>
            </section>
          )}
          <IntegrationGuide />
        </>
      )}
    </>
  )
}
