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
  Sparkles,
  Target,
  X,
} from "lucide-react"
import { apiRequest } from "@/lib/api"
import { APP_DATA_REFRESH_EVENT } from "@/lib/notification-events"
import { formatLocalizedDate, useLanguagePreference } from "@/lib/language"
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

type DecisionTask = {
  title: string
  reason: string
  priority: Priority
}

type DecisionSummary = {
  main_issue: MainIssue
  reason: string
  today_tasks: DecisionTask[]
  week_tasks: DecisionTask[]
  suggested_companies: Array<{
    position: "Reach" | "Core" | "Safe"
    shortage: number
    reason: string
  }>
  risk_monitor: Record<"es" | "spi" | "interview" | "deadline", Priority>
  application_balance: {
    reach_ratio: number
    core_ratio: number
    safe_ratio: number
    hold_count: number
    ideal_reach_ratio: number
    ideal_core_ratio: number
    ideal_safe_ratio: number
  }
  current_situation: string
  system_analysis: string
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

const emptyDecision: DecisionSummary = {
  main_issue: "No Issue",
  reason: "No decision data loaded yet.",
  today_tasks: [],
  week_tasks: [],
  suggested_companies: [],
  risk_monitor: { es: "low", spi: "low", interview: "low", deadline: "low" },
  application_balance: {
    reach_ratio: 0,
    core_ratio: 0,
    safe_ratio: 0,
    hold_count: 0,
    ideal_reach_ratio: 30,
    ideal_core_ratio: 50,
    ideal_safe_ratio: 20,
  },
  current_situation: "No data yet.",
  system_analysis: "Decision Engine will analyze your current application data.",
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
  hiddenIds,
  doneIds,
  taskIds,
  onDismiss,
  onDone,
  onAddToTask,
}: {
  title: string
  actions: AdvisorAction[]
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
                  Mark Done
                </button>
                <button type="button" onClick={() => onAddToTask(action)} disabled={taskIds.has(action.id)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50">
                  <ListTodo className="h-3.5 w-3.5" />
                  {taskIds.has(action.id) ? "Added" : "Add To Task"}
                </button>
                <button type="button" onClick={() => onDismiss(action)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                  Dismiss
                </button>
              </div>
            </article>
          ))
        ) : (
          <p className="rounded-xl border border-dashed border-border bg-background/65 p-4 text-sm text-muted-foreground">
            No suggested actions.
          </p>
        )}
      </div>
    </section>
  )
}

function SimpleTaskList({ title, tasks }: { title: string; tasks: DecisionTask[] }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <div className="mt-4 grid gap-3">
        {tasks.length ? (
          tasks.map((task, index) => (
            <article key={`${task.title}-${index}`} className="rounded-xl border border-border bg-background/65 p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold text-foreground">{task.title}</p>
                <StatusBadge tone={priorityTone[task.priority]}>{task.priority}</StatusBadge>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{task.reason}</p>
            </article>
          ))
        ) : (
          <p className="rounded-xl border border-dashed border-border bg-background/65 p-4 text-sm text-muted-foreground">
            No system tasks.
          </p>
        )}
      </div>
    </section>
  )
}

