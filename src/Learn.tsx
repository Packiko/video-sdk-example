import { useEffect, useState, type CSSProperties } from 'react'
import { useUploadQueue } from '@packiko/video-sdk/react'
import { createPlayer, PackikoError } from '@packiko/video-sdk'
import { sdkConfig } from './sdk'
import { queue, createDocument, hasDocument } from './queue'
import ProductionRecorder from './ProductionRecorder'
import QueueDemo from './QueueDemo'

// ── Guided walkthrough ──────────────────────────────────────────────────────
// One SDK concept per step: explanation → the exact code → a live widget that
// runs it for real. Built for integrators who found the raw examples hard to
// follow — you can complete the whole flow without reading any source file.

const box: CSSProperties = { border: '1px solid #ddd', borderRadius: 8, padding: 12, marginTop: 12 }
const codeStyle: CSSProperties = {
  background: '#1e1e1e', color: '#d4d4d4', padding: 12, borderRadius: 8,
  fontSize: 13, overflowX: 'auto', whiteSpace: 'pre',
}

function Code({ children }: { children: string }) {
  return <pre style={codeStyle}><code>{children}</code></pre>
}

// step 1 ────────────────────────────────────────────────────────────────────
function SetupStep() {
  const hasPublicKey = Boolean(sdkConfig.publicKey)
  return (
    <div style={box}>
      <p>API URL: <code>{sdkConfig.apiBaseUrl}</code></p>
      <p>Publishable key: <b>{hasPublicKey ? 'พร้อม' : 'ยังไม่ได้ตั้งค่าใน .env'}</b></p>
      <p>Origin <code>http://localhost:5173</code> ต้องถูกลงทะเบียนกับ ThaiCloud ก่อน key ถึงใช้ได้</p>
    </div>
  )
}

// playback ──────────────────────────────────────────────────────────────────
function PlaybackStep({ videoId }: { videoId: string }) {
  const [id, setId] = useState(videoId)
  const [url, setUrl] = useState('')
  const [phase, setPhase] = useState('idle')
  const [error, setError] = useState('')
  async function load() {
    setError(''); setUrl(''); setPhase('resolving…')
    const player = createPlayer(sdkConfig)
    const off = player.on('state', (s) => setPhase(s))
    try {
      const result = await player.resolvePlaybackUrl(id)
      setUrl(result.url)
    } catch (e) {
      setError(e instanceof PackikoError ? `${e.code}: ${e.message}` : String(e))
    } finally {
      off()
    }
  }
  return (
    <div style={box}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <input value={id} onChange={(e) => setId(e.target.value)} placeholder="videoId จากขั้นก่อน" style={{ flex: 1 }} />
        <button onClick={load} disabled={!id}>เปิดดู</button>
      </div>
      <p>state: <b>{phase}</b> {phase === 'processing' && '(server กำลัง transcode — รอสักครู่)'}</p>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      {url && <video src={url} controls playsInline style={{ width: '100%', background: '#000', borderRadius: 8 }} />}
    </div>
  )
}

function AttachStep({ orderRef }: { orderRef: string }) {
  const { jobs } = useUploadQueue(queue)
  const job = jobs.find((j) => j.context.orderRef === orderRef)
  if (!orderRef) return <div style={box}><p>ย้อนกลับไปอัดคลิปในขั้น 2 ก่อนครับ</p></div>
  return (
    <div style={box}>
      {job && !hasDocument(orderRef) && (
        <>
          <p>job <code>{orderRef}</code> จอดรออยู่ (<b>{job.stage}</b>) เพราะ <code>releaseWhen</code> ตอบ false — เอกสารยังไม่มี</p>
          <button onClick={() => createDocument(orderRef)}>สร้างเอกสาร (แล้ว nudge)</button>
        </>
      )}
      {job && hasDocument(orderRef) && <p>เอกสารพร้อมแล้ว — กำลังผูก… (<b>{job.stage}</b>)</p>}
      {!job && <p>🎉 ผูกสำเร็จ — job ออกจากคิวแล้ว คลิปในเครื่องถูกลบ ปลอดภัยครบวงจร</p>}
    </div>
  )
}

function GoLiveStep() {
  const { jobs } = useUploadQueue(queue)
  return (
    <div style={box}>
      <p>ทดสอบ failure cases เหล่านี้ก่อนเปิดใช้จริง:</p>
      <ul>
        <li><b>Offline ก่อนหยุด</b> — stop/enqueue ต้องสำเร็จในเครื่อง แล้ว upload เมื่อ online</li>
        <li><b>Refresh หลัง durable</b> — job ต้องกลับมาและทำต่อเอง</li>
        <li><b>Server 5xx/token หมดอายุ</b> — job ต้องอยู่ใน retry/review พร้อม action ที่ตรงสถานะ</li>
        <li><b>Local storage เต็ม</b> — UI ต้องไม่บอกว่าปลอดภัยและต้องให้ดาวน์โหลด Blob ที่ยังอยู่ใน memory</li>
        <li><b>สลับ user</b> — owner guard ต้องหยุด job ไว้ให้ตรวจสอบ</li>
      </ul>
      <p>ตอนนี้มี {jobs.length} job ในคิว</p>
      <p style={{ color: '#8a5a00' }}>
        SDK 0.3.0 รับประกันหลัง enqueue สำเร็จ ไม่รับประกัน browser/process crash หรือไฟดับกลาง REC
      </p>
      <p style={{ color: '#8a5a00' }}>
        Durable queue 0.3.0 ส่ง orderRef และ Mode B token ได้ แต่ยังไม่ส่ง optional externalUserRef, merchantId หรือ items แบบ direct upload
      </p>
    </div>
  )
}

