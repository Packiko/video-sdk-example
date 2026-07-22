# Changelog

Notable changes to this example. Format based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) with the Packiko section convention: `### Added`, `### Changed`, `### Documentation`, `### Fixed`, `### Deferred`.

This repo has no version of its own (`package.json` is a private `0.0.0`) — entries are dated and reference the SDK version they track.

## 2026-07-22 — SDK 0.2.0

### Changed

- Bumped `@packiko/video-sdk` `0.1.2` → `0.2.0` (npm, `package.json` + lockfile). 0.2.0 adds optional `items?: VideoItem[]` to `UploadOptions` with client-side pre-validation mirroring the server (Packiko/video#118, ADR 0013).

### Added

- Demo `items` payload in the React upload options (`src/Record.tsx`) — snake_case wire shape, one required-only item (`sku`/`name`/`qty`) and one with the optional `weight_g`. Validated client-side before any byte uploads; failures surface as `items_invalid` / `duplicate_item_sku` through the existing error rendering.

### Documentation

- README: `items` in the Path A usage snippet and new error-table rows `items_invalid` / `duplicate_item_sku`.

### Deferred

- Vanilla CDN path in `plain.html`/README stays at `v0.1.2` — bumping it needs a verified `v0.2.0` CDN artifact (out of scope here).

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
