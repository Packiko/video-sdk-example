# Packiko Video SDK Example

Partner-facing **Vanilla JavaScript** example for adding video evidence to an order flow. This
repository documents only the public SDK contract that a Partner application needs to call.

## Try it

```bash
pnpm install
pnpm dev
```

Open the URL printed by Vite. The root route redirects to `/plain.html`, which is the Partner
implementation target. Do not open the file directly with `file://`; that produces the `null`
origin and cannot pass the Video API allowlist.

The application has four visible workspaces:

- **Camera demo:** record and play a local clip without a key or API request.
- **Record & Upload:** enter test configuration in the page, record, upload, and receive a
  `videoId`.
- **Playback:** paste any `videoId` or use the ID returned by Record & Upload, then play it.
- **Implementation:** read the complete public-API path for config, record, Partner attach,
  and playback.

The Partner example is implemented in [`plain.html`](plain.html) with browser JavaScript and
the SDK's public CDN build. It does not require React.

Every workspace shares an **Activity Log**. It records public lifecycle events, SDK error
codes, the current page origin, and the selected API environment. It intentionally never logs
publishable keys, user tokens, upload URLs, or signed playback URLs. Use **Copy log** when
sending a reproducible failure to support.

## Configure a test account

Open **Record & Upload** and enter the Video API URL, publishable key, order reference, and
optional Partner values directly in the page. The page origin must be registered for that key.

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

Mode B lets the Partner try its normal OIDC login. Enter the Mode B publishable key, IdP URL,
realm, and public browser client ID in **Record & Upload**.

The client ID is not a secret. The Video test key must be provisioned for the same issuer/JWKS,
and the Example origin must be accepted by both the IdP client and the Video key.

## Vanilla JavaScript integration

Load the public browser build and use only its exported API:

```html
<script src="https://sdk-uat.packiko.com/video/v0.3.0/index.global.js"></script>
<script>
  const { createPlayer, createRecorder } = PackikoVideo
  const config = { apiBaseUrl, publicKey }

  async function recordEvidence() {
    const recorder = createRecorder(config)
    const capture = await recorder.capture()
    preview.srcObject = capture.previewStream
    capture.start()

    // Call this part from the Partner's Stop button.
    const blob = await capture.stop()
    capture.dispose()

    const { videoId } = await recorder.upload(blob, {
      orderRef,
      externalUserRef,
      merchantId,
    }).promise
    return videoId
  }
</script>
```

For Mode B, add the Partner's existing token provider:

```js
const config = {
  apiBaseUrl,
  publicKey,
  getUserToken: () => partnerAuth.getAccessToken(),
}
```

## Partner attach

The SDK returns `videoId`; it does not write the Partner's order database:

```js
await partnerApi.attachVideo(orderRef, { videoId })
```

Make this backend operation idempotent, for example with a unique `(orderId, videoId)` key.

## Playback

```js
const player = createPlayer(config)
const { url } = await player.resolvePlaybackUrl(videoId)
video.src = url
video.controls = true
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

## Authentication in the Vanilla workspace

The Partner workspace supports both authentication paths interactively:

- **Mode A** accepts a publishable key and optional `externalUserRef`. It has no OIDC client ID.
- **Mode B** accepts a Mode B publishable key plus public OIDC URL, realm, and client ID. It
  loads the public Keycloak browser client, performs a PKCE redirect, and supplies the SDK with
  `getUserToken()` for record/upload and playback.

The OIDC client must allow the exact `/plain.html` redirect URI and page origin. No client secret
belongs in this browser example. The page stores only public form values in `sessionStorage` and
the Activity Log never prints the publishable key, access token, upload URL, or signed playback URL.

## Internal React reference

`/react.html` is retained for Packiko's internal comparison and SDK regression work. It is not
the Partner implementation target and is not required for a Vanilla JavaScript integration.
