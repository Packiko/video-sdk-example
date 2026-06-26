# Packiko Video SDK Example

Demo integrating the Packiko video proof SDK end-to-end: **record → upload → process → playback**.
Two integration paths from one repo:

- **Path A — React (npm):** `@packiko/video-sdk` via GitHub Packages, bundled with Vite. See `src/Record.tsx`, `src/Playback.tsx`.
- **Path B — vanilla (`<script>` CDN):** zero-build, `window.PackikoVideo` from R2. See `plain.html`.

## Prerequisites

### Origin registration
Your page origin must be registered by ThaiCloud before integrating. Contact ThaiCloud with the
origin you'll use (e.g. `http://localhost:5173` for local dev) to have it allowlisted.

### Publishable key
A `pk_...` key from your ThaiCloud tenant — publishable (safe in a browser bundle).

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

### Usage (from `src/Record.tsx` / `src/Playback.tsx`)
```ts
// Record — the hook lives in the /react subpath, NOT the core entry:
import { useRecorder } from '@packiko/video-sdk/react'

const { previewStream, state, progress, videoId, error, start, stop } =
  useRecorder({ apiBaseUrl, publicKey, orderRef })   // orderRef is required
// bind previewStream -> <video>.srcObject; start()/stop(); videoId set when state === 'uploaded'

// Playback — core entry:
import { createPlayer } from '@packiko/video-sdk'

const { url } = await createPlayer({ apiBaseUrl, publicKey }).resolvePlaybackUrl(id)
// resolvePlaybackUrl polls until ready, returns { url, expiresAt } — destructure .url
```

---

## Path B — vanilla (`<script>` CDN, zero-build)

1. Load the IIFE bundle (no install, no bundler):
   ```html
   <script src="https://sdk-uat.packiko.com/video/v0.1.1/index.global.js"></script>
   ```
2. It exposes `window.PackikoVideo` → `createRecorder`, `createPlayer`, `PackikoError`.
   This is the **core** build — there's **no `useRecorder` hook** (that ships only in the
   `/react` npm subpath).
3. Serve over **http** (origin must be registered) — `file://` has no origin and will fail.
   The repo's `plain.html` is served by the same Vite server: `pnpm dev` → `http://localhost:5173/plain.html`.

### Usage (from `plain.html`)
```js
const { createRecorder, createPlayer, PackikoError } = PackikoVideo

// Record:
const rec = createRecorder({ apiBaseUrl, publicKey })
const cap = await rec.capture()              // acquires camera+mic
video.srcObject = cap.previewStream
cap.start()
const blob = await cap.stop()                // finalized Blob
const up = rec.upload(blob, { orderRef })
up.on('progress', (p) => { /* p.ratio 0..1 */ })
const { videoId } = await up.promise         // resolves on 'uploaded'
cap.dispose()                                // release camera/mic

// Playback:
const { url } = await createPlayer({ apiBaseUrl, publicKey }).resolvePlaybackUrl(id)
```

> Upgrading the SDK = bump the version in the script path (`v0.1.1` → `v0.1.2`).

---

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
