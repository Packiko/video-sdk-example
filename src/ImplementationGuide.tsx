import { useState } from 'react'

type AuthChoice = 'a' | 'b'
type GuideTab = 'config' | 'record' | 'attach' | 'playback'

interface ImplementationGuideProps {
  authChoice: AuthChoice
}

const snippets: Record<GuideTab, { title: string; copy: string; code: (authChoice: AuthChoice) => string }> = {
  config: {
    title: '1. ตั้งค่า SDK',
    copy: 'Mode A ไม่มี OIDC clientId ส่วน Mode B เพิ่ม token provider จากระบบ login ของ Partner',
    code: (authChoice) => authChoice === 'a' ? `const videoConfig = {
  apiBaseUrl: import.meta.env.VITE_VIDEO_API_URL,
  publicKey: import.meta.env.VITE_VIDEO_PUBLIC_KEY,
}` : `const videoConfig = {
  apiBaseUrl: import.meta.env.VITE_VIDEO_API_URL,
  publicKey: import.meta.env.VITE_VIDEO_PUBLIC_KEY,
  getUserToken: () => partnerAuth.getAccessToken(),
}`,
  },
  record: {
    title: '2. บันทึกและรับ videoId',
    copy: 'React hook ดูแลกล้อง สถานะ upload และคืน videoId เมื่อ Video API ยืนยันสำเร็จ',
    code: (authChoice) => `const video = useRecorder({
  ...videoConfig,
  orderRef: order.reference,
  upload: {${authChoice === 'a' ? `
    externalUserRef: currentUser.id,` : ''}
    merchantId: order.merchantId,
  },
})

video.start()
await video.stop()

// รอ video.state === 'uploaded'
// แล้วอ่าน video.videoId`,
  },
  attach: {
    title: '3. ผูกกับออเดอร์ของ Partner',
    copy: 'SDK ไม่เขียนฐานข้อมูลออเดอร์ให้ Partner แอปต้องส่ง videoId ไป backend ของตนเองแบบ idempotent',
    code: () => `if (video.state === 'uploaded' && video.videoId) {
  await partnerApi.attachVideo(order.id, {
    videoId: video.videoId,
  })
}

// Partner backend บันทึก unique(orderId, videoId)
// และตอบสำเร็จเมื่อผูกซ้ำ`,
  },
  playback: {
    title: '4. เปิด Playback',
    copy: 'อ่าน videoId จากออเดอร์ ขอ URL ใหม่ผ่าน SDK และใส่ผลลัพธ์ใน video element',
    code: () => `const player = createPlayer(videoConfig)
const { url, expiresAt } = await player.resolvePlaybackUrl(
  order.videoId,
)

setPlaybackUrl(url)

return <video src={playbackUrl} controls playsInline />`,
  },
}

export function ImplementationGuide({ authChoice }: ImplementationGuideProps) {
  const [tab, setTab] = useState<GuideTab>('config')
  const current = snippets[tab]
  return (
    <section className="guide implementation-guide">
      <div className="section-title"><div><span>Implementation</span><h2>โค้ดที่ Partner ต้องเขียน</h2></div><strong className="status">Public API only</strong></div>
      <div className="code-tabs" role="tablist" aria-label="ขั้นตอน implementation">
        {(Object.keys(snippets) as GuideTab[]).map((key) => <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{snippets[key].title}</button>)}
      </div>
      <div className="code-explainer"><h3>{current.title}</h3><p>{current.copy}</p><pre><code>{current.code(authChoice)}</code></pre></div>
      <div className="contract-summary">
        <div><strong>ค่าที่ส่งเข้า SDK</strong><span>API URL, publishable key, auth token (Mode B), orderRef และ metadata ที่เลือกใช้</span></div>
        <div><strong>ค่าที่ SDK คืน</strong><span>สถานะ, progress, error code, videoId และ Playback URL</span></div>
        <div><strong>ค่าที่ Partner ต้องเก็บ</strong><span>ความสัมพันธ์ระหว่าง order/document กับ videoId</span></div>
      </div>
    </section>
  )
}
