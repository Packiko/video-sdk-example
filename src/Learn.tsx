import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useRecorder, useUploadQueue } from '@packiko/video-sdk/react'
import { createPlayer, PackikoError } from '@packiko/video-sdk'
import { sdkConfig } from './sdk'
import { queue, createDocument, hasDocument, requestBackgroundSync } from './queue'

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
  return (
    <div style={box}>
      <p>✅ หน้านี้ตั้งค่าไว้แล้วจาก <code>.env</code> — origin <code>http://localhost:5173</code> ต้องถูกลงทะเบียนกับ ThaiCloud ก่อน key ถึงใช้ได้</p>
    </div>
  )
}

// step 2 ────────────────────────────────────────────────────────────────────
function RecordStep({ onVideoId }: { onVideoId: (id: string) => void }) {
  const { previewStream, state, progress, videoId, error, start, stop } = useRecorder({
    ...sdkConfig,
    orderRef: 'learn-demo-001',
  })
  const videoRef = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = previewStream
  }, [previewStream])
  useEffect(() => {
    if (videoId) onVideoId(videoId)
  }, [videoId, onVideoId])
  return (
    <div style={box}>
      <video ref={videoRef} autoPlay muted playsInline style={{ width: '100%', background: '#000', borderRadius: 8 }} />
      <div style={{ display: 'flex', gap: 8, margin: '8px 0' }}>
        <button onClick={start} disabled={!(state === 'idle' && previewStream)}>เริ่มอัด</button>
        <button onClick={stop} disabled={state !== 'recording'}>หยุด (แล้วอัปโหลดอัตโนมัติ)</button>
      </div>
      <p>state: <b>{state}</b>{progress != null && <> · upload {Math.round(progress * 100)}%</>}</p>
      {error && <p style={{ color: 'crimson' }}>{error.code}: {error.message}</p>}
      {videoId && <p>🎉 ได้ <code>videoId: {videoId}</code> — จำไว้ใช้ขั้นถัดไปให้แล้ว</p>}
    </div>
  )
}

// step 3 ────────────────────────────────────────────────────────────────────
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

// steps 4-6 share the app queue ─────────────────────────────────────────────
function QueueStep({ orderRef, onOrderRef }: { orderRef: string; onOrderRef: (ref: string) => void }) {
  // The active order lives in the wizard (lifted state), not here — this step
  // unmounts when you navigate away and must not forget the job it created.
  const { jobs } = useUploadQueue(queue)
  const enqueue = async (file: File) => {
    const ref = `learn-${Date.now()}`
    onOrderRef(ref)
    await queue.enqueue({ blob: file, context: { orderRef: ref }, orderRef: ref })
    requestBackgroundSync()
  }
  const job = jobs.find((j) => j.context.orderRef === orderRef)
  return (
    <div style={box}>
      <p>
        <input type="file" accept="video/*" onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void enqueue(f)
          e.target.value = ''
        }} />
      </p>
      {job && (
        <p>
          job <code>{job.context.orderRef}</code> → <b>{job.stage}</b>
          {job.stage === 'retry' && ' — จอดรอเอกสารอยู่ (เราตั้งใจยังไม่สร้างเอกสาร) ✋ ไปขั้นถัดไปเลย'}
        </p>
      )}
      {orderRef && !job && <p>🎉 job หายจากคิว = อัปโหลด + ผูกครบแล้ว (ถ้าผูกก่อนถึงขั้นถัดไป แปลว่าเอกสารมีอยู่แล้ว)</p>}
      {!orderRef && <p style={{ color: '#888' }}>เลือกไฟล์วิดีโออะไรก็ได้ในเครื่อง (ไม่เกี่ยวกับคลิปขั้น 2 — ของจริงโค้ดคุณส่ง blob จากตัวอัดเข้า enqueue() ตรงๆ ไม่มีการเลือกไฟล์) — คลิปจะถูกเก็บลงเครื่องก่อน แล้วค่อยอัปโหลดเบื้องหลัง</p>}
    </div>
  )
}

