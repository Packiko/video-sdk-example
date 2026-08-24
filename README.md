# Packiko Video SDK Example

Demo integrating the Packiko video proof SDK end-to-end: **record → durable local queue → upload → partner attach → playback**.
Two integration paths from one repo:

- **Path A — React (npm):** `@packiko/video-sdk` via GitHub Packages, bundled with Vite. The production path is `src/ProductionRecorder.tsx` + `src/queue.ts`.
- **Path B — vanilla (`<script>` CDN):** zero-build, `window.PackikoVideo` from R2. See `plain.html`.

## Start here: Recorder Lab

Run the React app and open **Recorder Lab**, the default first screen:

```bash
pnpm dev
```

Choose one of two explicit modes:

- **Demo on this device** needs no publishable key and makes no API request. Open the camera,
  record a short clip, stop, play the finalized WebM immediately, and optionally download it.
  This proves only the browser camera/record/playback lifecycle.
- **Connect real UAT** checks camera support, secure context, API URL, publishable key, and the
  origin-registration requirement before showing the durable queue workflow. This mode proves
  upload and Partner attach only when a registered origin and valid Partner key are configured.

The first screen therefore works after installation even before ThaiCloud provisions access,
while keeping local demonstration and real integration results visibly separate.

Both paths are **interactive walkthroughs** (built from real partner feedback — the raw
examples were hard to follow):

- The React app opens in **Recorder Lab**. The secondary **Integration guide** is a 6-step wizard (setup → record+durable enqueue →
  recovery queue → deferred attach → playback → failure lab), each step showing the exact
  code, a plain-Thai explanation, and a live widget. **Advanced tools**
  is free-play: the demos beside a live **event log** narrating every SDK call and state
  change with hints.
- `plain.html` is the same walkthrough in vanilla JS: numbered accordion steps with code +
  live widgets + the event log at the bottom.

## Production recommended path

Create one queue for the whole application. Stop the recorder, wait for the finalized Blob,
and wait for `enqueue()` to persist it locally **before** telling the operator that it is safe
to leave the screen. Upload and partner-side attachment continue in the background.

```ts
import { createRecorder, createUploadQueue } from '@packiko/video-sdk'

const queue = createUploadQueue(config, {
  getOwnerId: () => auth.currentUserId(),
  releaseWhen: (job) => partnerApi.documentExists(job.context.orderRef),
  attach: (job) => partnerApi.attachVideo(job.context.orderRef, job.videoId),
})

const recorder = createRecorder(config)
const capture = await recorder.capture()
const context = { orderRef: partnerOrder.ref } // freeze before recording
capture.start()

const blob = await capture.stop()
await queue.enqueue({ blob, context, orderRef: context.orderRef })
capture.dispose() // durable now; network may finish later
```

The Video SDK/API never calls Packiko Core or Ultra. `context`, `releaseWhen`, and `attach`
belong to the Partner; the SDK stores the opaque context and returns `videoId` to the Partner's
callback.

## Prerequisites

### Origin registration
Your page origin must be registered by ThaiCloud before integrating. Contact ThaiCloud with the
origin you'll use (e.g. `http://localhost:5173` for local dev) to have it allowlisted.

### Publishable key
A `pk_...` key from your ThaiCloud tenant — publishable (safe in a browser bundle).

### Auth modes — Mode A vs Mode B (optional)
One question decides the mode: **does your login system use an OIDC IdP that publishes JWKS**
(Keycloak, Auth0, Entra ID, …)?

- **No / in-house auth** → **Mode A**: the `pk_` alone; direct upload can carry your attested
  `externalUserRef`. The durable queue demo uses the same identity as a local owner guard, but
  SDK 0.3 does not yet forward it to the Video API (tracked in `Packiko/video#155`). This is what
  the demo runs by default. (Symmetric tokens — e.g. HS256 —
  cannot be verified by the video service, so in-house token systems land here too.)
- **Yes** → **Mode B**: add one config line — `getUserToken: () => yourAuth.getAccessToken()` —
  and the SDK sends the JWT as `X-User-Token` on every request. The video service verifies
  signature/issuer/expiry against your JWKS and binds each video to the verified `sub`.
  ThaiCloud enables it per key with two values (your issuer + JWKS URL); no deploy. A Mode B key
  is enforce-or-reject: a missing or bad token is always a 401, never a silent Mode A fallback.

