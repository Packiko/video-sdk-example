# Changelog

Notable changes to this example. Format based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) with the Packiko section convention: `### Added`, `### Changed`, `### Documentation`, `### Fixed`, `### Deferred`.

This repo has no version of its own (`package.json` is a private `0.0.0`) — entries are dated and reference the SDK version they track.

## 2026-08-24 — plain.html UX hardening from PO field-testing (SDK 0.3.0)

### Fixed

- **Stop-recording dead-end**: stop used to be gated behind the pk check, so recording
  started without a key could never be stopped. Stop now always works and never touches the
  network; the blob is held on the page and **upload is its own button** — a failed upload
  (wrong origin, missing key) is retryable without re-recording, and the step no longer
  bricks after one failure.
- **Camera could not be turned off**: added a "ปิดกล้อง" button, and collapsing step 2 now
  disposes the capture (previously only `pagehide` did).
- **Playback of fresh clips no longer errors**: step 3 switched from `createPlayer` (throws
  `timeout` while a clip is still transcoding) to `createPlaybackResolver` — `processing` is
  shown as a normal state with a retry button, reserving errors for real failures.

### Changed

- **"ก่อนเริ่ม" prerequisites card**: origin registration (the #1 first-run trap — a pk only
  works from its registered origins), publishable key, camera permission — stated on the page
  instead of only in the README.
- **Mode A identity**: step 1 gained an optional `externalUserRef` field, wired into the
  step-2 upload (suppressed while Mode B is active — the token carries identity there).
- **Human errors**: all error surfaces now route through `describeError(code, 'th')` with the
  raw code in parentheses.
- **Step status chips** on every summary + a visual pass (readable cards, labeled inputs,
  focus states) — still one self-contained vanilla file, no build step.

## 2026-08-24 — Mode B in the vanilla path (SDK 0.3.0)

### Added

- **`plain.html` step 5 — Mode B (optional)**: the OIDC-or-not decision framing, a vanilla
  `getUserToken` code sample, and a live Keycloak login (keycloak-js via jsdelivr `+esm`,
  PKCE S256). IdP fields are editable (ThaiCloud UAT defaults prefilled; sessionStorage keeps
  edits across the login redirect); after login, `cfg()` switches steps 2-4 to the Mode B key +
  `X-User-Token` automatically. Generic for any OIDC+JWKS partner on the vanilla path — HS256
  token systems stay Mode A + `external_user_ref` (step 5 says so explicitly).

## 2026-08-24 — interactive auth-mode chooser + optional Mode B login (SDK 0.3.0)

### Added

- **🔐 Auth tab** (`src/AuthModes.tsx`): interactive chooser — "does your IdP speak OIDC + JWKS?"
  routes to a Mode A panel (pk + `external_user_ref` attestation, HS256 limitation) or a Mode B
  panel (4-step token flow, one-line SDK config, live Keycloak login).
- **Optional Mode B login** (`src/auth.ts`, keycloak-js + PKCE): redirect login against ThaiCloud
  UAT Keycloak (realm `common`, baked-in defaults; `VITE_PACKIKO_MODE_B_*` env overrides for your
  own IdP). While logged in, `sdkConfig` switches every request to the Mode B key +
  `X-User-Token` via getters — no consumer changes. Mode A behavior is byte-identical when not
  logged in; the login UI is hidden until the Mode B key is provisioned.

### Changed (same day, after provisioning)

- `DEFAULT_MODE_B_PUBLIC_KEY` filled with the provisioned UAT key and the Keycloak client id
  default corrected to ThaiCloud's UUID convention — the Mode B login demo is now live from a
  clean clone. (Committing the pk is deliberate: a Mode B key is enforce-or-reject, inert
  without a live realm-`common` JWT.)

### Deferred

- `plain.html` stays Mode A only.

## 2026-08-24 — CDN v0.3.0 verified

### Changed

- The `v0.3.0` CDN artifact referenced by `plain.html`/README is live and verified at `https://sdk-uat.packiko.com/video/v0.3.0/index.global.js` (HTTP 200, all SDK v2 symbols present, sha256 byte-identical to the build from the `sdk-v0.3.0` tag).
  - **Action if you forked this example:** the CDN version is pinned, not `latest` — bump the `<script src>` path to `v0.3.0` yourself.

## 2026-08-23 — interactive walkthroughs, both paths (SDK 0.3.0)

### Added

- **📖 Learn mode** (React): 6-step guided wizard — setup, record+upload, playback, durable enqueue, deferred attach, resilience — each step shows the exact code, a plain-Thai explanation, and a live widget running it for real. Built from ZORTOUT developer feedback that the raw examples were hard to follow.
- **🎮 Playground mode** (React): the existing Record/Playback/Queue demos beside a live event log narrating every SDK call/state change with hints (`src/eventLog.ts`, `src/EventLogPanel.tsx`).
- Queue demo tab + Background Sync service worker (`public/sw.js` — the SDK README recipe verbatim) with a simulated partner backend (`src/queue.ts`: in-memory document store, idempotent attach).

