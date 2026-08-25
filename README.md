# Packiko Video SDK Example

Partner-facing example for adding video evidence to an order flow. This repository documents
only the public SDK contract that a Partner application needs to call.

## Try it

```bash
pnpm install
pnpm dev
```

The application has four visible workspaces:

- **Camera demo:** record and play a local clip without a key or API request.
- **Record & Upload:** enter test configuration in the page, record, upload, and receive a
  `videoId`.
- **Playback:** paste any `videoId` or use the ID returned by Record & Upload, then play it.
- **Implementation:** read the complete public-API path for config, record, Partner attach,
  and playback.

The React source for those flows is deliberately small and directly reusable:

- [`src/RecorderLab.tsx`](src/RecorderLab.tsx) — Mode A/Mode B setup and record/upload.
- [`src/PlaybackLab.tsx`](src/PlaybackLab.tsx) — standalone playback by `videoId`.
- [`src/ImplementationGuide.tsx`](src/ImplementationGuide.tsx) — copyable integration path.

Every workspace shares an **Activity Log**. It records public lifecycle events, SDK error
codes, the current page origin, and the selected API environment. It intentionally never logs
publishable keys, user tokens, upload URLs, or signed playback URLs. Use **Copy log** when
sending a reproducible failure to support.

## Configure a test account

Create `.env`:

```env
VITE_PACKIKO_API_BASE_URL=https://video-uat.packiko.com
VITE_PACKIKO_PUBLIC_KEY=pk_your_key
```

The page origin must be registered for that key. Values from `.env` prefill the page, but a
publishable test key can also be entered directly in **Record & Upload**.

Origin matching is exact: `http://127.0.0.1:5401` and `http://localhost:5401` are different
origins. A `network_error` or `origin_not_allowed` entry includes the current origin so it can
be compared with the allowlist.

### Mode A does not use an OIDC Client ID

Mode A uses these values:

| Value | Purpose |
|---|---|
| `apiBaseUrl` | Video API environment |
| `publicKey` | Identifies the Partner's Video account and registered origin |
| `orderRef` | Partner order/document reference stored with the video |
| `externalUserRef` | Optional Partner user/operator ID, attested by the Partner |
| `merchantId` | Optional merchant identifier |

There is no `clientId` field in the Mode A SDK contract. If the Partner calls its internal
operator identifier a "client ID", map it to `externalUserRef` only when it identifies the
current user. An OIDC `clientId` belongs to Mode B.

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
  upload: {
    externalUserRef: currentUser.id, // Mode A only
    merchantId: order.merchantId,    // optional
  },
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

## Partner attach

The SDK returns `videoId`; it does not write the Partner's order database:

```ts
if (video.state === 'uploaded' && video.videoId) {
  await partnerApi.attachVideo(order.id, { videoId: video.videoId })
}
```

Make this backend operation idempotent, for example with a unique `(orderId, videoId)` key.

## Playback

```ts
import { createPlayer } from '@packiko/video-sdk'

const player = createPlayer({ apiBaseUrl: VIDEO_API_URL, publicKey: VIDEO_PUBLIC_KEY })
const { url } = await player.resolvePlaybackUrl(videoId)

return <video src={url} controls playsInline />
```

Use the returned URL in a standard `<video controls>` element. Request a fresh URL from the
same `videoId` instead of storing the URL. The **Playback** workspace is a live version of this
code and accepts a manually pasted ID, so recording a new clip is not required for every test.

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
or device failure during active recording. Those capabilities require later SDK work and are
not represented as current behavior in this Example.

## Vanilla JavaScript

Open [`plain.html`](plain.html) for the equivalent CDN example. It exposes only the public
recording and playback calls needed by a non-React application. Serve it through the same
Vite origin (`pnpm dev` → `/plain.html`); do not open it as `file://`, because that produces
the `null` origin and cannot pass the Video API allowlist. The Vanilla page uses the same four
workspace tabs and terminology as the React page, while its implementation remains framework-free.

The Vanilla workspace supports both authentication paths interactively:

- **Mode A** accepts a publishable key and optional `externalUserRef`. It has no OIDC client ID.
- **Mode B** accepts a Mode B publishable key plus public OIDC URL, realm, and client ID. It
  loads the public Keycloak browser client, performs a PKCE redirect, and supplies the SDK with
  `getUserToken()` for record/upload and playback.

The OIDC client must allow the exact `/plain.html` redirect URI and page origin. No client secret
belongs in this browser example. The page stores only public form values in `sessionStorage` and
the Activity Log never prints the publishable key, access token, upload URL, or signed playback URL.
