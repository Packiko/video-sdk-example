import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { createRecorder, describeError, PackikoError, type CaptureHandle } from '@packiko/video-sdk'
import { useRecorder } from '@packiko/video-sdk/react'
import { ActivityLog, type ActivityEntry, type ActivityLevel } from './ActivityLog'
import { authInitError, isAuthenticated, login, logout, modeB, modeBConfigured, subject } from './auth'
import { DurableLab } from './DurableLab'
import { ImplementationGuide } from './ImplementationGuide'
import { PlaybackLab, type PlaybackConfig } from './PlaybackLab'
import { modeAConfig, sdkConfig } from './sdk'

type View = 'demo' | 'record' | 'direct' | 'playback' | 'implement'
type AuthChoice = 'a' | 'b'
type DemoState = 'idle' | 'opening' | 'ready' | 'recording' | 'saving' | 'complete' | 'error'

const demoRecorder = createRecorder(modeAConfig)

function messageFor(error: unknown): string {
  if (error instanceof PackikoError) return describeError(error.code, 'th')
  return error instanceof Error ? error.message : String(error)
}

interface EventSourceProps {
  onEvent: (scope: string, message: string, level?: ActivityLevel, detail?: string) => void
}

function LocalDemo({ onEvent }: EventSourceProps) {
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
    onEvent('Camera demo', 'กำลังขอสิทธิ์เปิดกล้อง', 'info', window.location.origin)
    try {
      captureRef.current?.dispose()
      const capture = await demoRecorder.capture()
      captureRef.current = capture
      setStream(capture.previewStream)
      setState('ready')
      onEvent('Camera demo', 'กล้องพร้อมใช้งาน', 'success')
    } catch (cause) {
      setError(messageFor(cause))
      setState('error')
      onEvent('Camera demo', 'เปิดกล้องไม่สำเร็จ', 'error', messageFor(cause))
    }
  }

  function start(): void {
    const capture = captureRef.current
    if (!capture || capture.state !== 'idle') return
    capture.start()
    setState('recording')
    onEvent('Camera demo', 'เริ่มบันทึกในเครื่อง')
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
      onEvent('Camera demo', 'หยุดบันทึกและสร้าง local playback สำเร็จ', 'success')
    } catch (cause) {
      setError(messageFor(cause))
      setState('error')
      onEvent('Camera demo', 'เตรียม local playback ไม่สำเร็จ', 'error', messageFor(cause))
    }
  }

  const status: Record<DemoState, string> = {
    idle: 'พร้อมเริ่ม', opening: 'กำลังเปิดกล้อง', ready: 'กล้องพร้อม', recording: 'กำลังบันทึก',
    saving: 'กำลังเตรียมวิดีโอ', complete: 'วิดีโอพร้อมเล่น', error: 'ไม่สำเร็จ',
  }

  return (
    <section className="recorder-panel">
      <div className="section-title"><div><span>Camera demo</span><h2>ตรวจกล้องโดยไม่อัปโหลด</h2></div><strong className={`status status--${state}`}>{status[state]}</strong></div>
      <div className="video-stage">
        {stream && <video ref={previewRef} autoPlay muted playsInline aria-label="ภาพจากกล้อง" />}
        {clipUrl && <video src={clipUrl} autoPlay controls playsInline aria-label="วิดีโอที่บันทึกในเครื่อง" />}
        {!stream && !clipUrl && <div className="video-placeholder"><strong>กล้องยังไม่เปิด</strong><span>วิดีโอทดลองจะอยู่ใน browser นี้เท่านั้น</span></div>}
      </div>
      <div className="actions">
        {state === 'idle' || state === 'error' ? <button className="primary" onClick={() => void openCamera()}>เปิดกล้อง</button> : null}
        <button className="record" onClick={start} disabled={state !== 'ready'}>เริ่มบันทึก</button>
        <button className="primary" onClick={() => void stop()} disabled={state !== 'recording'}>หยุดและเล่น</button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <p className="note">ขั้นนี้พิสูจน์เฉพาะ camera/record/local playback ไม่มีข้อมูลส่งไป Video API</p>
    </section>
  )
}

interface SetupStepProps {
  authChoice: AuthChoice
  onAuthChoice: (choice: AuthChoice) => void
  apiBaseUrl: string
  onApiBaseUrl: (value: string) => void
  publicKey: string
  onPublicKey: (value: string) => void
  externalUserRef: string
  onExternalUserRef: (value: string) => void
  merchantId: string
  onMerchantId: (value: string) => void
  orderRef: string
  onOrderRef: (value: string) => void
  configured: boolean
  onConfigured: (value: boolean) => void
  onEvent: EventSourceProps['onEvent']
}