### Changed

- `plain.html` reworked into the same interactive walkthrough in vanilla JS: numbered accordion steps (config → record+upload → playback → queue + deferred attach) with code snippets, live widgets, and the event log; CDN script bumped to `v0.3.0` (`createUploadQueue` now available on `window.PackikoVideo`).
- `@packiko/video-sdk` dependency bumped to `^0.3.0`.

## 2026-07-23 — vanilla items panel as raw JSON (PR #9)

### Changed

- `plain.html` items panel now shows the `DEMO_ITEMS` payload as raw JSON (`JSON.stringify`, heading "Items ที่จะแนบไปกับ upload (payload จริง)") instead of a formatted list — the vanilla page targets developers, so the exact wire shape (snake_case keys, value types, optional fields simply absent) is more useful. Still rendered from the array itself — edit the array, the panel follows.

## 2026-07-22 — vanilla items panel (PR #8)

### Added

- `plain.html` renders the `DEMO_ITEMS` set in a small panel above the Start button ("Items ที่จะแนบไปกับวิดีโอนี้") so the demo shows what Start will attach. Rendered from the `DEMO_ITEMS` array itself — edit the array, the panel follows. No items input UI (still out of scope).

## 2026-07-22 — vanilla items demo (PR #7)

### Added

- Demo `items` payload in the vanilla upload options (`plain.html`) — same hardcoded two-item set as `src/Record.tsx` (one required-only, one with the optional `weight_g`), bringing both integration paths to parity for SDK 0.2.0. Validation failures (`items_invalid` / `duplicate_item_sku`) surface through the existing error rendering.

## 2026-07-22 — CDN v0.2.0 (follow-up to PR #5)

### Changed

- Bumped the vanilla CDN script path `v0.1.2` → `v0.2.0` (`plain.html` + README Path B), resolving the Deferred item below. The `v0.2.0` artifact was human-verified at `https://sdk-uat.packiko.com/video/v0.2.0/index.global.js` (loads, contains the 0.2.0 items validation).
  - **Action if you forked this example:** the CDN version is pinned, not `latest` — bump the `<script src>` path to `v0.2.0` yourself.

## 2026-07-22 — SDK 0.2.0 (PR #5)

### Changed

- Bumped `@packiko/video-sdk` `0.1.2` → `0.2.0` (npm, `package.json` + lockfile). 0.2.0 adds optional `items?: VideoItem[]` to `UploadOptions` with client-side pre-validation mirroring the server (Packiko/video#118, ADR 0013).

### Added

- Demo `items` payload in the React upload options (`src/Record.tsx`) — snake_case wire shape, one required-only item (`sku`/`name`/`qty`) and one with the optional `weight_g`. Validated client-side before any byte uploads; failures surface as `items_invalid` / `duplicate_item_sku` through the existing error rendering.

### Documentation

- README: `items` in the Path A usage snippet and new error-table rows `items_invalid` / `duplicate_item_sku`.

### Deferred

- Vanilla CDN path in `plain.html`/README stayed at `v0.1.2` — bumping it needed a verified `v0.2.0` CDN artifact. Done in the CDN v0.2.0 entry above.

## 2026-07-05 — SDK 0.1.2 (#2, #3, PR #4)

### Changed

- Bumped `@packiko/video-sdk` `0.1.1` → `0.1.2` (npm, `package.json` + lockfile) and the vanilla CDN path to `v0.1.2` in `plain.html`. 0.1.2 brings 429 backoff in playback polling (Packiko/video#113) and optional `merchantId` upload support (Packiko/video#114).
  - **Action if you forked this example:** the CDN version is pinned, not `latest` — bump the `<script src>` path to `v0.1.2` yourself.

### Added

- Optional `merchant_id` demo input in both demos (React `src/Record.tsx`, vanilla `plain.html`) — partner/ZORT use case. Filled = sent as the new `merchantId` field in upload options; empty = omitted entirely (non-ZORT upload). The SDK validates it client-side (`^[A-Za-z0-9_-]{1,128}$`); a bad value surfaces as `merchant_id_invalid` through the existing error rendering.
  - **Action if you build on the upload flow:** `merchantId` is a new optional `UploadOptions` field in 0.1.2 — pass it only for ZORT-linked uploads.

### Documentation

- README: v0.1.2 script path + upgrade note, `merchantId` in both usage snippets, and new error-table rows `merchant_id_invalid` and `rate_limited` (auto-backoff applies only to playback polling, where a persistent limit surfaces as `timeout`; upload token/confirm 429s surface directly).

## 2026-06-26 — SDK 0.1.1 CDN host (PR #1)

### Changed

- Pointed the vanilla CDN script at the UAT host `sdk-uat.packiko.com` (`plain.html`).

## 2026-06-23 — initial

### Added

- Packiko Video SDK example: React (npm via GitHub Packages) + vanilla (`<script>` CDN) paths covering record → upload → process → playback, against SDK 0.1.1.
