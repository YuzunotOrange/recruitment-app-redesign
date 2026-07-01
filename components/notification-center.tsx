"use client"

import { useEffect, useState } from "react"
import { Bell, Check, Trash2, X } from "lucide-react"

import { apiRequest } from "@/lib/api"
import { formatLocalizedDate, text, useLanguagePreference } from "@/lib/language"
import { NOTIFICATION_REFRESH_EVENT } from "@/lib/notification-events"

type NotificationItem = {
  id: number
  title: string
  message: string
  scheduled_at: string | null
  is_read: boolean
}

function formatNotificationDate(value: string | null, language: "en" | "ja" | "ja-en") {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return formatLocalizedDate(value, language)
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")
  return `${formatLocalizedDate(date, language)} ${hours}:${minutes}`
}

export function NotificationCenter() {
  const language = useLanguagePreference()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadNotifications() {
    setLoading(true)
    setError(null)
    try {
      const data = await apiRequest<NotificationItem[]>("/notifications")
      setNotifications(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load notifications.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadNotifications()
  }, [])

  useEffect(() => {
    window.addEventListener(NOTIFICATION_REFRESH_EVENT, loadNotifications)
    return () => window.removeEventListener(NOTIFICATION_REFRESH_EVENT, loadNotifications)
  }, [])

  function toggleOpen() {
    if (!open) {
      loadNotifications()
    }
    setOpen((current) => !current)
  }

  async function markAsRead(notificationId: number) {
    try {
      const updated = await apiRequest<NotificationItem>(`/notifications/${notificationId}/read`, { method: "PATCH" })
      setNotifications((current) => current.map((item) => (item.id === updated.id ? updated : item)))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update notification.")
    }
  }

  async function markAllAsRead() {
    try {
      await apiRequest<{ updated: number }>("/notifications/read-all", { method: "PATCH" })
      setNotifications((current) => current.map((item) => ({ ...item, is_read: true })))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update notifications.")
    }
  }

  async function deleteNotification(notificationId: number) {
    try {
      await apiRequest<void>(`/notifications/${notificationId}`, { method: "DELETE" })
      setNotifications((current) => current.filter((item) => item.id !== notificationId))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete notification.")
    }
  }

  const unreadCount = notifications.filter((item) => !item.is_read).length

  const panel = (
    <div className="flex max-h-[75vh] flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl ring-1 ring-black/5 sm:max-h-[70vh] sm:w-96 sm:rounded-2xl">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-card-foreground">
            {text(language, { en: "Notifications", ja: "通知" })}
          </h2>
          <p className="text-xs text-muted-foreground">
            {unreadCount > 0
              ? text(language, { en: `${unreadCount} unread`, ja: `未読 ${unreadCount} 件` })
              : text(language, { en: "All caught up", ja: "すべて確認済み" })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button type="button" onClick={markAllAsRead} className="text-xs font-medium text-primary hover:underline">
              {text(language, { en: "Read all", ja: "すべて既読" })}
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close notifications"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="overflow-y-auto p-3">
        {error && <p className="mb-3 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">{error}</p>}
        {loading ? (
          <p className="p-3 text-sm text-muted-foreground">Loading...</p>
        ) : notifications.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">No notifications.</p>
        ) : (
          <div className="space-y-2">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`rounded-xl border p-3 ${
                  notification.is_read ? "border-border bg-background" : "border-primary/30 bg-primary/5"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {!notification.is_read && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
                      <p className="truncate text-sm font-semibold text-foreground">{notification.title}</p>
                    </div>
                    <p className="mt-1 text-sm leading-snug text-muted-foreground">{notification.message}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {formatNotificationDate(notification.scheduled_at, language)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {!notification.is_read && (
                      <button
                        type="button"
                        onClick={() => markAsRead(notification.id)}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label="Mark notification as read"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => deleteNotification(notification.id)}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                      aria-label="Delete notification"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="relative z-[1000]">
      <button
        type="button"
        onClick={toggleOpen}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground"
        aria-label="Open notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[990] bg-black/20 sm:hidden" onClick={() => setOpen(false)} />
          <div className="fixed inset-x-0 bottom-0 z-[1000] sm:hidden">{panel}</div>
          <div className="fixed right-5 top-20 z-[1000] hidden sm:block md:right-8">{panel}</div>
        </>
      )}
    </div>
  )
}
