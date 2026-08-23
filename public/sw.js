// Partner-side service worker — the Background Sync recipe from the SDK README,
// verbatim. The SDK ships no service worker; this file belongs to the app.
self.addEventListener('sync', (event) => {
  if (event.tag !== 'packiko-video-sdk:drain') return // UPLOAD_SYNC_TAG
  event.waitUntil(
    self.clients
      // includeUncontrolled: a freshly loaded page is not yet controlled by
      // the SW (until the next navigation) but must still get the message.
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => clients.forEach((c) => c.postMessage({ type: 'packiko-video:drain' }))),
  )
})