function AttachStep({ orderRef }: { orderRef: string }) {
  const { jobs } = useUploadQueue(queue)
  const job = jobs.find((j) => j.context.orderRef === orderRef)
  if (!orderRef) return <div style={box}><p>⬅ ย้อนกลับไปเพิ่มคลิปเข้าคิวในขั้นก่อนก่อนครับ</p></div>
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

function ResilienceStep() {
  const { jobs } = useUploadQueue(queue)
  return (
    <div style={box}>
      <p>ลองทำสิ่งเหล่านี้แล้วดู Event log ในแท็บ Playground:</p>
      <ul>
        <li>🔄 <b>Refresh กลางอัปโหลด</b> — job กลับมาทำต่อเอง และไฟล์ที่ขึ้นแล้วจะไม่อัปซ้ำ</li>
        <li>📴 <b>ปิดเน็ต</b> (DevTools → Network → Offline) — job รอ แล้วไปต่อเมื่อ online</li>
        <li>❌ <b>ปิดแท็บทิ้งเลย</b> — เปิดใหม่ คิวโหลดกลับมาจากเครื่องเอง</li>
      </ul>
      <p>ตอนนี้มี {jobs.length} job ในคิว{jobs.length > 0 && ' — ลองเลย'}</p>
    </div>
  )
}

// wizard shell ──────────────────────────────────────────────────────────────
export default function Learn() {
  const [step, setStep] = useState(0)
  const [videoId, setVideoId] = useState('')
  const [learnOrderRef, setLearnOrderRef] = useState('')

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
      title: '2 · อัดวิดีโอ + อัปโหลด',
      explain: 'useRecorder จัดการให้ครบ: ขอกล้อง → อัด → พอกดหยุด ไฟล์จะอัปโหลดตรงขึ้น storage (ไม่ผ่าน server ของคุณ) แล้วได้ videoId กลับมา',
      code: `const { previewStream, state, progress, videoId,
        start, stop } = useRecorder({ ...config, orderRef })`,
      body: <RecordStep onVideoId={setVideoId} />,
    },
    {
      title: '3 · เปิดดูวิดีโอ',
      explain: 'เอา videoId ไปขอลิงก์เล่น — ถ้าคลิปยัง transcode ไม่เสร็จ SDK จะรอให้จนพร้อม',
      code: `const player = createPlayer(config)
const { url } = await player.resolvePlaybackUrl(videoId)`,
      body: <PlaybackStep videoId={videoId} />,
    },
    {
      title: '4 · คิวถาวร (enqueue)',
      explain: 'โจทย์จริงหน้างาน: เน็ตหน้าคลังไม่นิ่ง อัปโหลดตรงๆ แบบขั้น 2 คลิปหายกลางทางได้ — enqueue() จึงเก็บคลิปลงเครื่อง "ก่อน" ยิง network ใดๆ: ตั้งแต่วินาทีนั้น refresh/ปิดแท็บ/เน็ตหลุด คลิปไม่หาย คิวอัปโหลดเบื้องหลัง + retry ให้เอง (ส่วน "คลิปเสร็จก่อนเอกสาร" คือขั้นถัดไป)',
      code: `const queue = createUploadQueue(config, {
  releaseWhen: (job) => documentReady(job.context),
  attach: (job) => bindClip(job.context, job.videoId),
})
await queue.enqueue({ blob, context, orderRef })  // durable ทันที`,
      body: <QueueStep orderRef={learnOrderRef} onOrderRef={setLearnOrderRef} />,
    },
    {
      title: '5 · ผูกกับเอกสารทีหลัง (deferred attach)',
      explain: 'ปัญหาจริง: คลิปอัปเสร็จก่อนเอกสารพร้อมรับ — คิวแก้ให้โดย "จอดรอ" (ไม่นับเป็น fail) จนกว่า releaseWhen จะตอบ true แล้วพอเอกสารพร้อม เรียก nudge() เพื่อผูกทันทีไม่ต้องรอรอบ',
      code: `// ตอนเอกสารเพิ่งถูกสร้าง:
await queue.nudge((job) => job.context.orderRef === orderRef)`,
      body: <AttachStep orderRef={learnOrderRef} />,
    },
    {
      title: '6 · ทดสอบความทน',
      explain: 'ของจริงพังเสมอ — คิวออกแบบมาให้รอด ลองพังดูเองได้เลย',
      code: `// ไม่ต้องเขียนโค้ดเพิ่ม — ความทนมากับ createUploadQueue อยู่แล้ว`,
      body: <ResilienceStep />,
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
