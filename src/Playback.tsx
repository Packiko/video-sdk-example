import { useState } from 'react'
import { createPlayer, PackikoError, type PlayerStateEvent } from '@packiko/video-sdk'
import { sdkConfig } from './sdk'

type Phase = 'idle' | 'resolving' | PlayerStateEvent

export default function Playback() {
  const [videoId, setVideoId] = useState('')
  const [url, setUrl] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState('')

  async function load() {
    if (!videoId) return
    setError(''); setUrl(''); setPhase('resolving')
    const player = createPlayer(sdkConfig)
    const off = player.on('state', setPhase) // uploading | uploaded | processing | ready | error
    try {
      // Polls GET /v1/videos/:id until ready, then mints a signed read URL.
      const result = await player.resolvePlaybackUrl(videoId)
      setUrl(result.url)
    } catch (e) {
      setError(e instanceof PackikoError ? `${e.code}: ${e.message}` : String(e))
      setPhase('error')
    } finally {
      off()
    }
  }

  return (
    <section>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input value={videoId} onChange={(e) => setVideoId(e.target.value)}
          placeholder="videoId" style={{ flex: 1 }} />
        <button onClick={load} disabled={phase === 'resolving'}>Load</button>
      </div>

      <p>state: <b>{phase}</b></p>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      {url && (
        <video src={url} controls playsInline
          style={{ width: '100%', background: '#000', borderRadius: 8 }} />
      )}
    </section>
  )
}