The app's **🔐 Auth tab** walks this choice interactively, with a live Keycloak login on the
Mode B path (ThaiCloud UAT defaults are baked in; override with the `VITE_PACKIKO_MODE_B_*`
env vars in `.env.example` to point at your own IdP). In the vanilla path the choice IS
**`plain.html` step 1** — pick Mode A or Mode B first (no default), and the rest of the page
follows: the matching config panel, a live Keycloak login on the Mode B side (keycloak-js via
ESM CDN import, editable IdP fields), and the automatic key + `X-User-Token` switch for
steps 2-4.

---

## Path A — React (npm)

> **Note:** installing `@packiko/video-sdk` requires Packiko org access (a `read:packages` token).
> Anyone can read this repo as a reference, but `pnpm install` will 401 without that access.
> No org access? Use **Path B** (vanilla) — it loads from the CDN with no install.

1. **`.npmrc`** (already in repo) points the scope at GitHub Packages and reads a token from env:
   ```
   @packiko:registry=https://npm.pkg.github.com
   //npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
   ```
2. **GitHub token** with scope `read:packages` and access to the `Packiko` org:
   ```bash
   gh auth refresh -s read:packages     # or create a PAT with read:packages
   ```
3. **Export the token** so `.npmrc` picks it up:
   ```bash
   # bash
   export NODE_AUTH_TOKEN=$(gh auth token)
   ```
   ```powershell
   # PowerShell
   $env:NODE_AUTH_TOKEN = (gh auth token)
   ```
4. **Install:**
   ```bash
   pnpm install
   ```
5. **Configure env** — copy `.env.example` to `.env` (gitignored):
   ```
   VITE_PACKIKO_API_BASE_URL=https://video-uat.packiko.com   # no /v1 — the SDK appends it
   VITE_PACKIKO_PUBLIC_KEY=pk_your_uat_test_key
   ```
6. **Run:**
   ```bash
   pnpm dev      # http://localhost:5173 — port must match the registered origin
   ```

### Usage (from `src/ProductionRecorder.tsx` / `src/queue.ts`)
```ts
const capture = await createRecorder(config).capture()
video.srcObject = capture.previewStream
capture.start()
const blob = await capture.stop()
await queue.enqueue({ blob, context: { orderRef }, orderRef })
capture.dispose()

// Playback — core entry:
import { createPlayer } from '@packiko/video-sdk'

const { url } = await createPlayer({ apiBaseUrl, publicKey }).resolvePlaybackUrl(id)
// resolvePlaybackUrl polls until ready, returns { url, expiresAt } — destructure .url
```

`useRecorder` in `src/Record.tsx` remains as a **minimal direct-upload demo**. It is useful
for learning the recorder API, but it does not persist the Blob in the durable queue before
network upload and is not the recommended production path.

---

## Path B — vanilla (`<script>` CDN, zero-build)

1. Load the IIFE bundle (no install, no bundler):
   ```html
   <script src="https://sdk-uat.packiko.com/video/v0.3.0/index.global.js"></script>
   ```
2. It exposes `window.PackikoVideo` → `createRecorder`, `createPlayer`, `PackikoError`.
   This is the **core** build — there's **no `useRecorder` hook** (that ships only in the
   `/react` npm subpath).
3. Serve over **http** (origin must be registered) — `file://` has no origin and will fail.
   The repo's `plain.html` is served by the same Vite server: `pnpm dev` → `http://localhost:5173/plain.html`.

### Usage (from `plain.html`)
```js
const { createRecorder, createUploadQueue, createPlayer, PackikoError } = PackikoVideo

// Record:
const rec = createRecorder({ apiBaseUrl, publicKey })
const cap = await rec.capture()              // acquires camera+mic
video.srcObject = cap.previewStream
cap.start()
const blob = await cap.stop()                // finalized Blob
await queue.enqueue({ blob, context: { orderRef }, orderRef })
cap.dispose()                                // release camera/mic

// Playback:
const { url } = await createPlayer({ apiBaseUrl, publicKey }).resolvePlaybackUrl(id)
```

> Upgrading the SDK = bump the version in the script path (`v0.3.0` → `v0.3.1`).

---

## Durable queue + Background Sync

`@packiko/video-sdk@0.3.0` adds `createUploadQueue` — clips survive refresh,
crash, and offline periods, and bind to your document later (deferred attach).
The **Production record** and **Recovery queue** tabs demo the full loop with a simulated
Partner backend (`src/ProductionRecorder.tsx`, `src/queue.ts`, `src/QueueDemo.tsx`):

1. Record from the camera and stop — the finalized Blob is persisted before any network result.
2. The job uploads without a Partner document and parks at `releaseWhen`.
3. Click **Create document (nudge)** — `queue.nudge()` re-checks the gate and
   the clip binds in that same cycle.
