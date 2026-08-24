import { useEffect, useState } from 'react'
import { createPlayer, describeError, PackikoError } from '@packiko/video-sdk'

export interface PlaybackConfig {
  apiBaseUrl: string
  publicKey: string
  getUserToken?: () => Promise<string>
}

interface PlaybackLabProps {
  config: PlaybackConfig
  initialVideoId: string
  authLabel: string
  onOpenSetup: () => void
}

type PlaybackPhase = 'idle' | 'loading' | 'ready' | 'error'

function messageFor(error: unknown): string {
  if (error instanceof PackikoError) return `${error.code}: ${describeError(error.code, 'th')}`
  return error instanceof Error ? error.message : String(error)
}

export function PlaybackLab({ config, initialVideoId, authLabel, onOpenSetup }: PlaybackLabProps) {
  const [videoId, setVideoId] = useState(initialVideoId)
  const [playbackUrl, setPlaybackUrl] = useState('')
  const [phase, setPhase] = useState<PlaybackPhase>('idle')
  const [error, setError] = useState('')

  useEffect(() => {
    if (initialVideoId) setVideoId(initialVideoId)
  }, [initialVideoId])

  async function load(): Promise<void> {
    if (!videoId.trim() || !config.publicKey) return
    setPlaybackUrl('')
    setError('')
    setPhase('loading')
    try {
      const result = await createPlayer(config).resolvePlaybackUrl(videoId.trim())
      setPlaybackUrl(result.url)
      setPhase('ready')
    } catch (cause) {
      setError(messageFor(cause))
      setPhase('error')
    }
  }

  return (
    <section className="recorder-panel playback-lab">
      <div className="section-title">
        <div><span>Playback Lab</span><h2>ใส่ videoId แล้วเปิดวิดีโอจริง</h2></div>
        <strong className={`status status--${phase}`}>{phase === 'loading' ? 'กำลังเตรียมวิดีโอ' : phase === 'ready' ? 'พร้อมเล่น' : phase === 'error' ? 'เปิดไม่ได้' : 'รอ videoId'}</strong>
      </div>
      <div className="playback-config-summary">
        <span><b>Video API</b><code>{config.apiBaseUrl}</code></span>
        <span><b>Authorization</b><code>{authLabel} · {config.publicKey ? 'key พร้อม' : 'ยังไม่มี key'}</code></span>
        <button className="secondary" onClick={onOpenSetup}>ตั้งค่า Record & Upload</button>
      </div>
      <div className="playback-input-row">
        <label>Video ID<input value={videoId} onChange={(event) => setVideoId(event.target.value)} placeholder="ID จาก Record & Upload" /></label>
        <button className="primary" onClick={() => void load()} disabled={!videoId.trim() || !config.publicKey || phase === 'loading'}>เปิดวิดีโอ</button>
      </div>
      {!config.publicKey && <p className="error">Playback ใช้ Publishable key และ auth mode ชุดเดียวกับ Record & Upload กรุณาตั้งค่าก่อน</p>}
      <div className="video-stage">
        {playbackUrl ? <video src={playbackUrl} autoPlay controls playsInline aria-label="วิดีโอจาก Packiko Video" /> : <div className="video-placeholder"><strong>VDO Playback</strong><span>วิดีโอจะแสดงที่นี่หลัง Video API คืนลิงก์ที่พร้อมเล่น</span></div>}
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="flow-strip" aria-label="ลำดับการเปิดวิดีโอ">
        <span><b>1</b> Partner อ่าน videoId จากออเดอร์</span>
        <span><b>2</b> SDK ขอ Playback URL</span>
        <span><b>3</b> แสดง URL ใน video player</span>
      </div>
      <p className="note">เก็บเฉพาะ videoId ในฐานข้อมูล Partner ไม่ควรเก็บ Playback URL เพราะ URL มีอายุจำกัดและขอใหม่ได้จาก videoId เดิม</p>
    </section>
  )
}
