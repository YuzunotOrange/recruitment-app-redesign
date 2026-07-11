"use client"

import { useCallback, useEffect, useState } from "react"
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CalendarCheck,
  CheckCircle2,
  ListTodo,
  Loader2,
  Target,
  X,
} from "lucide-react"
import { apiRequest } from "@/lib/api"
import { APP_DATA_REFRESH_EVENT } from "@/lib/notification-events"
import { formatLocalizedDate, text, useLanguagePreference, type LanguageMode } from "@/lib/language"
import { StatusBadge } from "@/components/status-badge"

type Tone = "neutral" | "info" | "success" | "warning" | "danger"
type Priority = "high" | "medium" | "low"
type MainIssue = "SPI" | "ES" | "Interview" | "Application Balance" | "Deadline" | "No Issue"

type DashboardSummary = {
  kpis: {
    total_companies: number
    interviews: number
    offers: number
    deadline_soon: number
  }
  upcoming_events?: Array<{
    id: number | string
    title: string
    company_name?: string
    company?: string
    start_at?: string
    start?: string
    time?: string | null
  }>
}

type AdvisorAction = {
  id: string
  title: string
  reason: string
  priority: Priority
}

type AdvisorSummary = {
  current_situation: string
  main_issue: MainIssue
  reason: string
  todays_mission: AdvisorAction[]
  this_week: AdvisorAction[]
  suggested_improvements: AdvisorAction[]
  risk_monitor: Record<"es" | "spi" | "interview" | "deadline", Priority>
  deadline_alerts: Array<{
    title: string
    due_date: string
    days_left: number
    source: "company" | "event"
  }>
  application_balance: {
    reach_ratio: number
    core_ratio: number
    safe_ratio: number
    hold_count: number
    recommendation: string
  }
  system_note: string
}

type NotificationItem = {
  id: number
  title: string
  message: string
  scheduled_at: string | null
  is_read: boolean
}

const priorityTone: Record<Priority, Tone> = {
  high: "danger",
  medium: "warning",
  low: "info",
}

function copy(language: LanguageMode, value: { en: string; ja: string }) {
  if (language === "ja-en") return `${value.en} / ${value.ja}`
  return text(language, value)
}

