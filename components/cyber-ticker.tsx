"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, Bell, CalendarClock, Zap } from "lucide-react"
import { apiRequest } from "@/lib/api"
import { formatLocalizedDate, useLanguagePreference } from "@/lib/language"
import { APP_DATA_REFRESH_EVENT, NOTIFICATION_REFRESH_EVENT } from "@/lib/notification-events"
import { useThemePreference } from "@/lib/theme"

type NotificationItem = {
  id: number
  title: string
  message: string
  scheduled_at: string | null
  is_read: boolean
}

type UpcomingEvent = {
  id: number | string
  title: string
  company_name?: string
  company?: string
  start_at?: string
  start?: string
  time?: string | null
}

type UpcomingDeadline = {
  id: number | string
  company_name?: string
  company?: string
  es_deadline?: string
  deadline?: string
}

type DashboardSummary = {
  upcoming_events?: UpcomingEvent[]
  upcoming_deadlines?: UpcomingDeadline[]
}

function getEventDate(event: UpcomingEvent) {
  return event.start_at ?? event.start ?? ""
}

function getCompanyName(item: UpcomingEvent | UpcomingDeadline) {
  return item.company_name ?? item.company ?? "-"
}

export function CyberTicker() {
  const theme = useThemePreference()
  const language = useLanguagePreference()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [summary, setSummary] = useState<DashboardSummary>({})

  const loadTickerData = useCallback(async () => {
    if (theme !== "cyberpunk") return

    try {
      const [notificationData, summaryData] = await Promise.all([
        apiRequest<NotificationItem[]>("/notifications"),
        apiRequest<DashboardSummary>("/dashboard/summary"),
      ])
      setNotifications(notificationData)
      setSummary(summaryData)
    } catch {
      setNotifications([])
      setSummary({})
    }
  }, [theme])

  useEffect(() => {
    loadTickerData()
  }, [loadTickerData])

  useEffect(() => {
    if (theme !== "cyberpunk") return

    window.addEventListener(NOTIFICATION_REFRESH_EVENT, loadTickerData)
    window.addEventListener(APP_DATA_REFRESH_EVENT, loadTickerData)
    return () => {
      window.removeEventListener(NOTIFICATION_REFRESH_EVENT, loadTickerData)
      window.removeEventListener(APP_DATA_REFRESH_EVENT, loadTickerData)
    }
  }, [loadTickerData, theme])

  const items = useMemo(() => {
    const unread = notifications.filter((notification) => !notification.is_read).slice(0, 4).map((notification) => ({
      id: `notification-${notification.id}`,
      icon: Bell,
      label: notification.title,
      value: notification.message,
    }))

    const deadlines = (summary.upcoming_deadlines ?? []).slice(0, 3).map((deadline) => ({
      id: `deadline-${deadline.id}`,
      icon: AlertTriangle,
      label: "DEADLINE",
      value: `${getCompanyName(deadline)} ${deadline.es_deadline ?? deadline.deadline ?? ""}`,
    }))

    const events = (summary.upcoming_events ?? []).slice(0, 4).map((event) => {
      const date = getEventDate(event)
      return {
        id: `event-${event.id}`,
        icon: CalendarClock,
        label: event.title,
        value: `${getCompanyName(event)} ${date ? formatLocalizedDate(date, language) : ""} ${event.time ?? ""}`,
      }
    })

    const combined = [...unread, ...deadlines, ...events]
    if (combined.length > 0) return combined

    return [{
      id: "stable",
      icon: Zap,
      label: "NET",
      value: "STABLE",
    }]
  }, [language, notifications, summary])

  return (
    <div className="cyber-ticker" aria-label="Cyberpunk live status stream">
      <div className="cyber-ticker-track">
        {[...items, ...items].map((item, index) => {
          const Icon = item.icon
          return (
            <div className="cyber-ticker-item" key={`${item.id}-${index}`}>
              <Icon className="h-3.5 w-3.5" />
              <span className="cyber-ticker-label">{item.label}</span>
              <span className="truncate">{item.value}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
