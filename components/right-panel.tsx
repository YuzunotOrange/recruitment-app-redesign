"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, Bell, CalendarClock, CheckCircle2 } from "lucide-react"
import { apiRequest } from "@/lib/api"
import { daysUntil, TODAY } from "@/lib/data"
import { copy, formatLocalizedDate, text, useLanguagePreference } from "@/lib/language"
import { APP_DATA_REFRESH_EVENT } from "@/lib/notification-events"
import { StatusBadge } from "@/components/status-badge"

type DashboardSummary = {
  upcoming_events?: UpcomingEvent[]
  upcoming_deadlines?: UpcomingDeadline[]
  recent_activities?: RecentActivity[]
}

type UpcomingEvent = {
  id: number | string
  title: string
  company_name?: string | null
  company?: string | null
  start_at?: string
  start?: string
  time?: string | null
}

type UpcomingDeadline = {
  id: number | string
  title?: string | null
  company_name?: string | null
  company?: string | null
  es_deadline?: string
  deadline?: string
}

type RecentActivity = {
  id: number | string
  company?: string | null
  text: string
  date?: string
  occurred_at?: string
}

function getEventDate(event: UpcomingEvent) {
  return event.start_at ?? event.start ?? ""
}

function getDeadlineDate(deadline: UpcomingDeadline) {
  return deadline.es_deadline ?? deadline.deadline ?? ""
}

function formatPanelDate(dateIso: string, language: "en" | "ja" | "ja-en") {
  const [year, month, day] = dateIso.split("-").map(Number)
  if (!year || !month || !day) return "-"
  if (language === "ja") return `${month}月${day}日`
  return `${year}/${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}`
}

export function RightPanel() {
  const language = useLanguagePreference()
  const [summary, setSummary] = useState<DashboardSummary>({
    upcoming_events: [],
    upcoming_deadlines: [],
    recent_activities: [],
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadSummary = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const data = await apiRequest<DashboardSummary>("/dashboard/summary")
      setSummary(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load summary.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSummary()
  }, [loadSummary])

  useEffect(() => {
    window.addEventListener(APP_DATA_REFRESH_EVENT, loadSummary)
    return () => window.removeEventListener(APP_DATA_REFRESH_EVENT, loadSummary)
  }, [loadSummary])

  const deadlines = (summary.upcoming_deadlines ?? [])
    .filter((deadline) => getDeadlineDate(deadline) && daysUntil(getDeadlineDate(deadline)) >= 0)
    .sort((a, b) => daysUntil(getDeadlineDate(a)) - daysUntil(getDeadlineDate(b)))
    .slice(0, 4)

  const upcoming = (summary.upcoming_events ?? [])
    .filter((event) => getEventDate(event) && daysUntil(getEventDate(event)) >= 0)
    .sort((a, b) => daysUntil(getEventDate(a)) - daysUntil(getEventDate(b)))
    .slice(0, 4)

  const activities = (summary.recent_activities ?? []).slice(0, 4)

  return (
    <aside className="hidden w-80 shrink-0 flex-col gap-5 overflow-y-auto border-l border-border bg-background px-5 py-6 xl:flex">
      {error && <p className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">{error}</p>}

      <div>
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <AlertTriangle className="h-4 w-4 text-warning" />
            {text(language, { en: "Deadlines", ja: "ES締切" })}
          </h3>
          <span className="text-xs text-muted-foreground">
            {TODAY.getFullYear()}/{TODAY.getMonth() + 1}/{TODAY.getDate()}
          </span>
        </div>
        <div className="mt-3 space-y-2">
          {loading ? (
            <p className="text-xs text-muted-foreground">Loading...</p>
          ) : deadlines.length === 0 ? (
            <p className="text-xs text-muted-foreground">{text(language, { en: "No deadlines yet.", ja: "締切はまだありません。" })}</p>
          ) : (
            deadlines.map((deadline) => {
              const date = getDeadlineDate(deadline)
              const d = daysUntil(date)
              const urgent = d <= 7
              return (
                <div
                  key={deadline.id}
                  className="flex items-center justify-between rounded-xl border border-border bg-card p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-card-foreground">
                      {deadline.company_name ?? deadline.company ?? deadline.title ?? text(language, { en: "No company", ja: "企業なし" })}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatLocalizedDate(date, language)}</p>
                  </div>
                  <StatusBadge tone={urgent ? "danger" : "neutral"}>{d === 0 ? text(language, copy.kpiToday) : `${d}d`}</StatusBadge>
                </div>
              )
            })
          )}
        </div>
      </div>

      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <CalendarClock className="h-4 w-4 text-accent" />
          {text(language, copy.upcomingEvents)}
        </h3>
        <div className="mt-3 space-y-3">
          {loading ? (
            <p className="text-xs text-muted-foreground">Loading...</p>
          ) : upcoming.length === 0 ? (
            <p className="text-xs text-muted-foreground">{text(language, copy.noUpcomingEvents)}</p>
          ) : (
            upcoming.map((event) => (
              <div key={event.id} className="flex gap-3">
                <div className="flex w-20 shrink-0 flex-col items-center">
                  <span className="flex min-h-9 w-full items-center justify-center rounded-lg bg-primary/5 px-1 text-center text-[11px] font-semibold leading-tight text-primary">
                    {formatPanelDate(getEventDate(event), language)}
                  </span>
                  <span className="mt-1 h-full w-px bg-border" />
                </div>
                <div className="min-w-0 pb-1">
                  <p className="truncate text-sm font-medium text-foreground">{event.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {event.company_name ?? event.company ?? text(language, { en: "No company", ja: "企業なし" })}
                    {event.time ? ` - ${event.time}` : ""}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Bell className="h-4 w-4 text-accent" />
          {text(language, { en: "Activity", ja: "通知" })}
        </h3>
        <div className="mt-3 space-y-3">
          {loading ? (
            <p className="text-xs text-muted-foreground">Loading...</p>
          ) : activities.length === 0 ? (
            <p className="text-xs text-muted-foreground">{text(language, { en: "No activity yet.", ja: "通知はまだありません。" })}</p>
          ) : (
            activities.map((activity) => (
              <div key={activity.id} className="flex gap-2.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-sm leading-snug text-foreground">
                    {activity.company ? <span className="font-medium">{activity.company} - </span> : null}
                    {activity.text}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatLocalizedDate(activity.date ?? activity.occurred_at ?? "", language)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </aside>
  )
}