const commandCopy = {
  commandCenter: { en: "Command Center", ja: "\u53f8\u4ee4\u5854" },
  title: { en: "Today's decisions and priorities", ja: "\u4eca\u65e5\u306e\u5224\u65ad\u3068\u512a\u5148\u9806\u4f4d" },
  description: {
    en: "Current tasks, deadlines, events, notifications, and system advice are organized here for today.",
    ja: "\u4eca\u65e5\u898b\u308b\u3079\u304d\u30bf\u30b9\u30af\u3001\u7de0\u5207\u3001\u4e88\u5b9a\u3001\u901a\u77e5\u3001\u30b7\u30b9\u30c6\u30e0\u30a2\u30c9\u30d0\u30a4\u30b9\u3092\u6574\u7406\u3057\u3066\u8868\u793a\u3057\u307e\u3059\u3002",
  },
  mainIssue: { en: "Main Issue", ja: "\u4e3b\u306a\u8ab2\u984c" },
  loading: { en: "Loading Command Center...", ja: "Command Center\u3092\u8aad\u307f\u8fbc\u307f\u4e2d..." },
  todaysMission: { en: "Today's Mission", ja: "\u4eca\u65e5\u306e\u30df\u30c3\u30b7\u30e7\u30f3" },
  thisWeek: { en: "This Week", ja: "\u4eca\u9031" },
  suggestedImprovements: { en: "Advice", ja: "\u30a2\u30c9\u30d0\u30a4\u30b9" },
  upcomingDeadlines: { en: "Upcoming Deadlines", ja: "\u76f4\u8fd1\u306e\u7de0\u5207" },
  noDeadlineAlerts: { en: "No deadline alerts.", ja: "\u7de0\u5207\u30a2\u30e9\u30fc\u30c8\u306f\u3042\u308a\u307e\u305b\u3093\u3002" },
  upcomingEvents: { en: "Upcoming Events", ja: "\u4eca\u5f8c\u306e\u30a4\u30d9\u30f3\u30c8" },
  noUpcomingEvents: { en: "No upcoming events.", ja: "\u4eca\u5f8c\u306e\u30a4\u30d9\u30f3\u30c8\u306f\u3042\u308a\u307e\u305b\u3093\u3002" },
  currentSituation: { en: "Current Situation", ja: "\u73fe\u5728\u306e\u72b6\u6cc1" },
  companies: { en: "Companies", ja: "\u4f01\u696d" },
  interviews: { en: "Interviews", ja: "\u9762\u63a5" },
  offers: { en: "Offers", ja: "\u5185\u5b9a" },
  due7d: { en: "Due <=7d", ja: "7\u65e5\u4ee5\u5185" },
  recentNotifications: { en: "Recent Notifications", ja: "\u6700\u8fd1\u306e\u901a\u77e5" },
  unread: { en: "unread", ja: "\u672a\u8aad" },
  noNotifications: { en: "No notifications.", ja: "\u901a\u77e5\u306f\u3042\u308a\u307e\u305b\u3093\u3002" },
  footerNote: {
    en: "Command Center only organizes current system data. It does not predict outcomes or decide applications.",
    ja: "Command Center\u306f\u73fe\u5728\u306e\u30b7\u30b9\u30c6\u30e0\u30c7\u30fc\u30bf\u3092\u6574\u7406\u3059\u308b\u3060\u3051\u3067\u3059\u3002\u7d50\u679c\u306e\u4e88\u6e2c\u3084\u5fdc\u52df\u5224\u65ad\u306f\u884c\u3044\u307e\u305b\u3093\u3002",
  },
  retry: { en: "Retry", ja: "\u518d\u8a66\u884c" },
  markDone: { en: "Mark Done", ja: "\u5b8c\u4e86" },
  addToTask: { en: "Add To Task", ja: "\u30bf\u30b9\u30af\u3078\u8ffd\u52a0" },
  added: { en: "Added", ja: "\u8ffd\u52a0\u6e08\u307f" },
  dismiss: { en: "Dismiss", ja: "\u975e\u8868\u793a" },
  noSuggestedActions: { en: "No suggested actions.", ja: "\u63d0\u6848\u306f\u3042\u308a\u307e\u305b\u3093\u3002" },
  noSystemTasks: { en: "No system tasks.", ja: "\u30b7\u30b9\u30c6\u30e0\u30bf\u30b9\u30af\u306f\u3042\u308a\u307e\u305b\u3093\u3002" },
  applicationBalance: { en: "Application Balance", ja: "\u5fdc\u52df\u30d0\u30e9\u30f3\u30b9" },
  riskMonitor: { en: "Risk Monitor", ja: "\u30ea\u30b9\u30af\u76e3\u8996" },
  hold: { en: "Hold", ja: "\u4fdd\u7559" },
}

const emptyAdvisor: AdvisorSummary = {
  current_situation: "No advisor data loaded yet.",
  main_issue: "No Issue",
  reason: "Advisor Engine will analyze your job-hunting data.",
  todays_mission: [],
  this_week: [],
  suggested_improvements: [],
  risk_monitor: { es: "low", spi: "low", interview: "low", deadline: "low" },
  deadline_alerts: [],
  application_balance: {
    reach_ratio: 0,
    core_ratio: 0,
    safe_ratio: 0,
    hold_count: 0,
    recommendation: "No portfolio data yet.",
  },
  system_note: "CareerTrack analyzes and prioritizes only. The final decision is yours.",
}

const HIDDEN_IDS_KEY = "careertrack_command_center_hidden_ids"
const DONE_IDS_KEY = "careertrack_command_center_done_ids"

function loadIdSet(key: string): Set<string> {
  if (typeof window === "undefined") return new Set()
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? new Set(parsed) : new Set()
  } catch {
    return new Set()
  }
}

function saveIdSet(key: string, ids: Set<string>) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(key, JSON.stringify(Array.from(ids)))
  } catch {
    // storage unavailable (private mode, quota) — state stays session-only
  }
}

function eventDate(event: NonNullable<DashboardSummary["upcoming_events"]>[number]) {
  return event.start_at ?? event.start ?? ""
}

function eventCompany(event: NonNullable<DashboardSummary["upcoming_events"]>[number]) {
  return event.company_name ?? event.company ?? "-"
}

