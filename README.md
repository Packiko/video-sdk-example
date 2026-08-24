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
- **Guided integration:** choose authentication, record with a test account, receive a
  `videoId`, simulate attaching it to an order, and try playback.

## Configure a test account

Create `.env`:

```env
VITE_PACKIKO_API_BASE_URL=https://video-uat.packiko.com
VITE_PACKIKO_PUBLIC_KEY=pk_your_key
```

The page origin must be registered for that key. Restart the dev server after changing `.env`.

### Optional Mode B (OIDC)

Mode B lets the Partner try its normal OIDC login. Configure public browser-client values only:

```env
VITE_PACKIKO_MODE_B_PUBLIC_KEY=pk_your_mode_b_key
VITE_PACKIKO_KEYCLOAK_URL=https://login.example.com
VITE_PACKIKO_KEYCLOAK_REALM=your-realm
VITE_PACKIKO_KEYCLOAK_CLIENT_ID=your-public-client-id
```

The client ID is not a secret. The Video test key must be provisioned for the same issuer/JWKS,
and the Example origin must be accepted by both the IdP client and the Video key.

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

For Mode B, add the Partner's existing token provider:

```ts
getUserToken: () => auth.getAccessToken()
```

## Playback

```ts
import { createPlayer } from '@packiko/video-sdk'

const player = createPlayer({ apiBaseUrl: VIDEO_API_URL, publicKey: VIDEO_PUBLIC_KEY })
const { url } = await player.resolvePlaybackUrl(videoId)
```

Use the returned URL in a standard `<video controls>` element. Request a fresh URL from the
same `videoId` instead of storing the URL.

## Scope

- The SDK handles camera capture, evidence submission, user-facing status, `videoId`, and
  playback preparation.
- Partner owns its order/document data and stores the returned `videoId`.
- The SDK does not write to the Partner database. The Partner calls its own backend after a
  successful `videoId` result.
- The SDK is consumed as a black box. Its implementation design is intentionally outside this
  public example.
- This example does not depend on other Packiko products.
- Production behavior must be verified with the Partner's registered origin and test key.

## Guarantee status

Available in the current SDK for the active-page flow:

- record evidence
- receive `videoId`
- open playback

Do not yet promise seamless continuation after route exit/offline, or recovery from a browser
or device failure during active recording. Those capabilities require later SDK work; the
Guided Sandbox labels them as planned rather than presenting them as current behavior.

## Vanilla JavaScript

Open [`plain.html`](plain.html) for the equivalent CDN example. It exposes only the public
recording and playback calls needed by a non-React application.
