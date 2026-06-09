const CACHE_NAME = 'dime-depot-v2'
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
]

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return
  if (!event.request.url.startsWith('http')) return
  if (event.request.url.includes('supabase.co')) return

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone))
        }
        return response
      })
      .catch(() => {
        return caches.match(event.request).then(cached => {
          if (cached) return cached
          if (event.request.mode === 'navigate') {
            return caches.match('/')
          }
        })
      })
  )
})

// Keep alive — prevent iOS from killing the app
self.addEventListener('message', event => {
  if (event.data === 'keepAlive') {
    event.ports[0].postMessage('alive')
  }
})