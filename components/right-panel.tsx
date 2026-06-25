"use client"

import { AlertTriangle, Bell, CalendarClock, CheckCircle2 } from "lucide-react"
import {
  companies,
  events,
  companyName,
  daysUntil,
  formatDate,
  recentActivity,
  TODAY,
} from "@/lib/data"
import { StatusBadge } from "@/components/status-badge"

export function RightPanel() {
  const deadlines = companies
    .filter((c) => c.esDeadline && daysUntil(c.esDeadline) >= 0)
    .sort((a, b) => daysUntil(a.esDeadline!) - daysUntil(b.esDeadline!))
    .slice(0, 4)

  const upcoming = [...events]
    .filter((e) => daysUntil(e.start) >= 0)
    .sort((a, b) => daysUntil(a.start) - daysUntil(b.start))
    .slice(0, 4)

  return (
    <aside className="hidden w-80 shrink-0 flex-col gap-5 overflow-y-auto border-l border-border bg-background px-5 py-6 xl:flex">
      <div>
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <AlertTriangle className="h-4 w-4 text-warning" />
            ES締切 / Deadlines
          </h3>
          <span className="text-xs text-muted-foreground">{TODAY.getFullYear()}/{TODAY.getMonth() + 1}/{TODAY.getDate()}</span>
        </div>
        <div className="mt-3 space-y-2">
          {deadlines.map((c) => {
            const d = daysUntil(c.esDeadline!)
            const urgent = d <= 7
            return (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-xl border border-border bg-card p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-card-foreground">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(c.esDeadline!)} 締切</p>
                </div>
                <StatusBadge tone={urgent ? "danger" : "neutral"}>
                  {d === 0 ? "本日" : `${d}日`}
                </StatusBadge>
              </div>
            )
          })}
        </div>
      </div>

      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <CalendarClock className="h-4 w-4 text-accent" />
          予定 / Upcoming
        </h3>
        <div className="mt-3 space-y-3">
          {upcoming.map((e) => (
            <div key={e.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className="flex h-9 w-9 flex-col items-center justify-center rounded-lg bg-primary/5 text-[11px] font-semibold leading-none text-primary">
                  {formatDate(e.start)}
                </span>
                <span className="mt-1 h-full w-px bg-border" />
              </div>
              <div className="pb-1">
                <p className="text-sm font-medium text-foreground">{e.title}</p>
                <p className="text-xs text-muted-foreground">
                  {companyName(e.companyId)}
                  {e.time ? ` · ${e.time}` : ""}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Bell className="h-4 w-4 text-accent" />
          通知 / Activity
        </h3>
        <div className="mt-3 space-y-3">
          {recentActivity.slice(0, 4).map((a) => (
            <div key={a.id} className="flex gap-2.5">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-sm leading-snug text-foreground">
                  <span className="font-medium">{a.company}</span> — {a.text}
                </p>
                <p className="text-xs text-muted-foreground">{formatDate(a.date)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}
