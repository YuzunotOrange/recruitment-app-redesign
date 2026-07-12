import { apiRequest } from "@/lib/api"

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export function isPushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window
}

async function getServiceWorkerRegistration() {
  const registration = await navigator.serviceWorker.getRegistration()
  if (registration) return registration
  // In development the service worker is not auto-registered; register on demand.
  return navigator.serviceWorker.register("/sw.js")
}

export async function enablePushNotifications(): Promise<void> {
  if (!isPushSupported()) {
    throw new Error("This browser does not support push notifications.")
  }

  const permission = await Notification.requestPermission()
  if (permission !== "granted") {
    throw new Error("Notification permission was not granted.")
  }

  const registration = await getServiceWorkerRegistration()
  await navigator.serviceWorker.ready

  const { public_key } = await apiRequest<{ public_key: string }>("/push/public-key")
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(public_key) as unknown as BufferSource,
    }))

  const json = subscription.toJSON()
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error("Failed to create a push subscription.")
  }

  await apiRequest("/push/subscribe", {
    method: "POST",
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    }),
  })
}

export async function disablePushNotifications(): Promise<void> {
  if (!isPushSupported()) return

  const registration = await navigator.serviceWorker.getRegistration()
  const subscription = await registration?.pushManager.getSubscription()
  if (!subscription) return

  const endpoint = subscription.endpoint
  await subscription.unsubscribe()
  try {
    await apiRequest("/push/unsubscribe", {
      method: "POST",
      body: JSON.stringify({ endpoint }),
    })
  } catch {
    // The local unsubscribe already succeeded; the server row is pruned on next failed push.
  }
}