function RiskMonitor({ risks }: { risks: Record<"es" | "spi" | "interview" | "deadline", Priority> }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h3 className="text-lg font-semibold text-foreground">Risk Monitor</h3>
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
}) {
  const rows = [
    ["Reach", balance.reach_ratio, balance.ideal_reach_ratio ?? 30],
    ["Core", balance.core_ratio, balance.ideal_core_ratio ?? 50],
    ["Safe", balance.safe_ratio, balance.ideal_safe_ratio ?? 20],
  ] as const

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h3 className="text-lg font-semibold text-foreground">Application Balance</h3>
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
          <span className="text-muted-foreground">Hold</span>
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
  const [decision, setDecision] = useState<DecisionSummary>(emptyDecision)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set())
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set())
  const [taskIds, setTaskIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadCommandCenter = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [summaryData, advisorData, decisionData, notificationData] = await Promise.all([
        apiRequest<DashboardSummary>("/dashboard/summary"),
        apiRequest<AdvisorSummary>("/advisor/summary"),
        apiRequest<DecisionSummary>("/decision/summary"),
        apiRequest<NotificationItem[]>("/notifications"),
      ])
      setSummary(summaryData)
      setAdvisor(advisorData)
      setDecision(decisionData)
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
    setDoneIds((current) => new Set(current).add(action.id))
  }, [])

  const dismiss = useCallback((action: AdvisorAction) => {
    setHiddenIds((current) => new Set(current).add(action.id))
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
              <span>Command Center</span>
            </div>
            <h2 className="mt-2 text-2xl font-semibold text-foreground">今日の判断と優先順位</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Dashboardから重い分析パネルを分離しました。ここでは Advisor と Decision Engine の提案を、行動しやすい順番で確認します。
            </p>
          </div>
          <div className="rounded-2xl border border-primary/30 bg-primary/10 px-5 py-4 lg:min-w-72">
            <p className="text-xs font-medium text-muted-foreground">Main Issue</p>
            <p className="mt-1 text-3xl font-semibold text-primary">{advisor.main_issue}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{advisor.reason}</p>
          </div>
        </div>
      </section>

      {loading && (
        <div className="inline-flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading Command Center...
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <ActionList
            title="Today's Mission"
            actions={advisor.todays_mission}
            hiddenIds={hiddenIds}
            doneIds={doneIds}
            taskIds={taskIds}
            onDismiss={dismiss}
            onDone={markDone}
            onAddToTask={addToTask}
          />

          <ActionList
            title="This Week"
            actions={advisor.this_week}
            hiddenIds={hiddenIds}
            doneIds={doneIds}
            taskIds={taskIds}
            onDismiss={dismiss}
            onDone={markDone}
            onAddToTask={addToTask}
          />

          {advisor.suggested_improvements.length > 0 && (
            <ActionList
              title="Suggested Improvements"
              actions={advisor.suggested_improvements}
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
              Upcoming Deadlines
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
                  No deadline alerts.
                </p>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <CalendarCheck className="h-4 w-4 text-accent" />
              Upcoming Events
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
                  No upcoming events.
                </p>
              )}
            </div>
          </section>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="rounded-2xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground">Current Situation</h3>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{advisor.current_situation}</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border bg-background/65 p-4">
              <p className="text-xs text-muted-foreground">Companies</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{summary?.kpis.total_companies ?? 0}</p>
            </div>
            <div className="rounded-xl border border-border bg-background/65 p-4">
              <p className="text-xs text-muted-foreground">Interviews</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{summary?.kpis.interviews ?? 0}</p>
            </div>
            <div className="rounded-xl border border-border bg-background/65 p-4">
              <p className="text-xs text-muted-foreground">Offers</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{summary?.kpis.offers ?? 0}</p>
            </div>
            <div className="rounded-xl border border-border bg-background/65 p-4">
              <p className="text-xs text-muted-foreground">Due {"<=7d"}</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{summary?.kpis.deadline_soon ?? 0}</p>
            </div>
          </div>
        </section>

        <ApplicationBalance balance={advisor.application_balance} />
        <RiskMonitor risks={advisor.risk_monitor} />
      </div>

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
          <Sparkles className="h-4 w-4" />
          <span>Decision Engine</span>
        </div>
        <div className="mt-4 grid gap-6 xl:grid-cols-[1fr_1fr_0.9fr]">
          <SimpleTaskList title="System: Today's Mission" tasks={decision.today_tasks} />
          <SimpleTaskList title="System: This Week" tasks={decision.week_tasks} />
          <div className="space-y-6">
            <section className="rounded-2xl border border-border bg-background/65 p-5">
              <p className="text-sm font-semibold text-foreground">Main Issue</p>
              <p className="mt-2 text-2xl font-semibold text-accent">{decision.main_issue}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{decision.reason}</p>
            </section>
            <ApplicationBalance balance={decision.application_balance} />
          </div>
        </div>
        <p className="mt-5 rounded-xl border border-border bg-background/65 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          System Analysis: {decision.system_analysis}
        </p>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Bell className="h-4 w-4 text-accent" />
            Recent Notifications
          </div>
          <StatusBadge tone={unreadCount ? "warning" : "neutral"}>{unreadCount} unread</StatusBadge>
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
              No notifications.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start gap-3">
          <ArrowRight className="mt-0.5 h-4 w-4 text-accent" />
          <p className="text-sm leading-relaxed text-muted-foreground">
            This page is intentionally separate from Dashboard so the daily overview stays fast. Advisor and Decision Engine only analyze and prioritize. You make the final decision.
          </p>
        </div>
      </section>
    </div>
  )
}
