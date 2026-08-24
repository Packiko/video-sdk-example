import { useEffect, useRef, useState } from 'react'
import { createPlayer, createRecorder, describeError, PackikoError, type CaptureHandle } from '@packiko/video-sdk'
import { useRecorder } from '@packiko/video-sdk/react'
import { authInitError, isAuthenticated, login, logout, modeB, modeBConfigured, subject } from './auth'
import { modeAConfig, sdkConfig } from './sdk'

type Mode = 'demo' | 'integration'
type AuthChoice = 'a' | 'b'
type DemoState = 'idle' | 'opening' | 'ready' | 'recording' | 'saving' | 'complete' | 'error'
type RecorderConfig = { apiBaseUrl: string; publicKey: string; getUserToken?: () => Promise<string> }

const demoRecorder = createRecorder(modeAConfig)

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

function SetupStep({ authChoice, onAuthChoice, orderRef, onOrderRef, configured, onConfigured }: {
  authChoice: AuthChoice
  onAuthChoice: (choice: AuthChoice) => void
  orderRef: string
  onOrderRef: (value: string) => void
  configured: boolean
  onConfigured: (value: boolean) => void
}) {
  const modeAReady = Boolean(modeAConfig.publicKey)
  const modeBReady = modeBConfigured && isAuthenticated()
  const ready = authChoice === 'a' ? modeAReady : modeBReady

  return (
    <section className="setup step-panel">
      <div className="step-number">1</div>
      <div className="section-title"><div><span>Setup</span><h2>เลือกวิธียืนยันตัวตน</h2></div>{configured && <strong className="status status--complete">ตั้งค่าแล้ว</strong>}</div>
      <div className="auth-switch" aria-label="โหมดยืนยันตัวตน">
        <button className={authChoice === 'a' ? 'active' : ''} onClick={() => { onAuthChoice('a'); onConfigured(false) }}>Mode A · Publishable key</button>
        <button className={authChoice === 'b' ? 'active' : ''} onClick={() => { onAuthChoice('b'); onConfigured(false) }}>Mode B · OIDC login</button>
      </div>

      {authChoice === 'a' ? (
        <div className="auth-summary">
          <div><span>Video API</span><code>{modeAConfig.apiBaseUrl}</code></div>
          <div><span>Publishable key</span><strong>{modeAReady ? 'พร้อมใช้งาน' : 'ยังไม่ได้ตั้งใน .env'}</strong></div>
          <p>ใช้สำหรับระบบที่ยืนยันผู้ใช้เอง ต้องลงทะเบียน origin ที่เปิด Example นี้ไว้กับ key</p>
        </div>
      ) : (
        <div className="auth-summary">
          <div><span>Identity provider</span><code>{modeB.url} / {modeB.realm}</code></div>
          <div><span>Client ID</span><code>{modeB.clientId}</code></div>
          <div><span>สถานะ</span><strong>{isAuthenticated() ? `เข้าสู่ระบบแล้ว · ${subject()}` : authInitError ? 'เชื่อมต่อ IdP ไม่สำเร็จ' : 'ยังไม่ได้เข้าสู่ระบบ'}</strong></div>
          <p>Client ID เป็นค่าของ public browser client ไม่ใช่ secret และ Video test key ต้องได้รับการตั้งค่าให้รองรับ issuer/JWKS นี้ก่อน</p>
          <div className="actions">
            {!isAuthenticated() && <button className="primary" onClick={login} disabled={!modeBConfigured || authInitError}>เข้าสู่ระบบ OIDC</button>}
            {isAuthenticated() && <button className="secondary" onClick={logout}>ออกจากระบบ</button>}
          </div>
        </div>
      )}

      <label className="order-field">Order reference<input value={orderRef} onChange={(event) => { onOrderRef(event.target.value); onConfigured(false) }} disabled={configured} /></label>
      <div className="actions">
        {!configured && <button className="primary" onClick={() => onConfigured(true)} disabled={!ready || !orderRef.trim()}>ใช้ค่านี้และเริ่มทดลอง</button>}
        {configured && <button className="secondary" onClick={() => onConfigured(false)}>แก้ไขการตั้งค่า</button>}
      </div>
      {!ready && authChoice === 'a' && <p className="error">เพิ่ม VITE_PACKIKO_PUBLIC_KEY ใน .env แล้วเปิด dev server ใหม่</p>}
    </section>
  )
}