function ActionList({
  title,
  actions,
  language,
  hiddenIds,
  doneIds,
  taskIds,
  onDismiss,
  onDone,
  onAddToTask,
}: {
  title: string
  actions: AdvisorAction[]
  language: LanguageMode
  hiddenIds: Set<string>
  doneIds: Set<string>
  taskIds: Set<string>
  onDismiss: (action: AdvisorAction) => void
  onDone: (action: AdvisorAction) => void
  onAddToTask: (action: AdvisorAction) => void
}) {
  const visibleActions = actions.filter((action) => !hiddenIds.has(action.id))

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <div className="mt-4 grid gap-3">
        {visibleActions.length ? (
          visibleActions.map((action) => (
            <article key={action.id} className="rounded-xl border border-border bg-background/65 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className={doneIds.has(action.id) ? "font-semibold text-muted-foreground line-through" : "font-semibold text-foreground"}>
                    {action.title}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{action.reason}</p>
                </div>
                <StatusBadge tone={priorityTone[action.priority]}>{action.priority}</StatusBadge>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={() => onDone(action)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-foreground hover:bg-muted">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {copy(language, commandCopy.markDone)}
                </button>
                <button type="button" onClick={() => onAddToTask(action)} disabled={taskIds.has(action.id)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50">
                  <ListTodo className="h-3.5 w-3.5" />
                  {taskIds.has(action.id) ? copy(language, commandCopy.added) : copy(language, commandCopy.addToTask)}
                </button>
                <button type="button" onClick={() => onDismiss(action)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                  {copy(language, commandCopy.dismiss)}
                </button>
              </div>
            </article>
          ))
        ) : (
          <p className="rounded-xl border border-dashed border-border bg-background/65 p-4 text-sm text-muted-foreground">
            {copy(language, commandCopy.noSuggestedActions)}
          </p>
        )}
      </div>
    </section>
  )
}

function RiskMonitor({ risks, language }: { risks: Record<"es" | "spi" | "interview" | "deadline", Priority>; language: LanguageMode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h3 className="text-lg font-semibold text-foreground">{copy(language, commandCopy.riskMonitor)}</h3>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {([
          ["ES", risks.es],
          ["SPI", risks.spi],
          ["Interview", risks.interview],
          ["Deadline", risks.deadline],
        ] as const).map(([label, level]) => (
          <div key={label} className="flex items-center justify-between rounded-xl border border-border bg-background/65 px-4 py-3">
            <span className="font-medium text-foreground">{label}</span>
            <StatusBadge tone={priorityTone[level]}>{level}</StatusBadge>
          </div>
        ))}
      </div>
    </section>
  )
}

function ApplicationBalance({
  balance,
  language,
}: {
  balance: {
    reach_ratio: number
    core_ratio: number
    safe_ratio: number
    hold_count: number
    recommendation?: string
    ideal_reach_ratio?: number
    ideal_core_ratio?: number
    ideal_safe_ratio?: number
  }
  language: LanguageMode
}) {
  const rows = [
    ["Reach", balance.reach_ratio, balance.ideal_reach_ratio ?? 30],
    ["Core", balance.core_ratio, balance.ideal_core_ratio ?? 50],
    ["Safe", balance.safe_ratio, balance.ideal_safe_ratio ?? 20],
  ] as const

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h3 className="text-lg font-semibold text-foreground">{copy(language, commandCopy.applicationBalance)}</h3>
      <div className="mt-4 space-y-4">
        {rows.map(([label, current, ideal]) => (
          <div key={label}>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{label}</span>
              <span>{current}% / {ideal}%</span>
            </div>
            <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(current, 100)}%` }} />
            </div>
          </div>
        ))}
        <div className="flex justify-between rounded-xl border border-border bg-background/65 px-4 py-3 text-sm">
          <span className="text-muted-foreground">{copy(language, commandCopy.hold)}</span>
          <span className="font-medium text-foreground">{balance.hold_count}</span>
        </div>
      </div>
      {"recommendation" in balance && balance.recommendation && (
        <p className="mt-4 rounded-xl border border-border bg-background/65 p-4 text-sm leading-relaxed text-muted-foreground">
          {balance.recommendation}
        </p>
      )}
    </section>
  )
}

export function CommandCenterView() {
  const language = useLanguagePreference()
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [advisor, setAdvisor] = useState<AdvisorSummary>(emptyAdvisor)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => loadIdSet(HIDDEN_IDS_KEY))
  const [doneIds, setDoneIds] = useState<Set<string>>(() => loadIdSet(DONE_IDS_KEY))
  const [taskIds, setTaskIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadCommandCenter = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [summaryData, advisorData, notificationData] = await Promise.all([
        apiRequest<DashboardSummary>("/dashboard/summary"),
        apiRequest<AdvisorSummary>("/advisor/summary"),
        apiRequest<NotificationItem[]>("/notifications"),
      ])
      setSummary(summaryData)
      setAdvisor(advisorData)
      setNotifications(notificationData)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Command Center.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCommandCenter()
  }, [loadCommandCenter])

  useEffect(() => {
    window.addEventListener(APP_DATA_REFRESH_EVENT, loadCommandCenter)
    return () => window.removeEventListener(APP_DATA_REFRESH_EVENT, loadCommandCenter)
  }, [loadCommandCenter])

  const markDone = useCallback((action: AdvisorAction) => {
    setDoneIds((current) => {
      const next = new Set(current).add(action.id)
      saveIdSet(DONE_IDS_KEY, next)
      return next
    })
  }, [])

  const dismiss = useCallback((action: AdvisorAction) => {
    setHiddenIds((current) => {
      const next = new Set(current).add(action.id)
      saveIdSet(HIDDEN_IDS_KEY, next)
      return next
    })
  }, [])

  const addToTask = useCallback(async (action: AdvisorAction) => {
    try {
      await apiRequest("/tasks", {
        method: "POST",
        body: JSON.stringify({
          title: action.title,
          description: `From Command Center: ${action.reason}`,
          priority: action.priority,
          status: "todo",
        }),
      })
      setTaskIds((current) => new Set(current).add(action.id))
      window.dispatchEvent(new Event(APP_DATA_REFRESH_EVENT))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add task.")
    }
  }, [])

  const unreadCount = notifications.filter((notification) => !notification.is_read).length
  const upcomingEvents = (summary?.upcoming_events ?? []).slice(0, 6)

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="rounded-2xl border border-primary/30 bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              <Target className="h-4 w-4" />
              <span>{copy(language, commandCopy.commandCenter)}</span>
            </div>
            <h2 className="mt-2 text-2xl font-semibold text-foreground">{copy(language, commandCopy.title)}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {copy(language, commandCopy.description)}
            </p>
          </div>
          <div className="rounded-2xl border border-primary/30 bg-primary/10 px-5 py-4 lg:min-w-72">
            <p className="text-xs font-medium text-muted-foreground">{copy(language, commandCopy.mainIssue)}</p>
            <p className="mt-1 text-3xl font-semibold text-primary">{advisor.main_issue}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{advisor.reason}</p>
          </div>
        </div>
      </section>
      {loading && (
        <div className="inline-flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {copy(language, commandCopy.loading)}
        </div>
      )}

      {error && (
        <div className="flex flex-col gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => loadCommandCenter()}
            className="inline-flex w-fit items-center gap-1.5 rounded-full border border-destructive/40 bg-background px-3 py-1.5 text-xs font-semibold text-destructive transition hover:bg-destructive/10"
          >
            {copy(language, commandCopy.retry)}
          </button>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <ActionList
            title={copy(language, commandCopy.todaysMission)}
            actions={advisor.todays_mission}
            language={language}
            hiddenIds={hiddenIds}
            doneIds={doneIds}
            taskIds={taskIds}
            onDismiss={dismiss}
            onDone={markDone}
            onAddToTask={addToTask}
          />

          <ActionList
            title={copy(language, commandCopy.thisWeek)}
            actions={advisor.this_week}
            language={language}
            hiddenIds={hiddenIds}
            doneIds={doneIds}
            taskIds={taskIds}
            onDismiss={dismiss}
            onDone={markDone}
            onAddToTask={addToTask}
          />

          {advisor.suggested_improvements.length > 0 && (
            <ActionList
              title={copy(language, commandCopy.suggestedImprovements)}
              actions={advisor.suggested_improvements}
              language={language}
              hiddenIds={hiddenIds}
              doneIds={doneIds}
              taskIds={taskIds}
              onDismiss={dismiss}
              onDone={markDone}
              onAddToTask={addToTask}
            />
          )}
        </div>

        <div className="space-y-6">
          <section className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <AlertTriangle className="h-4 w-4 text-warning-foreground" />
              {copy(language, commandCopy.upcomingDeadlines)}
            </div>
            <div className="mt-4 grid gap-3">
              {advisor.deadline_alerts.length ? (
                advisor.deadline_alerts.slice(0, 5).map((alert) => (
                  <article key={`${alert.source}-${alert.title}-${alert.due_date}`} className="rounded-xl border border-border bg-background/65 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-semibold text-foreground">{alert.title}</p>
                      <StatusBadge tone={alert.days_left <= 1 ? "danger" : "warning"}>{alert.days_left}d</StatusBadge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{formatLocalizedDate(alert.due_date, language)}</p>
                  </article>
                ))
              ) : (
                <p className="rounded-xl border border-dashed border-border bg-background/65 p-4 text-sm text-muted-foreground">
                  {copy(language, commandCopy.noDeadlineAlerts)}
                </p>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <CalendarCheck className="h-4 w-4 text-accent" />
              {copy(language, commandCopy.upcomingEvents)}
            </div>
            <div className="mt-4 grid gap-3">
              {upcomingEvents.length ? (
                upcomingEvents.map((event) => {
                  const date = eventDate(event)
                  return (
                    <article key={event.id} className="rounded-xl border border-border bg-background/65 p-4">
                      <p className="font-semibold text-foreground">{event.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {date ? formatLocalizedDate(date, language) : "-"} / {eventCompany(event)} / {event.time ?? "-"}
                      </p>
                    </article>
                  )
                })
              ) : (
                <p className="rounded-xl border border-dashed border-border bg-background/65 p-4 text-sm text-muted-foreground">
                  {copy(language, commandCopy.noUpcomingEvents)}
                </p>
              )}
            </div>
          </section>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="rounded-2xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground">{copy(language, commandCopy.currentSituation)}</h3>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{advisor.current_situation}</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border bg-background/65 p-4">
              <p className="text-xs text-muted-foreground">{copy(language, commandCopy.companies)}</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{summary?.kpis.total_companies ?? 0}</p>
            </div>
            <div className="rounded-xl border border-border bg-background/65 p-4">
              <p className="text-xs text-muted-foreground">{copy(language, commandCopy.interviews)}</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{summary?.kpis.interviews ?? 0}</p>
            </div>
            <div className="rounded-xl border border-border bg-background/65 p-4">
              <p className="text-xs text-muted-foreground">{copy(language, commandCopy.offers)}</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{summary?.kpis.offers ?? 0}</p>
            </div>
            <div className="rounded-xl border border-border bg-background/65 p-4">
              <p className="text-xs text-muted-foreground">{copy(language, commandCopy.due7d)}</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{summary?.kpis.deadline_soon ?? 0}</p>
            </div>
          </div>
        </section>

        <ApplicationBalance balance={advisor.application_balance} language={language} />
        <RiskMonitor risks={advisor.risk_monitor} language={language} />
      </div>

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Bell className="h-4 w-4 text-accent" />
            {copy(language, commandCopy.recentNotifications)}
          </div>
          <StatusBadge tone={unreadCount ? "warning" : "neutral"}>{unreadCount} {copy(language, commandCopy.unread)}</StatusBadge>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {notifications.slice(0, 6).length ? (
            notifications.slice(0, 6).map((notification) => (
              <article key={notification.id} className="rounded-xl border border-border bg-background/65 p-4">
                <div className="flex items-center gap-2">
                  {!notification.is_read && <span className="h-2 w-2 rounded-full bg-primary" />}
                  <p className="font-semibold text-foreground">{notification.title}</p>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{notification.message}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {notification.scheduled_at ? formatLocalizedDate(notification.scheduled_at, language) : "-"}
                </p>
              </article>
            ))
          ) : (
            <p className="rounded-xl border border-dashed border-border bg-background/65 p-4 text-sm text-muted-foreground">
              {copy(language, commandCopy.noNotifications)}
            </p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start gap-3">
          <ArrowRight className="mt-0.5 h-4 w-4 text-accent" />
          <p className="text-sm leading-relaxed text-muted-foreground">
            {copy(language, commandCopy.footerNote)}
          </p>
        </div>
      </section>
    </div>
  )
}
