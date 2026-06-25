"use client"

import {
  Building2,
  FileText,
  CalendarCheck,
  Clock,
  GraduationCap,
  Trophy,
  AlertTriangle,
  ListTodo,
  ArrowRight,
  TrendingUp,
} from "lucide-react"
import {
  companies,
  events,
  internships,
  companyStatusMeta,
  companyName,
  formatDate,
  daysUntil,
  industryMeta,
  type Industry,
} from "@/lib/data"
import { StatusBadge } from "@/components/status-badge"
import type { ViewKey } from "@/components/sidebar"

const kpis = (() => {
  const total = companies.length
  const esInReview = companies.filter((c) => c.status === "es_submitted").length
  const interviews = companies.filter((c) => c.status === "interview").length
  const waiting = companies.filter((c) => c.status === "es_submitted" || c.status === "interview").length
  const offers = companies.filter((c) => c.status === "offer").length
  const deadlineSoon = companies.filter(
    (c) => c.esDeadline && daysUntil(c.esDeadline) >= 0 && daysUntil(c.esDeadline) <= 7,
  ).length
  const internCount = internships.length
  return { total, esInReview, interviews, waiting, offers, deadlineSoon, internCount }
})()

const cards = [
  { label: "応募企業数", en: "Companies", value: kpis.total, icon: Building2, tone: "info" as const },
  { label: "ES提出中", en: "ES in review", value: kpis.esInReview, icon: FileText, tone: "warning" as const },
  { label: "面接予定数", en: "Interviews", value: kpis.interviews, icon: CalendarCheck, tone: "info" as const },
  { label: "結果待ち", en: "Awaiting", value: kpis.waiting, icon: Clock, tone: "neutral" as const },
  { label: "インターン数", en: "Internships", value: kpis.internCount, icon: GraduationCap, tone: "info" as const },
  { label: "内定数", en: "Offers", value: kpis.offers, icon: Trophy, tone: "success" as const },
  { label: "締切7日以内", en: "Due ≤7d", value: kpis.deadlineSoon, icon: AlertTriangle, tone: "danger" as const },
  { label: "今日のタスク", en: "Today", value: 0, icon: ListTodo, tone: "neutral" as const },
]

const toneText: Record<string, string> = {
  info: "text-accent",
  warning: "text-warning-foreground",
  danger: "text-destructive",
  success: "text-success",
  neutral: "text-muted-foreground",
}
const toneBg: Record<string, string> = {
  info: "bg-accent/10",
  warning: "bg-warning/15",
  danger: "bg-destructive/10",
  success: "bg-success/10",
  neutral: "bg-muted",
}

function StatusChart() {
  const counts = companies.reduce<Record<string, number>>((acc, c) => {
    acc[c.status] = (acc[c.status] ?? 0) + 1
    return acc
  }, {})
  const order = Object.keys(companyStatusMeta) as (keyof typeof companyStatusMeta)[]
  const max = Math.max(...order.map((s) => counts[s] ?? 0), 1)
  const toneBar: Record<string, string> = {
    info: "bg-accent",
    warning: "bg-warning",
    danger: "bg-destructive",
    success: "bg-success",
    neutral: "bg-muted-foreground/40",
  }
  return (
    <div className="space-y-3">
      {order.map((s) => {
        const meta = companyStatusMeta[s]
        const v = counts[s] ?? 0
        return (
          <div key={s} className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-xs text-muted-foreground">{meta.ja}</span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full ${toneBar[meta.tone]}`}
                style={{ width: `${(v / max) * 100}%` }}
              />
            </div>
            <span className="w-6 text-right text-xs font-medium tabular-nums text-foreground">{v}</span>
          </div>
        )
      })}
    </div>
  )
}

function IndustryDonut() {
  const counts = companies.reduce<Record<string, number>>((acc, c) => {
    acc[c.industry] = (acc[c.industry] ?? 0) + 1
    return acc
  }, {})
  const entries = (Object.keys(counts) as Industry[]).map((k) => ({ k, v: counts[k] }))
  const total = companies.length
  const colors = ["bg-primary", "bg-accent", "bg-chart-3", "bg-success", "bg-warning"]
  let acc = 0
  const stops = entries.map((e, i) => {
    const start = (acc / total) * 100
    acc += e.v
    const end = (acc / total) * 100
    const c = ["var(--primary)", "var(--accent)", "var(--chart-3)", "var(--success)", "var(--warning)"][i % 5]
    return `${c} ${start}% ${end}%`
  })
  return (
    <div className="flex items-center gap-5">
      <div
        className="relative h-28 w-28 shrink-0 rounded-full"
        style={{ background: `conic-gradient(${stops.join(", ")})` }}
      >
        <div className="absolute inset-[18%] flex flex-col items-center justify-center rounded-full bg-card">
          <span className="text-xl font-semibold text-foreground">{total}</span>
          <span className="text-[10px] text-muted-foreground">社</span>
        </div>
      </div>
      <div className="flex-1 space-y-2">
        {entries.map((e, i) => (
          <div key={e.k} className="flex items-center gap-2 text-sm">
            <span className={`h-2.5 w-2.5 rounded-sm ${colors[i % 5]}`} />
            <span className="flex-1 text-muted-foreground">{industryMeta[e.k].ja}</span>
            <span className="font-medium tabular-nums text-foreground">{e.v}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function Dashboard({ onNavigate }: { onNavigate: (v: ViewKey) => void }) {
  const upcoming = [...events]
    .filter((e) => daysUntil(e.start) >= 0)
    .sort((a, b) => daysUntil(a.start) - daysUntil(b.start))
    .slice(0, 5)

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon
          return (
            <div
              key={c.label}
              className="rounded-2xl border border-border bg-card p-4 transition-shadow hover:shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${toneBg[c.tone]}`}>
                  <Icon className={`h-[18px] w-[18px] ${toneText[c.tone]}`} />
                </div>
                <span className={`text-2xl font-semibold tabular-nums ${toneText[c.tone]}`}>{c.value}</span>
              </div>
              <p className="mt-3 text-sm font-medium text-card-foreground">{c.label}</p>
              <p className="text-xs text-muted-foreground">{c.en}</p>
            </div>
          )
        })}
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">選考ステータス分布</h3>
              <p className="text-xs text-muted-foreground">Recruitment status breakdown</p>
            </div>
            <TrendingUp className="h-4 w-4 text-accent" />
          </div>
          <StatusChart />
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-foreground">業界別</h3>
            <p className="text-xs text-muted-foreground">By industry</p>
          </div>
          <IndustryDonut />
        </div>
      </div>

      {/* Upcoming events table */}
      <div className="rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">直近イベント一覧</h3>
            <p className="text-xs text-muted-foreground">Upcoming events</p>
          </div>
          <button
            onClick={() => onNavigate("events")}
            className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
          >
            すべて見る <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="divide-y divide-border">
          {upcoming.map((e) => (
            <div key={e.id} className="flex items-center gap-4 px-5 py-3 text-sm">
              <span className="w-14 shrink-0 font-medium tabular-nums text-muted-foreground">
                {formatDate(e.start)}
              </span>
              <span className="w-40 shrink-0 truncate font-medium text-foreground">
                {companyName(e.companyId)}
              </span>
              <span className="flex-1 truncate text-foreground">{e.title}</span>
              <span className="hidden text-muted-foreground sm:block">{e.time ?? "—"}</span>
              <StatusBadge tone={daysUntil(e.start) <= 7 ? "warning" : "neutral"}>
                {daysUntil(e.start) === 0 ? "本日" : `${daysUntil(e.start)}日後`}
              </StatusBadge>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
