"use client"

import type { CSSProperties } from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarCheck,
  Clock,
  FileText,
  GraduationCap,
  ListTodo,
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
