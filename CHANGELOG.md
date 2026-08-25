# Changelog

## 2026-08-25

- Reworked the repository as a Partner-facing black-box integration example.
- Added keyless local camera playback and a separate test-account flow.
- Reduced the public guide to configuration, record/stop, `videoId`, and playback.
- Removed private implementation design material from the Partner example.
- Added a three-step Guided Sandbox for Mode A/Mode B setup, recording, order attachment,
  playback, and a clear SDK-versus-Partner responsibility split.
- Added product-level guarantee labels so planned resilience is visible without exposing
  implementation design.
- Restored a complete Partner learning path with separate Record & Upload, Playback, and
  Implementation workspaces.
- Added editable Mode A test values and clarified that OIDC client ID is Mode B-only;
  Mode A uses publishable key plus optional `externalUserRef`.
- Added standalone playback-by-`videoId` and complete public-API examples for Partner attach.
- Added a sanitized Activity Log to React and Vanilla examples with lifecycle events, SDK
  error codes, exact-origin diagnostics, copy, and clear actions.
