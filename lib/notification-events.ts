export const NOTIFICATION_REFRESH_EVENT = "careertrack:notifications-refresh"
export const APP_DATA_REFRESH_EVENT = "careertrack:app-data-refresh"

export function requestNotificationRefresh() {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(NOTIFICATION_REFRESH_EVENT))
}

export function requestAppDataRefresh() {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(APP_DATA_REFRESH_EVENT))
  requestNotificationRefresh()
}
