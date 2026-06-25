"use client"

import { useMemo, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { events, internships, companyName, TODAY } from "@/lib/data"

const DAY = 1000 * 60 * 60 * 24
const weekdays = ["日", "月", "火", "水", "木", "金", "土"]

type CalItem = { title: string; company: string; tone: string; date: string }

const allItems: CalItem[] = [
  ...events.map((e) => ({
    title: e.title,
    company: companyName(e.companyId),
    tone: e.type === "deadline" ? "danger" : e.type === "test" ? "warning" : "info",
    date: e.start,
  })),
  ...internships.map((i) => ({
    title: i.program,
    company: companyName(i.companyId),
    tone: "success",
    date: i.start,
  })),
]

const dot: Record<string, string> = {
  info: "bg-accent",
  warning: "bg-warning",
  danger: "bg-destructive",
  success: "bg-success",
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function MonthView({ cursor }: { cursor: Date }) {
  const grid = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
    const startOffset = first.getDay()
    const gridStart = new Date(first.getTime() - startOffset * DAY)
    return Array.from({ length: 42 }, (_, i) => new Date(gridStart.getTime() + i * DAY))
  }, [cursor])

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="grid grid-cols-7 border-b border-border bg-muted/50 text-center text-xs font-medium">
        {weekdays.map((w, i) => (
          <div
            key={w}
            className={`py-2 ${i === 0 ? "text-destructive" : i === 6 ? "text-accent" : "text-muted-foreground"}`}
          >
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {grid.map((d, i) => {
          const inMonth = d.getMonth() === cursor.getMonth()
          const today = isSameDay(d, TODAY)
          const items = allItems.filter((it) => isSameDay(new Date(it.date), d))
          return (
            <div
              key={i}
              className={`min-h-24 border-b border-l border-border p-1.5 first:border-l-0 [&:nth-child(7n+1)]:border-l-0 ${
                inMonth ? "" : "bg-muted/30"
              }`}
            >
              <div className="flex justify-end">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                    today
                      ? "bg-primary font-semibold text-primary-foreground"
                      : inMonth
                        ? "text-foreground"
                        : "text-muted-foreground/50"
                  }`}
                >
                  {d.getDate()}
                </span>
              </div>
              <div className="mt-1 space-y-1">
                {items.slice(0, 3).map((it, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-1 rounded bg-muted/60 px-1 py-0.5"
                    title={`${it.company} — ${it.title}`}
                  >
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot[it.tone]}`} />
                    <span className="truncate text-[10px] text-foreground">{it.title}</span>
                  </div>
                ))}
                {items.length > 3 && (
                  <span className="text-[10px] text-muted-foreground">+{items.length - 3}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function WeekView({ cursor }: { cursor: Date }) {
  const days = useMemo(() => {
    const start = new Date(cursor.getTime() - cursor.getDay() * DAY)
    return Array.from({ length: 7 }, (_, i) => new Date(start.getTime() + i * DAY))
  }, [cursor])

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
      {days.map((d, i) => {
        const today = isSameDay(d, TODAY)
        const items = allItems.filter((it) => isSameDay(new Date(it.date), d))
        return (
          <div key={i} className="rounded-2xl border border-border bg-card p-3">
            <div className="flex items-center justify-between">
              <span className={`text-xs ${d.getDay() === 0 ? "text-destructive" : d.getDay() === 6 ? "text-accent" : "text-muted-foreground"}`}>
                {weekdays[d.getDay()]}
              </span>
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                  today ? "bg-primary font-semibold text-primary-foreground" : "text-foreground"
                }`}
              >
                {d.getDate()}
              </span>
            </div>
            <div className="mt-2 space-y-1.5">
              {items.length === 0 && <p className="text-[11px] text-muted-foreground/60">—</p>}
              {items.map((it, idx) => (
                <div key={idx} className="rounded-lg bg-muted/60 p-1.5">
                  <div className="flex items-center gap-1">
                    <span className={`h-1.5 w-1.5 rounded-full ${dot[it.tone]}`} />
                    <span className="truncate text-[11px] font-medium text-foreground">{it.title}</span>
                  </div>
                  <p className="truncate text-[10px] text-muted-foreground">{it.company}</p>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function CalendarView() {
  const [mode, setMode] = useState<"month" | "week">("month")
  const [cursor, setCursor] = useState(new Date(TODAY))

  const step = (dir: number) => {
    setCursor((prev) => {
      const next = new Date(prev)
      if (mode === "month") next.setMonth(next.getMonth() + dir)
      else next.setDate(next.getDate() + dir * 7)
      return next
    })
  }

  const label =
    mode === "month"
      ? `${cursor.getFullYear()}年 ${cursor.getMonth() + 1}月`
      : `${cursor.getFullYear()}年 ${cursor.getMonth() + 1}月 第${Math.ceil(cursor.getDate() / 7)}週`

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => step(-1)} className="rounded-lg border border-border bg-card p-1.5 text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-36 text-center text-sm font-semibold text-foreground">{label}</span>
          <button onClick={() => step(1)} className="rounded-lg border border-border bg-card p-1.5 text-muted-foreground hover:text-foreground">
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => setCursor(new Date(TODAY))}
            className="ml-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            今日
          </button>
        </div>
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {(["month", "week"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                mode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              {m === "month" ? "月" : "週"}
            </button>
          ))}
        </div>
      </div>
      {mode === "month" ? <MonthView cursor={cursor} /> : <WeekView cursor={cursor} />}
    </div>
  )
}