function SetupStep(props: SetupStepProps) {
  const modeAReady = Boolean(props.apiBaseUrl.trim() && props.publicKey.trim())
  const modeBReady = modeBConfigured && isAuthenticated()
  const ready = props.authChoice === 'a' ? modeAReady : modeBReady
  const change = (setter: (value: string) => void) => (event: ChangeEvent<HTMLInputElement>) => {
    setter(event.target.value)
    props.onConfigured(false)
  }

  function applyConfiguration(): void {
    props.onConfigured(true)
    props.onEvent('Setup', `ใช้ ${props.authChoice === 'a' ? 'Mode A' : 'Mode B'} สำหรับการทดลอง`, 'success', `origin ${window.location.origin} · API ${props.authChoice === 'a' ? props.apiBaseUrl : modeAConfig.apiBaseUrl}`)
  }

  return (
    <section className="setup step-panel">
      <div className="step-number">1</div>
      <div className="section-title"><div><span>Setup</span><h2>ตั้งค่าบัญชีทดสอบ</h2></div>{props.configured && <strong className="status status--complete">พร้อมบันทึก</strong>}</div>
      <div className="auth-switch" aria-label="โหมดยืนยันตัวตน">
        <button className={props.authChoice === 'a' ? 'active' : ''} onClick={() => { props.onAuthChoice('a'); props.onConfigured(false) }}>Mode A · Partner attests user</button>
        <button className={props.authChoice === 'b' ? 'active' : ''} onClick={() => { props.onAuthChoice('b'); props.onConfigured(false) }}>Mode B · OIDC login</button>
      </div>
      {props.authChoice === 'a' ? (
        <>
          <div className="mode-explainer"><strong>Mode A ไม่มี OIDC Client ID</strong><span>Publishable key ระบุบัญชี Video ส่วนรหัสผู้ใช้ของ Partner ส่งเป็น externalUserRef ได้ ไม่ใช่ clientId</span></div>
          <div className="form-grid">
            <label>Video API URL<input value={props.apiBaseUrl} onChange={change(props.onApiBaseUrl)} placeholder="https://video-uat.packiko.com" disabled={props.configured} /></label>
            <label>Publishable key<input value={props.publicKey} onChange={change(props.onPublicKey)} placeholder="pk_your_test_key" disabled={props.configured} /></label>
            <label>External user reference<input value={props.externalUserRef} onChange={change(props.onExternalUserRef)} placeholder="รหัสผู้ใช้ในระบบ Partner (optional)" disabled={props.configured} /></label>
            <label>Merchant ID<input value={props.merchantId} onChange={change(props.onMerchantId)} placeholder="รหัสร้านค้า (optional)" disabled={props.configured} /></label>
          </div>
        </>
      ) : (
        <div className="auth-summary">
          <div><span>Identity provider</span><code>{modeB.url} / {modeB.realm}</code></div>
          <div><span>OIDC Client ID</span><code>{modeB.clientId}</code></div>
          <div><span>สถานะ</span><strong>{isAuthenticated() ? `เข้าสู่ระบบแล้ว · ${subject()}` : authInitError ? 'เชื่อมต่อ IdP ไม่สำเร็จ' : 'ยังไม่ได้เข้าสู่ระบบ'}</strong></div>
          <p>Client ID เป็น public browser-client value ของระบบ login Partner ส่วน Video ใช้ publishable key ที่ provision ให้รองรับ issuer/JWKS นี้</p>
          <div className="actions">
            {!isAuthenticated() && <button className="primary" onClick={login} disabled={!modeBConfigured || authInitError}>เข้าสู่ระบบ OIDC</button>}
            {isAuthenticated() && <button className="secondary" onClick={logout}>ออกจากระบบ</button>}
          </div>
        </div>
      )}
      <label className="order-field">Order reference<input value={props.orderRef} onChange={change(props.onOrderRef)} disabled={props.configured} /></label>
      <div className="actions">
        {!props.configured && <button className="primary" onClick={applyConfiguration} disabled={!ready || !props.orderRef.trim()}>ใช้ค่านี้และเปิดกล้อง</button>}
        {props.configured && <button className="secondary" onClick={() => props.onConfigured(false)}>แก้ไขการตั้งค่า</button>}
      </div>
    </section>
  )
}

interface IntegrationRecorderProps {
  orderRef: string
  externalUserRef: string
  merchantId: string
  config: PlaybackConfig
  onVideoId: (videoId: string) => void
  onOpenPlayback: () => void
  onEvent: EventSourceProps['onEvent']
}

