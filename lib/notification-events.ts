export const NOTIFICATION_REFRESH_EVENT = "careertrack:notifications-refresh"

export function requestNotificationRefresh() {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(NOTIFICATION_REFRESH_EVENT))
}
