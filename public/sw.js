/*
 * Offline support.
 *
 * Strategy:
 *   - Navigations and HTML: network-first, fall back to cache. This is the
 *     important one. Hashed asset filenames change on every build, so a
 *     cache-first HTML response can point at a JS file that no longer
 *     exists after a deploy, which looks like the site is broken.
 *   - Hashed assets: cache-first, since their contents never change.
 *
 * No third-party requests are ever made or cached.
 */
const CACHE = 'toolspace-v3'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll([
          './',
          './manifest.webmanifest',
          './icon.svg',
          './theme-init.js',
          // Precache the install icons so the manifest is satisfied offline and
          // the OS can fetch them when the user adds the app to the home screen.
          './icon-192.png',
          './icon-512.png',
          './icon-maskable-192.png',
          './icon-maskable-512.png',
          './apple-touch-icon.png',
        ]),
      ),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

/** Cache a fresh copy without blocking the response. */
function refresh(request, response) {
  if (response.ok) {
    const copy = response.clone()
    caches.open(CACHE).then((cache) => cache.put(request, copy))
  }
  return response
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return

  const accept = request.headers.get('accept') ?? ''
  const isNavigation = request.mode === 'navigate' || accept.includes('text/html')

  if (isNavigation) {
    event.respondWith(
      fetch(request)
        .then((response) => refresh(request, response))
        .catch(() => caches.match(request).then((cached) => cached ?? caches.match('./'))),
    )
    return
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request).then((response) => refresh(request, response))
    }),
  )
})