function IntegrationRecorder({ orderRef, externalUserRef, merchantId, config, onVideoId, onOpenPlayback, onEvent }: IntegrationRecorderProps) {
  const { previewStream, state, progress, videoId, error, start, stop, restart } = useRecorder({
    ...config,
    orderRef,
    upload: { ...(externalUserRef ? { externalUserRef } : {}), ...(merchantId ? { merchantId } : {}) },
  })
  const previewRef = useRef<HTMLVideoElement>(null)
  const previousStateRef = useRef(state)
  const [linked, setLinked] = useState(false)

  useEffect(() => {
    if (previewRef.current) previewRef.current.srcObject = previewStream
  }, [previewStream])

  useEffect(() => {
    if (!videoId) return
    onVideoId(videoId)
    onEvent('Direct upload', 'Video API ยืนยันการอัปโหลดแล้ว', 'success', `videoId ${videoId}`)
  }, [onEvent, onVideoId, videoId])

  useEffect(() => {
    if (previousStateRef.current === state) return
    previousStateRef.current = state
    const copy = state === 'recording' ? 'เริ่มบันทึกวิดีโอ' : state === 'stopped' ? 'หยุดบันทึกและเตรียมอัปโหลด' : state === 'uploading' ? 'กำลังอัปโหลดหลักฐาน' : null
    if (copy) onEvent('Direct upload', copy)
  }, [onEvent, state])

  useEffect(() => {
    if (!error) return
    const originHint = error.code === 'network_error' || error.code === 'origin_not_allowed' ? ` · ตรวจ allowlist ให้ตรง ${window.location.origin}` : ''
    onEvent('Direct upload', 'อัปโหลดไม่สำเร็จ', 'error', `${error.code} · ${messageFor(error)}${originHint}`)
  }, [error, onEvent])

  const label = state === 'recording' ? 'กำลังบันทึก' : state === 'uploading' || state === 'stopped'
    ? 'กำลังอัปโหลด' : state === 'uploaded' ? 'ได้ videoId แล้ว' : state === 'error' ? 'ไม่สำเร็จ' : 'กล้องพร้อม'

  return (
    <section className="recorder-panel step-panel">
      <div className="step-number">2</div>
      <div className="section-title"><div><span>Direct upload</span><h2>บันทึกหลักฐานไปยัง Video API</h2></div><strong className="status">{label}</strong></div>
      <div className="video-stage"><video ref={previewRef} autoPlay muted playsInline aria-label="ภาพจากกล้องสำหรับบันทึกหลักฐาน" /></div>
      {progress !== null && state === 'uploading' && <progress value={progress} max={1} aria-label="กำลังอัปโหลดหลักฐาน" />}
      <div className="actions">
        <button className="record" onClick={start} disabled={state !== 'idle' || !previewStream}>เริ่มบันทึก</button>
        <button className="primary" onClick={() => void stop()} disabled={state !== 'recording'}>หยุดและอัปโหลด</button>
        {state === 'error' && <button className="secondary" onClick={restart}>ลองอีกครั้ง</button>}
        {videoId && <button className="secondary" onClick={onOpenPlayback}>เปิดใน Playback Lab</button>}
        {videoId && !linked && <button className="secondary" onClick={() => setLinked(true)}>จำลอง Partner ผูกออเดอร์</button>}
      </div>
      {videoId && <p className="result">สำเร็จ · videoId <code>{videoId}</code></p>}
      {linked && <p className="result">จำลองแล้ว: Partner backend บันทึก videoId กับ {orderRef}</p>}
      {error && <p className="error" role="alert">{messageFor(error)}</p>}
      {error && (error.code === 'network_error' || error.code === 'origin_not_allowed') && <p className="error-hint">Origin ปัจจุบันคือ <code>{window.location.origin}</code> ต้องลงทะเบียนแบบตรงตัว รวม protocol, host และ port</p>}
      <p className="note">เมื่อ state เป็น uploaded ให้นำ videoId ไปบันทึกกับออเดอร์ผ่าน backend ของ Partner จากนั้นใช้ ID เดิมเปิด Playback ได้</p>
    </section>
  )
}