// wizard shell ──────────────────────────────────────────────────────────────
export default function Learn() {
  const [step, setStep] = useState(0)
  const [videoId, setVideoId] = useState('')
  const [learnOrderRef, setLearnOrderRef] = useState('')

  useEffect(() => queue.onOutcome((outcome) => {
    if (outcome.status === 'bound' && outcome.context.orderRef === learnOrderRef) setVideoId(outcome.videoId)
  }), [learnOrderRef])

  const steps = [
    {
      title: '1 · ตั้งค่า SDK',
      explain: 'ใช้แค่ publishable key (pk_...) กับ API URL — ไม่มี secret ฝั่งเบราว์เซอร์ key นี้ใส่ใน bundle ได้อย่างปลอดภัย',
      code: `import { createUploadQueue } from '@packiko/video-sdk'

const config = {
  apiBaseUrl: 'https://api.packiko.com',
  publicKey: 'pk_...',   // publishable — ปลอดภัยใน browser
}`,
      body: <SetupStep />,
    },
    {
      title: '2 · อัดแล้วเก็บเข้าคิวถาวร',
      explain: 'Production path แยก finalization ออกจาก network: หยุดอัดให้ได้ Blob แล้วรอ enqueue เก็บลงเครื่องสำเร็จก่อน จึงถือว่าออกจากหน้าได้',
      code: `const capture = await createRecorder(config).capture()
capture.start()

const blob = await capture.stop()
await queue.enqueue({ blob, context: { orderRef }, orderRef })
capture.dispose() // durable ก่อน แล้ว network ทำต่อเบื้องหลัง`,
      body: <div style={box}><ProductionRecorder onOrderRef={setLearnOrderRef} onVideoId={setVideoId} /></div>,
    },
    {
      title: '3 · ดู recovery queue',
      explain: 'คิวอยู่ระดับแอป ไม่อยู่ในหน้ากล้อง จึง upload/retry ต่อได้หลัง component unmount และมี Download เป็นทางออกเมื่อ job ต้องตรวจสอบ',
      code: `const { jobs, retry, download } = useUploadQueue(queue)
// render queued/uploading/uploaded/attaching/retry/review`,
      body: <div style={box}><QueueDemo /></div>,
    },
    {
      title: '4 · ผูกกับเอกสาร Partner ทีหลัง',
      explain: 'ปัญหาจริง: คลิปอัปเสร็จก่อนเอกสารพร้อมรับ — คิวแก้ให้โดย "จอดรอ" (ไม่นับเป็น fail) จนกว่า releaseWhen จะตอบ true แล้วพอเอกสารพร้อม เรียก nudge() เพื่อผูกทันทีไม่ต้องรอรอบ',
      code: `// ตอนเอกสารเพิ่งถูกสร้าง:
await queue.nudge((job) => job.context.orderRef === orderRef)`,
      body: <AttachStep orderRef={learnOrderRef} />,
    },
    {
      title: '5 · เปิดดูวิดีโอ',
      explain: 'หลัง Partner backend ผูก videoId แล้ว ให้ขอลิงก์เล่นแบบมีอายุจาก Video API; คลิปที่ยังประมวลผลไม่ใช่ error',
      code: `const player = createPlayer(config)
const { url } = await player.resolvePlaybackUrl(videoId)`,
      body: <PlaybackStep videoId={videoId} />,
    },
    {
      title: '6 · Failure lab และ go-live',
      explain: 'ทดสอบขอบเขตความทนกับระบบจริงของคุณก่อนใช้งาน และสื่อสารสิ่งที่ยังไม่รับประกันอย่างตรงไปตรงมา',
      code: `// offline → stop → durable enqueue → online → upload
// refresh after enqueue → recover
// storage failure → keep Blob downloadable`,
      body: <GoLiveStep />,
    },
  ]

  const s = steps[step]
  return (
    <section>
      <p style={{ color: '#888' }}>
        {steps.map((_, i) => (
          <span key={i} style={{ marginRight: 4 }}>{i === step ? '●' : '○'}</span>
        ))}
        step {step + 1}/{steps.length}
      </p>
      <h2 style={{ margin: '4px 0' }}>{s.title}</h2>
      <p>{s.explain}</p>
      <Code>{s.code}</Code>
      {s.body}
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button onClick={() => setStep(step - 1)} disabled={step === 0}>← ก่อนหน้า</button>
        <button onClick={() => setStep(step + 1)} disabled={step === steps.length - 1}>ถัดไป →</button>
      </div>
    </section>
  )
}
