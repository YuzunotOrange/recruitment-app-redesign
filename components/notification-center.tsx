"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Bell, Check, RadioTower, Trash2, X, Zap } from "lucide-react"

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
  const alertCount = notifications.length
  const signalLevel = alertCount > 0 ? Math.min(100, 24 + alertCount * 16 + unreadCount * 12) : 8
  const signalStatus = unreadCount > 0 ? "Unread" : alertCount > 0 ? "Seen" : "Clear"

  const panel = (
    <div className="relative flex max-h-[min(75vh,42rem)] w-full flex-col overflow-hidden rounded-t-2xl border border-border/80 bg-popover/95 text-popover-foreground shadow-[0_18px_70px_rgba(0,0,0,0.42)] ring-1 ring-white/10 backdrop-blur-xl sm:max-h-[min(70vh,42rem)] sm:w-[24rem] sm:rounded-2xl">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent to-transparent" />
      <div className="pointer-events-none absolute -right-10 -top-16 h-32 w-32 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -left-12 bottom-0 h-28 w-28 rounded-full bg-accent/20 blur-3xl" />

      <div className="relative border-b border-border/80 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-popover-foreground">
              {text(language, { en: "Notifications", ja: "通知" })}
            </h2>
            <p className="text-xs text-muted-foreground">
              {unreadCount > 0
                ? text(language, { en: `${unreadCount} unread`, ja: `未読 ${unreadCount} 件` })
                : text(language, { en: "All caught up", ja: "すべて確認済み" })}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="rounded-md border border-primary/30 px-2 py-1 text-xs font-medium text-primary transition hover:bg-primary/10"
              >
                {text(language, { en: "Read all", ja: "すべて既読" })}
              </button>
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label="Close notifications"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="cyber-glow-pulse mt-3 overflow-hidden rounded-xl border border-warning/35 bg-[linear-gradient(135deg,rgba(255,216,77,0.16),rgba(0,234,255,0.08)_46%,rgba(255,43,214,0.12))] shadow-[inset_0_0_22px_rgba(0,234,255,0.08)]">
          <div className="flex items-center justify-between gap-3 border-b border-warning/20 px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <RadioTower className="cyber-pulse h-4 w-4 shrink-0 text-warning" />
              <p className="truncate font-mono text-[11px] font-bold uppercase text-foreground">Alert Signal</p>
            </div>
            <span className="cyber-blink rounded-sm bg-warning px-1.5 py-0.5 font-mono text-[10px] font-black uppercase text-black">
              {signalStatus}
            </span>
          </div>
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 px-3 py-2">
            <Zap className="cyber-flicker h-3.5 w-3.5 text-primary" />
            <div className="h-1.5 overflow-hidden rounded-full bg-background/70 ring-1 ring-border/70">
              <div
                className="cyber-scan-sweep-x h-full rounded-full bg-gradient-to-r from-warning via-accent to-primary shadow-[0_0_12px_rgba(0,234,255,0.55)]"
                style={{ width: `${signalLevel}%` }}
              />
            </div>
            <span className="whitespace-nowrap font-mono text-[10px] font-bold text-muted-foreground">
              {alertCount} alert{alertCount === 1 ? "" : "s"}
            </span>
          </div>
          <div className="flex items-center justify-between border-t border-warning/15 px-3 py-1.5 font-mono text-[10px] uppercase text-muted-foreground">
            <span>Unread {unreadCount}</span>
            <span>Total {alertCount}</span>
          </div>
        </div>
      </div>

      <div className="relative min-h-0 overflow-y-auto p-3">
        {error && (
          <p className="mb-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            {error}
          </p>
        )}
        {loading ? (
          <p className="p-3 text-sm text-muted-foreground">Loading...</p>
        ) : notifications.length === 0 ? (
          <p className="rounded-xl border border-border/70 bg-background/45 p-3 text-sm text-muted-foreground">
            No notifications.
          </p>
        ) : (
          <div className="space-y-2">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`relative overflow-hidden rounded-xl border p-3 transition ${
                  notification.is_read
                    ? "border-border/70 bg-background/55"
                    : "border-primary/45 bg-primary/10 shadow-[0_0_24px_rgba(255,43,214,0.12)]"
                }`}
              >
                {!notification.is_read && (
                  <span className="absolute inset-y-3 left-0 w-0.5 rounded-full bg-gradient-to-b from-warning via-primary to-accent" />
                )}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 pl-1">
                    <div className="flex items-center gap-2">
                      {!notification.is_read && (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-primary shadow-[0_0_10px_rgba(255,43,214,0.9)]" />
                      )}
                      <p className="min-w-0 truncate text-sm font-semibold text-foreground">{notification.title}</p>
                    </div>
                    <p className="mt-1 text-sm leading-snug text-muted-foreground">{notification.message}</p>
                    <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                      {formatNotificationDate(notification.scheduled_at, language)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {!notification.is_read && (
                      <button
                        type="button"
                        onClick={() => markAsRead(notification.id)}
                        className="rounded-md border border-border/70 p-1.5 text-muted-foreground transition hover:border-primary/50 hover:bg-primary/10 hover:text-foreground"
                        aria-label="Mark notification as read"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => deleteNotification(notification.id)}
                      className="rounded-md border border-border/70 p-1.5 text-muted-foreground transition hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
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
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground shadow-sm transition hover:border-primary/50 hover:text-foreground"
        aria-label="Open notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="cyber-flicker absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground shadow-[0_0_14px_rgba(255,43,214,0.45)]">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[10000] pointer-events-none">
          <div
            className="absolute inset-0 bg-black/35 backdrop-blur-[1px] pointer-events-auto sm:hidden"
            onClick={() => setOpen(false)}
          />
          <div className="pointer-events-auto fixed bottom-4 left-4 right-4 max-w-[calc(100vw-2rem)] sm:bottom-auto sm:left-auto sm:right-4 sm:top-20 sm:w-96 lg:right-6 xl:right-[22rem]">
            {panel}
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