function IntegrationRecorder({ orderRef, config }: { orderRef: string; config: RecorderConfig }) {
  const { previewStream, state, progress, videoId, error, start, stop, restart } = useRecorder({ ...config, orderRef })
  const previewRef = useRef<HTMLVideoElement>(null)
  const [playbackUrl, setPlaybackUrl] = useState('')
  const [playbackError, setPlaybackError] = useState('')
  const [linked, setLinked] = useState(false)

  useEffect(() => {
    if (previewRef.current) previewRef.current.srcObject = previewStream
  }, [previewStream])

  async function playVideo(): Promise<void> {
    if (!videoId) return
    setPlaybackError('')
    try {
      const result = await createPlayer(config).resolvePlaybackUrl(videoId)
      setPlaybackUrl(result.url)
    } catch (cause) {
      setPlaybackError(messageFor(cause))
    }
  }

  const label = state === 'recording' ? 'กำลังบันทึก' : state === 'uploading' || state === 'stopped'
    ? 'กำลังบันทึกหลักฐาน' : state === 'uploaded' ? 'บันทึกสำเร็จ' : state === 'error' ? 'ไม่สำเร็จ' : 'กล้องพร้อม'

  return (
    <section className="recorder-panel step-panel">
      <div className="step-number">2</div>
      <div className="section-title"><div><span>Record</span><h2>บันทึกหลักฐานวิดีโอ</h2></div><strong className="status">{label}</strong></div>
      <div className="video-stage">
        {playbackUrl ? <video src={playbackUrl} autoPlay controls playsInline /> : <video ref={previewRef} autoPlay muted playsInline />}
      </div>
      {progress !== null && state === 'uploading' && <progress value={progress} max={1} aria-label="กำลังบันทึกหลักฐาน" />}
      <div className="actions">
        <button className="record" onClick={start} disabled={state !== 'idle' || !previewStream}>เริ่มบันทึก</button>
        <button className="primary" onClick={() => void stop()} disabled={state !== 'recording'}>หยุดและบันทึก</button>
        {state === 'error' && <button className="secondary" onClick={restart}>ลองอีกครั้ง</button>}
        {videoId && <button className="secondary" onClick={() => void playVideo()}>เปิดวิดีโอ</button>}
        {videoId && !linked && <button className="secondary" onClick={() => setLinked(true)}>จำลองผูกกับออเดอร์</button>}
      </div>
      {videoId && <p className="result">บันทึกสำเร็จ · videoId <code>{videoId}</code></p>}
      {linked && <p className="result">ระบบ Partner บันทึก videoId กับออเดอร์ {orderRef} แล้ว</p>}
      {error && <p className="error" role="alert">{messageFor(error)}</p>}
      {playbackError && <p className="error" role="alert">{playbackError}</p>}
      <p className="note">SDK ส่งคืน videoId แต่ไม่เขียนข้อมูลลงฐานข้อมูลออเดอร์ของ Partner จุดนี้ Partner เรียก backend ของตนเอง</p>
    </section>
  )
}