export default function RecorderLab() {
  const [view, setView] = useState<View>(isAuthenticated() ? 'record' : 'demo')
  const [authChoice, setAuthChoice] = useState<AuthChoice>(isAuthenticated() ? 'b' : 'a')
  const [apiBaseUrl, setApiBaseUrl] = useState(modeAConfig.apiBaseUrl)
  const [publicKey, setPublicKey] = useState(modeAConfig.publicKey)
  const [externalUserRef, setExternalUserRef] = useState('partner-user-001')
  const [merchantId, setMerchantId] = useState('')
  const [orderRef, setOrderRef] = useState('partner-order-001')
  const [configured, setConfigured] = useState(false)
  const [lastVideoId, setLastVideoId] = useState('')
  const nextEntryIdRef = useRef(2)
  const [activityEntries, setActivityEntries] = useState<ActivityEntry[]>([{
    id: 1,
    at: new Date().toLocaleTimeString('th-TH', { hour12: false }),
    scope: 'Example',
    message: 'พร้อมเริ่มทดลอง',
    detail: `origin ${window.location.origin}`,
    level: 'info',
  }])
  const logEvent = useCallback<EventSourceProps['onEvent']>((scope, message, level = 'info', detail) => {
    setActivityEntries((current) => {
      const previous = current[current.length - 1]
      if (previous?.scope === scope && previous.message === message && previous.detail === detail) return current
      return [...current.slice(-49), {
        id: nextEntryIdRef.current++,
        at: new Date().toLocaleTimeString('th-TH', { hour12: false }),
        scope,
        message,
        detail,
        level,
      }]
    })
  }, [])
  const config: PlaybackConfig = authChoice === 'b'
    ? { apiBaseUrl: sdkConfig.apiBaseUrl, publicKey: sdkConfig.publicKey, getUserToken: sdkConfig.getUserToken }
    : { apiBaseUrl, publicKey }

  return (
    <>
      <header className="hero"><div><span>Partner SDK workspace</span><h1>ทดลองและนำ Video SDK ไปใช้จริง</h1><p>แยกพื้นที่ทดสอบกล้อง อัปโหลด Playback และตัวอย่างโค้ดไว้ชัดเจน</p></div></header>
      <nav className="workspace-tabs" aria-label="พื้นที่ทดลอง Video SDK">
        <button className={view === 'demo' ? 'active' : ''} onClick={() => setView('demo')}>Camera demo</button>
        <button className={view === 'record' ? 'active' : ''} onClick={() => setView('record')}>Record & Upload</button>
        <button className={view === 'direct' ? 'active' : ''} onClick={() => setView('direct')}>Direct upload</button>
        <button className={view === 'playback' ? 'active' : ''} onClick={() => setView('playback')}>Playback</button>
        <button className={view === 'implement' ? 'active' : ''} onClick={() => setView('implement')}>Implementation</button>
      </nav>
      {view === 'demo' && <LocalDemo onEvent={logEvent} />}
      {view === 'record' && (
        <>
          <SetupStep authChoice={authChoice} onAuthChoice={setAuthChoice} apiBaseUrl={apiBaseUrl} onApiBaseUrl={setApiBaseUrl} publicKey={publicKey} onPublicKey={setPublicKey} externalUserRef={externalUserRef} onExternalUserRef={setExternalUserRef} merchantId={merchantId} onMerchantId={setMerchantId} orderRef={orderRef} onOrderRef={setOrderRef} configured={configured} onConfigured={setConfigured} onEvent={logEvent} />
          {configured ? <DurableLab key={`${authChoice}:${orderRef}:${publicKey}`} config={config} orderRef={orderRef} externalUserRef={authChoice === 'a' ? externalUserRef : ''} merchantId={merchantId} onEvent={logEvent} /> : <section className="recorder-panel step-panel locked-step"><div className="step-number">2</div><div className="section-title"><div><span>Record & Upload</span><h2>อัดแบบคลิปไม่หาย</h2></div><strong className="status">รอขั้นที่ 1</strong></div><p className="note">ใส่ค่าบัญชีทดสอบและ Order reference ก่อนเปิดกล้อง</p></section>}
        </>
      )}
      {view === 'direct' && (
        <>
          <SetupStep authChoice={authChoice} onAuthChoice={setAuthChoice} apiBaseUrl={apiBaseUrl} onApiBaseUrl={setApiBaseUrl} publicKey={publicKey} onPublicKey={setPublicKey} externalUserRef={externalUserRef} onExternalUserRef={setExternalUserRef} merchantId={merchantId} onMerchantId={setMerchantId} orderRef={orderRef} onOrderRef={setOrderRef} configured={configured} onConfigured={setConfigured} onEvent={logEvent} />
          {configured ? <IntegrationRecorder key={`${authChoice}:${orderRef}:${publicKey}`} orderRef={orderRef} externalUserRef={authChoice === 'a' ? externalUserRef : ''} merchantId={merchantId} config={config} onVideoId={setLastVideoId} onOpenPlayback={() => setView('playback')} onEvent={logEvent} /> : <section className="recorder-panel step-panel locked-step"><div className="step-number">2</div><div className="section-title"><div><span>Direct upload</span><h2>บันทึกหลักฐานวิดีโอ</h2></div><strong className="status">รอขั้นที่ 1</strong></div><p className="note">ใส่ค่าบัญชีทดสอบและ Order reference ก่อนเปิดกล้อง</p></section>}
        </>
      )}
      {view === 'playback' && <PlaybackLab config={config} initialVideoId={lastVideoId} authLabel={authChoice === 'a' ? 'Mode A' : 'Mode B'} onOpenSetup={() => setView('record')} onEvent={logEvent} />}
      {view === 'implement' && <ImplementationGuide authChoice={authChoice} />}
      <ActivityLog entries={activityEntries} onClear={() => setActivityEntries([])} />
    </>
  )
}
