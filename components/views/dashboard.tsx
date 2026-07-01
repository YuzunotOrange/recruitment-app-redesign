"use client"

import type { CSSProperties } from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarCheck,
  Clock,
  FileText,
  Flame,
  Gauge,
  GraduationCap,
  ListTodo,
  ShieldCheck,
  TrendingUp,
  Trophy,
} from "lucide-react"
import {
  companyStatusMeta,
  daysUntil,
  industryMeta,
  type CompanyStatus,
  type Industry,
} from "@/lib/data"
import { apiRequest } from "@/lib/api"
import { copy, formatLocalizedDate, secondaryText, text, useLanguagePreference, type LanguageMode } from "@/lib/language"
import { APP_DATA_REFRESH_EVENT } from "@/lib/notification-events"
import { StatusBadge } from "@/components/status-badge"
import type { ViewKey } from "@/components/sidebar"

type Tone = "neutral" | "info" | "success" | "warning" | "danger"

type DashboardSummary = {
  kpis: {
    total_companies: number
    es_in_review: number
    interviews: number
    awaiting: number
    offers: number
    deadline_soon: number
    internships?: number
    today_tasks?: number
  }
  company_status_counts: Partial<Record<CompanyStatus, number>>
  industry_counts: Partial<Record<Industry, number>>
  upcoming_events?: UpcomingEvent[]
  upcoming_deadlines?: UpcomingDeadline[]
  recent_activities?: RecentActivity[]
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

type RecentActivity = {
  id: number | string
  company?: string
  text: string
  date?: string
  occurred_at?: string
  tone?: Tone
}

const emptySummary: DashboardSummary = {
  kpis: {
    total_companies: 0,
    es_in_review: 0,
    interviews: 0,
    awaiting: 0,
    offers: 0,
    deadline_soon: 0,
    internships: 0,
    today_tasks: 0,
  },
  company_status_counts: {},
  industry_counts: {},
  upcoming_events: [],
  upcoming_deadlines: [],
  recent_activities: [],
}

const toneText: Record<Tone, string> = {
  info: "text-accent",
  warning: "text-warning-foreground",
  danger: "text-destructive",
  success: "text-success",
  neutral: "text-muted-foreground",
}

const toneBg: Record<Tone, string> = {
  info: "bg-accent/10",
  warning: "bg-warning/15",
  danger: "bg-destructive/10",
  success: "bg-success/10",
  neutral: "bg-muted",
}

const toneBar: Record<Tone, string> = {
  info: "bg-accent",
  warning: "bg-warning",
  danger: "bg-destructive",
  success: "bg-success",
  neutral: "bg-muted-foreground/40",
}

function StatusChart({
  counts,
  language,
}: {
  counts: Partial<Record<CompanyStatus, number>>
  language: LanguageMode
}) {
  const order = Object.keys(companyStatusMeta) as CompanyStatus[]
  const max = Math.max(...order.map((status) => counts[status] ?? 0), 1)

  return (
    <div className="space-y-3">
      {order.map((status) => {
        const meta = companyStatusMeta[status]
        const value = counts[status] ?? 0

        return (
          <div key={status} className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-xs text-muted-foreground">
              {text(language, meta)}
            </span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full ${toneBar[meta.tone]}`}
                style={{ width: `${(value / max) * 100}%` }}
              />
            </div>
            <span className="w-6 text-right text-xs font-medium tabular-nums text-foreground">{value}</span>
          </div>
        )
      })}
    </div>
  )
}

function IndustryDonut({
  counts,
  language,
}: {
  counts: Partial<Record<Industry, number>>
  language: LanguageMode
}) {
  const order: Industry[] = ["maker", "finance", "consulting", "it", "other"]
  const entries = order
    .map((industry) => ({ key: industry, value: counts[industry] ?? 0 }))
    .filter((entry) => entry.value > 0)
  const total = entries.reduce((sum, entry) => sum + entry.value, 0)
  const colors = ["bg-primary", "bg-accent", "bg-chart-3", "bg-success", "bg-warning"]

  let accumulated = 0
  const stops = entries.map((entry, index) => {
    const start = total ? (accumulated / total) * 100 : 0
    accumulated += entry.value
    const end = total ? (accumulated / total) * 100 : 100
    const color = ["var(--primary)", "var(--accent)", "var(--chart-3)", "var(--success)", "var(--warning)"][
      index % 5
    ]
    return `${color} ${start}% ${end}%`
  })

  return (
    <div className="flex items-center gap-5">
      <div
        className="relative h-28 w-28 shrink-0 rounded-full bg-muted"
        style={total ? { background: `conic-gradient(${stops.join(", ")})` } : undefined}
      >
        <div className="absolute inset-[18%] flex flex-col items-center justify-center rounded-full bg-card">
          <span className="text-xl font-semibold text-foreground">{total}</span>
          <span className="text-[10px] text-muted-foreground">
            {text(language, copy.kpiCompanies)}
          </span>
        </div>
      </div>
      <div className="flex-1 space-y-2">
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {text(language, copy.noIndustryData)}
          </p>
        ) : (
          entries.map((entry, index) => (
            <div key={entry.key} className="flex items-center gap-2 text-sm">
              <span className={`h-2.5 w-2.5 rounded-sm ${colors[index % 5]}`} />
              <span className="flex-1 text-muted-foreground">
                {text(language, industryMeta[entry.key])}
              </span>
              <span className="font-medium tabular-nums text-foreground">{entry.value}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function getEventDate(event: UpcomingEvent) {
  return event.start_at ?? event.start ?? ""
}

function getCompanyName(item: UpcomingEvent | UpcomingDeadline) {
  return item.company_name ?? item.company ?? "-"
}

function getDeadlineDate(deadline: UpcomingDeadline) {
  return deadline.es_deadline ?? deadline.deadline ?? ""
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value))
}

type CareerLevel = {
  level: string
  title: string
  description: { en: string; ja: string }
}

type ProgressScore = {
  readiness: number
  deadlineRisk: number
  weekActions: number
  incompleteTasks: number
  careerLevel: CareerLevel
  nextFocus: { en: string; ja: string }
}

function getCareerLevel(readiness: number, interviews: number, offers: number): CareerLevel {
  if (offers > 0 || readiness >= 86) {
    return {
      level: "Lv.5",
      title: "Edge",
      description: { en: "Offer-ready", ja: "内定射程圏" },
    }
  }

  if (interviews >= 2 || readiness >= 68) {
    return {
      level: "Lv.4",
      title: "Closer",
      description: { en: "Final push", ja: "詰めの段階" },
    }
  }

  if (readiness >= 50) {
    return {
      level: "Lv.3",
      title: "Runner",
      description: { en: "Selection running", ja: "選考進行中" },
    }
  }

  if (readiness >= 30) {
    return {
      level: "Lv.2",
      title: "Scout",
      description: { en: "Pipeline building", ja: "応募先拡大中" },
    }
  }

  return {
    level: "Lv.1",
    title: "Entry",
    description: { en: "Setup phase", ja: "準備フェーズ" },
  }
}

function getProgressScore(summary: DashboardSummary): ProgressScore {
  const counts = summary.company_status_counts
  const total = Math.max(summary.kpis.total_companies, 1)
  const planned = counts.planned ?? 0
  const esSubmitted = counts.es_submitted ?? 0
  const interviews = summary.kpis.interviews
  const offers = summary.kpis.offers
  const declined = counts.declined ?? 0
  const rejected = (counts.es_rejected ?? 0) + (counts.spi_rejected ?? 0)

  const eventsThisWeek = (summary.upcoming_events ?? []).filter((event) => {
    const date = getEventDate(event)
    if (!date) return false
    const days = daysUntil(date)
    return days >= 0 && days <= 7
  }).length

  const deadlinesThisWeek = (summary.upcoming_deadlines ?? []).filter((deadline) => {
    const date = getDeadlineDate(deadline)
    if (!date) return false
    const days = daysUntil(date)
    return days >= 0 && days <= 7
  }).length

  const nearestDeadlineRisk = (summary.upcoming_deadlines ?? []).reduce((risk, deadline) => {
    const date = getDeadlineDate(deadline)
    if (!date) return risk
    const days = daysUntil(date)

    if (days < 0) return risk
    if (days === 0) return Math.max(risk, 95)
    if (days <= 1) return Math.max(risk, 86)
    if (days <= 3) return Math.max(risk, 72)
    if (days <= 7) return Math.max(risk, 48)
    return Math.max(risk, 18)
  }, 0)

  const statusReadiness =
    (planned * 20 + esSubmitted * 50 + interviews * 76 + offers * 100 + declined * 82 + rejected * 18) / total
  const deadlineRisk = clamp(
    Math.round(nearestDeadlineRisk + summary.kpis.deadline_soon * 6 + (summary.kpis.today_tasks ?? 0) * 5),
  )
  const readiness = clamp(
    Math.round(
      statusReadiness * 0.68 +
        Math.min(18, eventsThisWeek * 5) +
        Math.min(10, (summary.kpis.internships ?? 0) * 2) +
        (deadlineRisk <= 30 ? 8 : deadlineRisk >= 75 ? -8 : 0),
    ),
  )
  const incompleteTasks = planned + esSubmitted + summary.kpis.deadline_soon + (summary.kpis.today_tasks ?? 0)
  const weekActions = eventsThisWeek + deadlinesThisWeek + (summary.kpis.today_tasks ?? 0) + esSubmitted
  const nextFocus =
    deadlineRisk >= 70
      ? { en: "Triage deadlines first", ja: "締切対応を最優先" }
      : readiness < 50
        ? { en: "Add applications and events", ja: "応募と予定を増やす" }
        : weekActions <= 1
          ? { en: "Schedule the next action", ja: "次の行動を予定化" }
          : { en: "Keep the selection pace", ja: "選考ペース維持" }

  return {
    readiness,
    deadlineRisk,
    weekActions,
    incompleteTasks,
    careerLevel: getCareerLevel(readiness, interviews, offers),
    nextFocus,
  }
}

function ScoreBar({ value, tone }: { value: number; tone: Tone }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-muted">
      <div className={`h-full rounded-full ${toneBar[tone]}`} style={{ width: `${clamp(value)}%` }} />
    </div>
  )
}

function ProgressScoreCard({
  label,
  sublabel,
  value,
  suffix,
  icon: Icon,
  tone,
  language,
}: {
  label: { en: string; ja: string }
  sublabel: { en: string; ja: string }
  value: number
  suffix?: string
  icon: typeof Gauge
  tone: Tone
  language: LanguageMode
}) {
  return (
    <div className="rounded-2xl border border-border bg-background/55 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${toneBg[tone]}`}>
          <Icon className={`h-5 w-5 ${toneText[tone]}`} />
        </div>
        <span className={`text-2xl font-semibold tabular-nums ${toneText[tone]}`}>
          {value}
          {suffix && <span className="text-sm">{suffix}</span>}
        </span>
      </div>
      <div className="mt-4 space-y-2">
        <div>
          <p className="text-sm font-semibold text-foreground">{text(language, label)}</p>
          <p className="text-xs text-muted-foreground">{text(language, sublabel)}</p>
        </div>
        {suffix === "%" && <ScoreBar value={value} tone={tone} />}
      </div>
    </div>
  )
}


export function Dashboard({ onNavigate }: { onNavigate: (view: ViewKey) => void }) {
  const [summary, setSummary] = useState<DashboardSummary>(emptySummary)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const language = useLanguagePreference()

  const loadSummary = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const data = await apiRequest<DashboardSummary>("/dashboard/summary")
      setSummary(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard.")
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

  const cards = useMemo(
    () => [
      {
        en: "Companies",
        ja: "企業",
        value: summary.kpis.total_companies,
        icon: Building2,
        tone: "info" as Tone,
      },
      {
        en: "ES in review",
        ja: "ES確認中",
        value: summary.kpis.es_in_review,
        icon: FileText,
        tone: "warning" as Tone,
      },
      {
        en: "Interviews",
        ja: "面接",
        value: summary.kpis.interviews,
        icon: CalendarCheck,
        tone: "info" as Tone,
      },
      {
        en: "Awaiting",
        ja: "応募予定",
        value: summary.kpis.awaiting,
        icon: Clock,
        tone: "neutral" as Tone,
      },
      {
        en: "Internships",
        ja: "インターン",
        value: summary.kpis.internships ?? 0,
        icon: GraduationCap,
        tone: "info" as Tone,
      },
      {
        en: "Offers",
        ja: "内定",
        value: summary.kpis.offers,
        icon: Trophy,
        tone: "success" as Tone,
      },
      {
        en: "Due <=7d",
        ja: "7日以内",
        value: summary.kpis.deadline_soon,
        icon: AlertTriangle,
        tone: "danger" as Tone,
      },
      {
        en: "Today",
        ja: "今日",
        value: summary.kpis.today_tasks ?? 0,
        icon: ListTodo,
        tone: "neutral" as Tone,
      },
    ],
    [summary],
  )

  const progressScore = useMemo(() => getProgressScore(summary), [summary])
  const upcoming = (summary.upcoming_events ?? []).slice(0, 5)
  const failedCount = (summary.company_status_counts.es_rejected ?? 0) + (summary.company_status_counts.spi_rejected ?? 0)
  const clearedCount = summary.kpis.interviews + summary.kpis.offers
  const totalCount = summary.kpis.total_companies
  const clearRate = totalCount > 0 ? Math.min(100, Math.round((clearedCount / totalCount) * 100)) : 0
  const hudRingStyle = { "--cyber-clear": `${clearRate}%` } as CSSProperties

  return (
    <div className="space-y-6">
      <div className="cyber-hero" aria-hidden="true">
        <span>BECOME A</span>
        <span><span className="cyber-glitch" data-text="LEGEND">LEGEND</span> IN</span>
        <span className="cyber-hero-cyan">NIGHT CITY.</span>
      </div>

      <div className="cyber-status-hud rounded-2xl border border-border bg-card p-5">
        <div className="cyber-hud-copy">
          <p className="cyber-hud-kicker">STREET RECRUIT PROTOCOL // v2.077</p>
          <h2>
            CLEAR THE <span>SELECTION GRID</span>.
          </h2>
          <p>
            企業との交渉を可視化し、直近予定とステータスをスキャンします。
          </p>
        </div>
        <div className="cyber-hud-panel">
          <div className="cyber-hud-ring" style={hudRingStyle}>
            <div>
              <span className="cyber-flicker">{clearRate}%</span>
              <small>CLEAR RATE</small>
            </div>
          </div>
          <div className="cyber-hud-stats">
            <div>
              <span className="cyber-flicker">{totalCount}</span>
              <small>GIGS</small>
            </div>
            <div>
              <span className="cyber-flicker">{summary.kpis.awaiting}</span>
              <small>PENDING</small>
            </div>
            <div>
              <span className="cyber-flicker">{clearedCount}</span>
              <small>CLEARED</small>
            </div>
            <div>
              <span className="cyber-flicker">{failedCount}</span>
              <small>FAILED</small>
            </div>
          </div>
        </div>
      </div>

      {loading && (
        <div className="rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          {text(language, copy.loadingDashboard)}
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
              <ShieldCheck className="h-4 w-4" />
              <span>Career Progress Score</span>
            </div>
            <h3 className="mt-2 text-lg font-semibold text-foreground">就活進捗スコア</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {text(language, progressScore.nextFocus)}
            </p>
          </div>
          <div className="rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-left sm:min-w-52 sm:text-right">
            <p className="text-xs font-medium text-muted-foreground">Career Level</p>
            <p className="text-2xl font-semibold text-accent">
              {progressScore.careerLevel.level} {progressScore.careerLevel.title}
            </p>
            <p className="text-xs text-muted-foreground">
              {text(language, progressScore.careerLevel.description)}
            </p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <ProgressScoreCard
            label={{ en: "Application readiness", ja: "応募準備度" }}
            sublabel={{ en: "Based on status and upcoming actions", ja: "企業ステータスと直近行動から算出" }}
            value={progressScore.readiness}
            suffix="%"
            icon={Gauge}
            tone="success"
            language={language}
          />
          <ProgressScoreCard
            label={{ en: "Deadline risk", ja: "締切リスク" }}
            sublabel={{ en: "ES deadlines, due tasks, and proximity", ja: "ES締切・未完了・近さを反映" }}
            value={progressScore.deadlineRisk}
            suffix="%"
            icon={Flame}
            tone={progressScore.deadlineRisk >= 70 ? "danger" : progressScore.deadlineRisk >= 45 ? "warning" : "info"}
            language={language}
          />
          <ProgressScoreCard
            label={{ en: "This week's actions", ja: "今週の行動数" }}
            sublabel={{ en: "Events, deadlines, tasks, and ES flow", ja: "予定・締切・タスク・ES進行の合計" }}
            value={progressScore.weekActions}
            icon={Activity}
            tone="info"
            language={language}
          />
          <ProgressScoreCard
            label={{ en: "Open tasks", ja: "未完了タスク" }}
            sublabel={{ en: "Planned, ES, deadlines, and today", ja: "応募予定・ES・締切・今日の残数" }}
            value={progressScore.incompleteTasks}
            icon={ListTodo}
            tone={progressScore.incompleteTasks > 5 ? "warning" : "neutral"}
            language={language}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon

          return (
            <div
              key={card.en}
              className="rounded-2xl border border-border bg-card p-4 transition-shadow hover:shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${toneBg[card.tone]}`}>
                  <Icon className={`h-[18px] w-[18px] ${toneText[card.tone]}`} />
                </div>
                <span className={`cyber-flicker text-2xl font-semibold tabular-nums ${toneText[card.tone]}`}>{card.value}</span>
              </div>
              <p className="mt-3 text-sm font-medium text-card-foreground">
                {text(language, card)}
              </p>
              {secondaryText(language, card) && (
                <p className="text-xs text-muted-foreground">{secondaryText(language, card)}</p>
              )}
            </div>
          )
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                {text(language, copy.recruitmentStatus)}
              </h3>
              <p className="text-xs text-muted-foreground">
                {text(language, copy.recruitmentStatusBreakdown)}
              </p>
            </div>
            <TrendingUp className="h-4 w-4 text-accent" />
          </div>
          <StatusChart counts={summary.company_status_counts} language={language} />
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-foreground">
              {text(language, copy.industries)}
            </h3>
            <p className="text-xs text-muted-foreground">{text(language, copy.byIndustry)}</p>
          </div>
          <IndustryDonut counts={summary.industry_counts} language={language} />
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {text(language, copy.upcomingEvents)}
            </h3>
            <p className="text-xs text-muted-foreground">
              {text(language, copy.upcomingSchedule)}
            </p>
          </div>
          <button
            onClick={() => onNavigate("events")}
            className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
          >
            {text(language, copy.viewAll)} <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
        {upcoming.length === 0 ? (
          <div className="px-5 py-8 text-sm text-muted-foreground">
            {text(language, copy.noUpcomingEvents)}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {upcoming.map((event) => {
              const date = getEventDate(event)
              const days = date ? daysUntil(date) : 0

              return (
                <div key={event.id} className="flex items-center gap-4 px-5 py-3 text-sm">
                  <span className="w-14 shrink-0 font-medium tabular-nums text-muted-foreground">
                    {date ? formatLocalizedDate(date, language) : "-"}
                  </span>
                  <span className="w-40 shrink-0 truncate font-medium text-foreground">{getCompanyName(event)}</span>
                  <span className="flex-1 truncate text-foreground">{event.title}</span>
                  <span className="hidden text-muted-foreground sm:block">{event.time ?? "-"}</span>
                  <StatusBadge tone={days <= 7 ? "warning" : "neutral"}>
                    {days === 0 ? text(language, copy.kpiToday) : `${days}d`}
                  </StatusBadge>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
