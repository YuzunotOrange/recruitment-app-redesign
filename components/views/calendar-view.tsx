"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { apiRequest } from "@/lib/api"
import {
  copy,
  formatCalendarMonth,
  formatCalendarWeek,
  text,
  useLanguagePreference,
  weekdayLabels,
  type LanguageMode,
} from "@/lib/language"
import { TODAY } from "@/lib/data"

type EventType = "briefing" | "interview" | "test" | "deadline" | "intern" | "other"

type ApiEvent = {
  id: number
  company_name: string | null
  title: string
  start_date: string
  end_date: string
  type: EventType
}

type CalItem = {
  id: string
  title: string
  company: string
  tone: string
  date: string
}

const DAY = 1000 * 60 * 60 * 24

const dot: Record<string, string> = {
  info: "bg-accent",
  warning: "bg-warning",
  danger: "bg-destructive",
  success: "bg-success",
  neutral: "bg-primary",
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function toneForType(type: EventType) {
  if (type === "deadline") return "danger"
  if (type === "test") return "warning"
  if (type === "intern") return "success"
  if (type === "other") return "neutral"
  return "info"
}

function parseIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(year, month - 1, day)
}

function formatIsoDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function datesBetween(start: string, end: string) {
  const dates: string[] = []
  const cursor = parseIsoDate(start)
  const endDate = parseIsoDate(end || start)

  while (cursor.getTime() <= endDate.getTime()) {
    dates.push(formatIsoDate(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }

  return dates
}

function MonthView({ cursor, items, language }: { cursor: Date; items: CalItem[]; language: LanguageMode }) {
  const weekdays = weekdayLabels(language)
  const grid = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
    const startOffset = first.getDay()
    const gridStart = new Date(first.getTime() - startOffset * DAY)
    return Array.from({ length: 42 }, (_, index) => new Date(gridStart.getTime() + index * DAY))
  }, [cursor])

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="grid grid-cols-7 border-b border-border bg-muted/50 text-center text-xs font-medium">
        {weekdays.map((weekday, index) => (
          <div
            key={weekday}
            className={`py-2 ${index === 0 ? "text-destructive" : index === 6 ? "text-accent" : "text-muted-foreground"}`}
          >
            {weekday}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {grid.map((day, index) => {
          const inMonth = day.getMonth() === cursor.getMonth()
          const today = isSameDay(day, TODAY)
          const dayItems = items.filter((item) => isSameDay(parseIsoDate(item.date), day))

          return (
            <div
              key={index}
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
                  {day.getDate()}
                </span>
              </div>
              <div className="mt-1">
                {dayItems.length > 0 && (
                  <div className="flex flex-wrap items-center justify-center gap-0.5 sm:hidden">
                    {dayItems.slice(0, 3).map((item) => (
                      <span
                        key={item.id}
                        className={`h-1.5 w-1.5 rounded-full ${dot[item.tone]}`}
                        title={`${item.company} - ${item.title}`}
                      />
                    ))}
                    {dayItems.length > 3 && (
                      <span className="text-[9px] leading-none text-muted-foreground">+{dayItems.length - 3}</span>
                    )}
                  </div>
                )}
              </div>
              <div className="mt-1 hidden space-y-1 sm:block">
                {dayItems.slice(0, 3).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-1 rounded bg-muted/60 px-1 py-0.5"
                    title={`${item.company} - ${item.title}`}
                  >
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot[item.tone]}`} />
                    <span className="truncate text-[10px] text-foreground">{item.title}</span>
                  </div>
                ))}
                {dayItems.length > 3 && <span className="text-[10px] text-muted-foreground">+{dayItems.length - 3}</span>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function WeekView({ cursor, items, language }: { cursor: Date; items: CalItem[]; language: LanguageMode }) {
  const weekdays = weekdayLabels(language)
  const days = useMemo(() => {
    const start = new Date(cursor.getTime() - cursor.getDay() * DAY)
    return Array.from({ length: 7 }, (_, index) => new Date(start.getTime() + index * DAY))
  }, [cursor])

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
      {days.map((day, index) => {
        const today = isSameDay(day, TODAY)
        const dayItems = items.filter((item) => isSameDay(parseIsoDate(item.date), day))

        return (
          <div key={index} className="rounded-2xl border border-border bg-card p-3">
            <div className="flex items-center justify-between">
              <span className={`text-xs ${day.getDay() === 0 ? "text-destructive" : day.getDay() === 6 ? "text-accent" : "text-muted-foreground"}`}>
                {weekdays[day.getDay()]}
              </span>
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                  today ? "bg-primary font-semibold text-primary-foreground" : "text-foreground"
                }`}
              >
                {day.getDate()}
              </span>
            </div>
            <div className="mt-2 space-y-1.5">
              {dayItems.length === 0 && <p className="text-[11px] text-muted-foreground/60">-</p>}
              {dayItems.map((item) => (
                <div key={item.id} className="rounded-lg bg-muted/60 p-1.5">
                  <div className="flex items-center gap-1">
                    <span className={`h-1.5 w-1.5 rounded-full ${dot[item.tone]}`} />
                    <span className="truncate text-[11px] font-medium text-foreground">{item.title}</span>
                  </div>
                  <p className="truncate text-[10px] text-muted-foreground">{item.company}</p>
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
  const [events, setEvents] = useState<ApiEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const language = useLanguagePreference()

  useEffect(() => {
    let active = true

    async function loadEvents() {
      setLoading(true)
      setError(null)

      try {
        const data = await apiRequest<ApiEvent[]>("/events")
        if (active) setEvents(data)
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Failed to load calendar.")
      } finally {
        if (active) setLoading(false)
      }
    }

    loadEvents()

    return () => {
      active = false
    }
  }, [])

  const items = useMemo<CalItem[]>(
    () =>
      events.flatMap((event) =>
        datesBetween(event.start_date, event.end_date).map((date) => ({
          id: `${event.id}-${date}`,
          title: event.title,
          company: event.company_name ?? "No company",
          tone: toneForType(event.type),
          date,
        })),
      ),
    [events],
  )

  const step = (dir: number) => {
    setCursor((prev) => {
      const next = new Date(prev)
      if (mode === "month") next.setMonth(next.getMonth() + dir)
      else next.setDate(next.getDate() + dir * 7)
      return next
    })
  }

  const label = mode === "month" ? formatCalendarMonth(cursor, language) : formatCalendarWeek(cursor, language)

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
            {text(language, copy.kpiToday)}
          </button>
        </div>
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {(["month", "week"] as const).map((nextMode) => (
            <button
              key={nextMode}
              onClick={() => setMode(nextMode)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                mode === nextMode ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              {nextMode === "month" ? text(language, { en: "Month", ja: "月" }) : text(language, { en: "Week", ja: "週" })}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-5 py-4 text-sm text-destructive">{error}</div>}
      {loading ? (
        <div className="rounded-2xl border border-border bg-card px-5 py-8 text-sm text-muted-foreground">
          {text(language, { en: "Loading calendar...", ja: "カレンダーを読み込み中..." })}
        </div>
      ) : null}
      {!loading && items.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card px-5 py-8 text-sm text-muted-foreground">
          {text(language, { en: "No calendar items yet.", ja: "カレンダー項目はまだありません。" })}
        </div>
      ) : null}
      {!loading &&
        (mode === "month" ? (
          <MonthView cursor={cursor} items={items} language={language} />
        ) : (
          <WeekView cursor={cursor} items={items} language={language} />
        ))}
    </div>
  )
}
