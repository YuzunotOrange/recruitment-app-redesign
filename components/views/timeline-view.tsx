"use client"

import { useMemo, useState } from "react"
import { internships, companyName, priorityMeta, internStatusMeta } from "@/lib/data"
import { PriorityBadge } from "@/components/status-badge"

const DAY = 1000 * 60 * 60 * 24

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

const barTone: Record<string, string> = {
  danger: "bg-destructive",
  warning: "bg-warning",
  info: "bg-accent",
  neutral: "bg-primary",
}

export function TimelineView() {
  const [scope] = useState<"intern">("intern")

  const { days, rangeStart, totalDays, months } = useMemo(() => {
    const starts = internships.map((i) => new Date(i.start).getTime())
    const ends = internships.map((i) => new Date(i.end).getTime())
    const min = startOfDay(new Date(Math.min(...starts)))
    const max = startOfDay(new Date(Math.max(...ends)))
    // pad a couple days
    const rangeStart = new Date(min.getTime() - 2 * DAY)
    const totalDays = Math.round((max.getTime() - rangeStart.getTime()) / DAY) + 3
    const days = Array.from({ length: totalDays }, (_, idx) => new Date(rangeStart.getTime() + idx * DAY))
    // month spans
    const months: { label: string; span: number }[] = []
    days.forEach((d) => {
      const label = `${d.getFullYear()}年${d.getMonth() + 1}月`
      const last = months[months.length - 1]
      if (last && last.label === label) last.span += 1
      else months.push({ label, span: 1 })
    })
    return { days, rangeStart, totalDays, months }
  }, [scope])

  const rows = useMemo(
    () => [...internships].sort((a, b) => a.rank - b.rank || a.start.localeCompare(b.start)),
    [],
  )

  const COL = 34 // px per day
  const LABEL = 280

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm bg-accent" /> 開催期間
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-px bg-destructive" /> 本日 (6/25)
        </span>
        <span className="ml-auto">インターン日程 · Gantt</span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="overflow-x-auto">
          <div style={{ minWidth: LABEL + totalDays * COL }}>
            {/* Month header */}
            <div className="flex border-b border-border bg-primary text-primary-foreground">
              <div
                className="shrink-0 px-4 py-2 text-xs font-semibold"
                style={{ width: LABEL }}
              >
                プログラム / 企業
              </div>
              <div className="flex">
                {months.map((m, i) => (
                  <div
                    key={i}
                    className="border-l border-primary-foreground/20 px-2 py-2 text-xs font-medium"
                    style={{ width: m.span * COL }}
                  >
                    {m.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Day header */}
            <div className="flex border-b border-border bg-muted/60">
              <div className="shrink-0" style={{ width: LABEL }} />
              <div className="flex">
                {days.map((d, i) => {
                  const weekend = d.getDay() === 0 || d.getDay() === 6
                  return (
                    <div
                      key={i}
                      className={`flex flex-col items-center justify-center border-l border-border py-1 text-[10px] ${
                        weekend ? "bg-destructive/5 text-destructive" : "text-muted-foreground"
                      }`}
                      style={{ width: COL }}
                    >
                      <span className="font-medium tabular-nums">{d.getDate()}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Rows */}
            <div>
              {rows.map((i, idx) => {
                const s = startOfDay(new Date(i.start))
                const e = startOfDay(new Date(i.end))
                const offset = Math.round((s.getTime() - rangeStart.getTime()) / DAY)
                const span = Math.round((e.getTime() - s.getTime()) / DAY) + 1
                const tone = priorityMeta[i.priority].tone
                return (
                  <div
                    key={i.id}
                    className={`flex items-center ${idx % 2 ? "bg-muted/20" : ""} hover:bg-muted/40`}
                  >
                    <div
                      className="flex shrink-0 items-center gap-2 px-4 py-2.5"
                      style={{ width: LABEL }}
                    >
                      <PriorityBadge priority={i.priority} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{i.program}</p>
                        <p className="truncate text-xs text-muted-foreground">{companyName(i.companyId)}</p>
                      </div>
                    </div>
                    <div className="relative flex h-12 items-center" style={{ width: totalDays * COL }}>
                      {/* weekend grid */}
                      {days.map((d, di) => {
                        const weekend = d.getDay() === 0 || d.getDay() === 6
                        return (
                          <div
                            key={di}
                            className={`h-full border-l border-border/60 ${weekend ? "bg-destructive/5" : ""}`}
                            style={{ width: COL }}
                          />
                        )
                      })}
                      <div
                        className={`absolute flex h-6 items-center rounded-md px-2 text-[10px] font-medium text-primary-foreground shadow-sm ${barTone[tone]}`}
                        style={{ left: offset * COL + 2, width: span * COL - 4 }}
                        title={`${i.program} (${i.start} – ${i.end})`}
                      >
                        <span className="truncate">{internStatusMeta[i.status].ja}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
