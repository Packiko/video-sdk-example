# Packiko Video SDK Example

Partner-facing example for adding video evidence to an order flow. This repository documents
only the public SDK contract that a Partner application needs to call.

## Try it

```bash
pnpm install
pnpm dev
```

The first screen has two modes:

- **Camera demo:** record and play a local clip without a key or API request.
- **Test account:** record with a registered origin and publishable key, then receive a
  `videoId` to save against the Partner's own order or document.

## Configure a test account

Create `.env`:

```env
VITE_PACKIKO_API_BASE_URL=https://video-uat.packiko.com
VITE_PACKIKO_PUBLIC_KEY=pk_your_key
```

The page origin must be registered for that key. Restart the dev server after changing `.env`.

## React integration

```tsx
import { useRecorder } from '@packiko/video-sdk/react'

const video = useRecorder({
  apiBaseUrl: VIDEO_API_URL,
  publicKey: VIDEO_PUBLIC_KEY,
  orderRef: order.id,
})

video.start()
await video.stop()

if (video.state === 'uploaded' && video.videoId) {
  await partnerApi.saveVideoId(order.id, video.videoId)
}
```

Render `video.previewStream` in a muted `<video>` element and use `video.progress`,
`video.state`, and `video.error` for user feedback.

## Playback

```ts
import { createPlayer } from '@packiko/video-sdk'

const player = createPlayer({ apiBaseUrl: VIDEO_API_URL, publicKey: VIDEO_PUBLIC_KEY })
const { url } = await player.resolvePlaybackUrl(videoId)
```

Use the returned URL in a standard `<video controls>` element. Request a fresh URL from the
same `videoId` instead of storing the URL.

## Scope

- Partner owns its order/document data and stores the returned `videoId`.
- The SDK is consumed as a black box. Its implementation design is intentionally outside this
  public example.
- This example does not depend on other Packiko products.
- Production behavior must be verified with the Partner's registered origin and test key.

## Vanilla JavaScript

Open [`plain.html`](plain.html) for the equivalent CDN example. It exposes only the public
recording and playback calls needed by a non-React application.