function CapabilityGuide({ authChoice }: { authChoice: AuthChoice }) {
  return (
    <>
      <section className="guide step-panel" aria-labelledby="integration-title">
        <div className="step-number">3</div>
        <div className="section-title"><div><span>Integrate</span><h2 id="integration-title">แบ่งหน้าที่ให้ชัดก่อนนำไปใช้</h2></div></div>
        <div className="responsibility-grid">
          <div><h3>SDK จัดการให้</h3><ul><li>เปิดกล้องและบันทึกวิดีโอ</li><li>ส่งหลักฐานและคืน videoId</li><li>รายงานสถานะและข้อผิดพลาด</li><li>เตรียมวิดีโอสำหรับ Playback</li></ul></div>
          <div><h3>Partner ต้องทำ</h3><ul><li>เตรียม key, origin และการ login</li><li>ส่ง orderRef ที่ถูกต้อง</li><li>บันทึก videoId กับออเดอร์ของตน</li><li>กำหนดสิทธิ์และ UX ในระบบของตน</li></ul></div>
        </div>
        <details>
          <summary>ตัวอย่าง public API สำหรับ {authChoice === 'b' ? 'Mode B' : 'Mode A'}</summary>
          <pre><code>{`const video = useRecorder({
  apiBaseUrl: VIDEO_API_URL,
  publicKey: VIDEO_PUBLIC_KEY,${authChoice === 'b' ? '\n  getUserToken: () => auth.getAccessToken(),' : ''}
  orderRef: order.id,
})

video.start()
await video.stop()

// เมื่อบันทึกสำเร็จ
await partnerApi.saveVideoId(order.id, video.videoId)`}</code></pre>
        </details>
      </section>

      <section className="guarantees">
        <div><span className="availability availability--ready">พร้อมใน SDK ปัจจุบัน</span><strong>บันทึก ส่งหลักฐาน รับ videoId และ Playback</strong><p>ทดสอบได้เมื่อ key, origin และบัญชีผู้ใช้พร้อม</p></div>
        <div><span className="availability availability--planned">รอ SDK รุ่นถัดไป</span><strong>ออกจากหน้า/ออฟไลน์โดยงานไม่สะดุด</strong><p>ยังไม่ควรประกาศเป็น production guarantee</p></div>
        <div><span className="availability availability--planned">รอการออกแบบเพิ่มเติม</span><strong>กู้วิดีโอเมื่อ browser หรือเครื่องดับกลางบันทึก</strong><p>ยังไม่อยู่ใน guarantee ปัจจุบัน</p></div>
      </section>
    </>
  )
}

export default function RecorderLab() {
  const [mode, setMode] = useState<Mode>(isAuthenticated() ? 'integration' : 'demo')
  const [authChoice, setAuthChoice] = useState<AuthChoice>(isAuthenticated() ? 'b' : 'a')
  const [orderRef, setOrderRef] = useState('partner-order-001')
  const [configured, setConfigured] = useState(false)
  const config: RecorderConfig = authChoice === 'b'
    ? { apiBaseUrl: sdkConfig.apiBaseUrl, publicKey: sdkConfig.publicKey, getUserToken: sdkConfig.getUserToken }
    : modeAConfig

  return (
    <>
      <header className="hero">
        <div><span>Partner guided sandbox</span><h1>ทดลอง Video SDK แบบทีละขั้น</h1><p>ตั้งค่าบัญชี บันทึกหลักฐาน รับ videoId และลอง Playback โดยไม่ต้องรู้รายละเอียดการทำงานภายใน</p></div>
        <div className="mode-switch" aria-label="เลือกโหมด">
          <button className={mode === 'demo' ? 'active' : ''} onClick={() => setMode('demo')}>ทดลองกล้อง</button>
          <button className={mode === 'integration' ? 'active' : ''} onClick={() => setMode('integration')}>Guided integration</button>
        </div>
      </header>

      {mode === 'demo' ? <LocalDemo /> : (
        <>
          <SetupStep authChoice={authChoice} onAuthChoice={setAuthChoice} orderRef={orderRef} onOrderRef={setOrderRef} configured={configured} onConfigured={setConfigured} />
          {configured && <IntegrationRecorder key={`${authChoice}:${orderRef}`} orderRef={orderRef} config={config} />}
          {!configured && (
            <section className="recorder-panel step-panel locked-step" aria-label="ขั้นบันทึกวิดีโอ รอการตั้งค่า">
              <div className="step-number">2</div>
              <div className="section-title">
                <div><span>Record</span><h2>บันทึกหลักฐานวิดีโอ</h2></div>
                <strong className="status">รอขั้นที่ 1</strong>
              </div>
              <p className="note">ตั้งค่าบัญชีและ Order reference ให้พร้อมก่อนเปิดกล้องทดสอบ</p>
            </section>
          )}
          <CapabilityGuide authChoice={authChoice} />
        </>
      )}
    </>
  )
}
