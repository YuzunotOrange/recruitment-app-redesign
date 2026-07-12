const CACHE_NAME = "careertrack-shell-v1"
const OFFLINE_URL = "/offline.html"

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll([OFFLINE_URL])).then(() => self.skipWaiting()),
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

// Only handle top-level navigations, and only to provide an offline fallback.
// Everything else (API calls, hashed JS/CSS chunks, etc.) goes straight to the network
// so the app never serves stale build output after a deploy.
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return

  event.respondWith(
    fetch(event.request).catch(() => caches.match(OFFLINE_URL)),
  )
})

self.addEventListener("push", (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : "" }
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "CareerTrack", {
      body: data.body || "",
      icon: "/apple-icon.png",
      badge: "/icon-light-32x32.png",
      data: { url: data.url || "/" },
    }),
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const targetUrl = (event.notification.data && event.notification.data.url) || "/"

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if ("focus" in client) {
          client.navigate(targetUrl)
          return client.focus()
        }
      }
      return clients.openWindow(targetUrl)
    }),
  )
})