4. Try: refresh after durable enqueue (resumes without re-uploading), go offline (retries
   when back), kill the tab and reopen (jobs recover on load).

[`public/sw.js`](public/sw.js) is the SDK README's Background Sync recipe
verbatim — Chromium wakes it when connectivity returns and it messages open
pages to `queue.drain()`. Safari/Firefox skip this silently; foreground
triggers still do everything.

Background Sync does not upload a Blob by itself when every page is closed; this recipe asks
open clients to drain. A closed app resumes when it opens again.

## Compatibility in SDK 0.3.0

| Capability | Direct `useRecorder` / `upload()` | Durable queue |
|---|---:|---:|
| `orderRef` | Yes | Yes |
| Mode B rotating user token | Yes | Yes |
| Offline/refresh recovery after enqueue | No | Yes |
| `externalUserRef` (Mode A) | Yes | Not yet |
| `merchantId` | Yes | Not yet |
| `items` product snapshot | Yes | Not yet |

The metadata parity gap is tracked in `Packiko/video#155`. Until it lands, choose the durable
path for standard/Mode B integrations; do not silently migrate a direct-upload integration
that depends on the three optional metadata fields.

## Guarantee boundary

| Event | Guarantee |
|---|---|
| Network/server failure after `enqueue()` resolves | Durable job retries |
| Refresh or tab close after `enqueue()` resolves | Job recovers on next app load |
| Partner document not ready | Job parks until `nudge()`/retry |
| Route unmount while JavaScript can still finalize | Host must stop and enqueue; the React example demonstrates this |
| Browser/process crash or power loss during REC | Not guaranteed; tracked in `Packiko/video#156` |
| Storage quota/write failure | `enqueue()` rejects; keep the in-memory Blob downloadable |

## Go-live checklist

- Pin an explicit SDK version and register every production/staging origin.
- Create one app-wide queue; do not create a new queue per screen or order.
- Freeze Partner order/user context when recording starts.
- Wait for `enqueue()` before showing “safe to leave”.
- Implement `attach` idempotently and call `nudge()` when the Partner document becomes ready.
- Configure `getOwnerId` and render `retry`/`review` states with Retry and Download actions.
- Resolve auth tokens fresh per request; never persist signed playback URLs or secrets.
- Test offline-before-stop, refresh-after-enqueue, server 5xx, token expiry, storage-full,
  user switch, delayed document creation, and playback processing/unavailable states.
- Define local evidence retention/privacy policy and support escalation for jobs in `review`.

## Flow

```
capture (getUserMedia / MediaRecorder)
  → upload (3-step: token → blob PUT → confirm)
  → server processing (transcode → ready)
  → playback (poll until ready → signed playback URL)
```

## Error handling

Every SDK error is a `PackikoError` — branch on `.code` (stable), not `.message`:

| code | when |
|---|---|
| `permission_denied` | camera/mic blocked |
| `device_not_found` | no matching camera/mic |
| `device_in_use` | device held by another app |
| `no_supported_format` | no MediaRecorder MIME the browser supports |
| `capture_failed` | capture aborted / MediaRecorder fault |
| `sas_expired` | upload URL expired (403 on PUT) — `restart()` |
| `upload_failed` | blob PUT exhausted retries |
| `merchant_id_invalid` | `merchantId` fails `^[A-Za-z0-9_-]{1,128}$` (checked client-side before any request; also a server code) |
| `items_invalid` | an `items` entry fails validation — missing/bad field, unknown key, or out-of-range value (checked client-side before any byte uploads; also a server code) |
| `duplicate_item_sku` | two `items` entries share a `sku` after trimming (checked client-side before any byte uploads; also a server code) |
| `rate_limited` | 429 from the API. During playback polling (`resolvePlaybackUrl`) the SDK backs off and retries automatically — a persistent rate limit there surfaces as `timeout`, not this code. Upload token/confirm 429s surface directly (no auto-retry) |
| `network_error` | network request failed (no response / unreadable error body) |
| `origin_not_allowed` | your origin isn't registered with ThaiCloud |
| `video_not_found` | unknown videoId |
| `video_terminal` | video reached `failed`/`orphaned`/`attached` — won't become playable |
| `timeout` | still not ready after `maxWaitMs` |

```js
try { await player.resolvePlaybackUrl(id) }
catch (e) {
  if (e instanceof PackikoError) { /* switch (e.code) */ }
}
```

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Upload/playback fails with an origin error (`origin_not_allowed` / `network_error`) | Contact ThaiCloud to confirm your origin is registered. |
| `useRecorder` not found | Import from `@packiko/video-sdk/react`, not the core `@packiko/video-sdk`. |
