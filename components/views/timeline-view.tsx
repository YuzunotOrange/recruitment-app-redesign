"use client"

import { useEffect, useMemo, useState } from "react"
import { apiRequest } from "@/lib/api"
import { formatCalendarMonth, formatLocalizedDate, text, useLanguagePreference } from "@/lib/language"

type EventType = "briefing" | "interview" | "test" | "deadline" | "intern" | "offer" | "other"

type ApiEvent = {
  id: number
  company_name: string | null
  title: string
  start_date: string
  end_date: string
  start_time?: string | null
  type: EventType
  note?: string | null
}

const DAY = 1000 * 60 * 60 * 24
const COL = 34
const LABEL_WIDTH = "clamp(12rem, 26vw, 17.5rem)"

const typeTone: Record<EventType, string> = {
  briefing: "bg-accent",
  interview: "bg-accent",
  test: "bg-warning",
  deadline: "bg-destructive",
  intern: "bg-success",
  offer: "bg-success",
  other: "bg-primary",
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function safeDate(value: string) {
  const [year, month, day] = value.split("-").map(Number)
  const date = year && month && day ? new Date(year, month - 1, day) : new Date(value)
  return Number.isNaN(date.getTime()) ? new Date() : date
}

export function TimelineView() {
  const [events, setEvents] = useState<ApiEvent[]>([])
  const [selectedEvent, setSelectedEvent] = useState<ApiEvent | null>(null)
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
        if (active) setError(err instanceof Error ? err.message : "Failed to load timeline.")
      } finally {
        if (active) setLoading(false)
      }
    }

    loadEvents()

    return () => {
      active = false
    }
  }, [])

  const rows = useMemo(
    () => [...events].sort((a, b) => a.start_date.localeCompare(b.start_date) || a.title.localeCompare(b.title)),
    [events],
  )

  const { days, rangeStart, totalDays, months } = useMemo(() => {
    const today = startOfDay(new Date())

    if (rows.length === 0) {
      const rangeStart = new Date(today.getTime() - 2 * DAY)
      const totalDays = 14
      const days = Array.from({ length: totalDays }, (_, index) => new Date(rangeStart.getTime() + index * DAY))
      return { days, rangeStart, totalDays, months: [{ label: formatCalendarMonth(today, language), span: totalDays }] }
    }

    const starts = rows.map((event) => startOfDay(safeDate(event.start_date)).getTime())
    const ends = rows.map((event) => startOfDay(safeDate(event.end_date || event.start_date)).getTime())
    const min = startOfDay(new Date(Math.min(...starts)))
    const max = startOfDay(new Date(Math.max(...ends)))
    const rangeStart = new Date(min.getTime() - 2 * DAY)
    const totalDays = Math.max(Math.round((max.getTime() - rangeStart.getTime()) / DAY) + 3, 14)
    const days = Array.from({ length: totalDays }, (_, index) => new Date(rangeStart.getTime() + index * DAY))
    const months: { label: string; span: number }[] = []

    days.forEach((day) => {
      const label = formatCalendarMonth(day, language)
      const last = months[months.length - 1]
      if (last && last.label === label) last.span += 1
      else months.push({ label, span: 1 })
    })

    return { days, rangeStart, totalDays, months }
  }, [language, rows])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm bg-accent" />
          {text(language, { en: "Duration", ja: "開催期間" })}
        </span>
        <span className="ml-auto">{text(language, { en: "Events timeline - Gantt", ja: "イベントタイムライン - ガント" })}</span>
      </div>

      {error && <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-5 py-4 text-sm text-destructive">{error}</div>}

      <div className="space-y-3 md:hidden" data-mobile-timeline-list>
        {loading ? (
          <div className="rounded-2xl border border-border bg-card px-5 py-8 text-sm text-muted-foreground">{text(language, { en: "Loading timeline...", ja: "読み込み中..." })}</div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card px-5 py-8 text-sm text-muted-foreground">{text(language, { en: "No timeline items yet.", ja: "タイムライン項目はまだありません。" })}</div>
        ) : (
          rows.map((event) => (
            <button key={event.id} type="button" onClick={() => setSelectedEvent(event)} className="w-full rounded-2xl border border-border bg-card p-4 text-left">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-foreground">{event.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{event.company_name ?? text(language, { en: "No company", ja: "企業なし" })}</p>
                </div>
                <span className={"rounded-full px-2.5 py-1 text-xs font-medium text-primary-foreground " + typeTone[event.type]}>{event.type}</span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">Schedule</span>
                <span className="text-right text-foreground">{formatLocalizedDate(event.start_date, language)} - {formatLocalizedDate(event.end_date, language)}</span>
              </div>
            </button>
          ))
        )}
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-border bg-card md:block">
        <div className="overflow-x-auto">
          <div style={{ minWidth: `calc(${LABEL_WIDTH} + ${totalDays * COL}px)` }}>
            <div className="flex border-b border-border bg-primary text-primary-foreground">
              <div className="sticky left-0 z-30 shrink-0 bg-primary px-4 py-2 text-xs font-semibold shadow-[8px_0_16px_rgba(0,0,0,0.35)]" style={{ width: LABEL_WIDTH }}>
                {text(language, { en: "Event / Company", ja: "イベント / 企業" })}
              </div>
              <div className="flex">
                {months.map((month, index) => (
                  <div
                    key={`${month.label}-${index}`}
                    className="border-l border-primary-foreground/20 px-2 py-2 text-xs font-medium"
                    style={{ width: month.span * COL }}
                  >
                    {month.label}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex border-b border-border bg-muted/60">
              <div className="sticky left-0 z-20 shrink-0 bg-muted/95 shadow-[8px_0_16px_rgba(0,0,0,0.25)]" style={{ width: LABEL_WIDTH }} />
              <div className="flex">
                {days.map((day, index) => {
                  const weekend = day.getDay() === 0 || day.getDay() === 6
                  return (
                    <div
                      key={index}
                      className={`flex flex-col items-center justify-center border-l border-border py-1 text-[10px] ${
                        weekend ? "bg-destructive/5 text-destructive" : "text-muted-foreground"
                      }`}
                      style={{ width: COL }}
                    >
                      <span className="font-medium tabular-nums">{day.getDate()}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {loading ? (
              <div className="px-5 py-8 text-sm text-muted-foreground">{text(language, { en: "Loading timeline...", ja: "タイムラインを読み込み中..." })}</div>
            ) : rows.length === 0 ? (
              <div className="px-5 py-8 text-sm text-muted-foreground">{text(language, { en: "No timeline items yet.", ja: "タイムライン項目はまだありません。" })}</div>
            ) : (
              rows.map((event, index) => {
                const start = startOfDay(safeDate(event.start_date))
                const end = startOfDay(safeDate(event.end_date || event.start_date))
                const offset = Math.max(Math.round((start.getTime() - rangeStart.getTime()) / DAY), 0)
                const span = Math.max(Math.round((end.getTime() - start.getTime()) / DAY) + 1, 1)

                return (
                  <div key={event.id} className={`flex items-center ${index % 2 ? "bg-muted/20" : ""} hover:bg-muted/40`}>
                    <button type="button" onClick={() => setSelectedEvent(event)} className={`sticky left-0 z-20 flex shrink-0 items-center gap-2 px-4 py-2.5 text-left shadow-[8px_0_16px_rgba(0,0,0,0.25)] ${index % 2 ? "bg-card" : "bg-background"}`} style={{ width: LABEL_WIDTH }}>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{event.title}</p>
                        <p className="truncate text-xs text-muted-foreground">{event.company_name ?? text(language, { en: "No company", ja: "企業なし" })}</p>
                      </div>
                    </button>
                    <div className="relative flex h-12 items-center" style={{ width: totalDays * COL }}>
                      {days.map((day, dayIndex) => {
                        const weekend = day.getDay() === 0 || day.getDay() === 6
                        return (
                          <div
                            key={dayIndex}
                            className={`h-full border-l border-border/60 ${weekend ? "bg-destructive/5" : ""}`}
                            style={{ width: COL }}
                          />
                        )
                      })}
                      <button
                        type="button"
                        onClick={() => setSelectedEvent(event)}
                        onKeyDown={(keyEvent) => {
                          if (keyEvent.key === "Enter" || keyEvent.key === " ") setSelectedEvent(event)
                        }}
                        className={`absolute flex h-6 items-center rounded-md px-2 text-[10px] font-medium text-primary-foreground shadow-sm ${typeTone[event.type]}`}
                        style={{ left: offset * COL + 2, width: Math.max(span * COL - 4, 28) }}
                        title={`${event.title} (${event.start_date} - ${event.end_date})`}
                      >
                        <span className="truncate">{event.type}</span>
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {selectedEvent && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Event detail</p>
              <h3 className="mt-1 text-lg font-semibold text-foreground">{selectedEvent.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{selectedEvent.company_name ?? text(language, { en: "No company", ja: "企業未設定" })}</p>
            </div>
            <button type="button" onClick={() => setSelectedEvent(null)} className="rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground">Close</button>
          </div>
          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div><p className="text-xs text-muted-foreground">Type</p><p className="font-medium text-foreground">{selectedEvent.type}</p></div>
            <div><p className="text-xs text-muted-foreground">Start</p><p className="font-medium text-foreground">{formatLocalizedDate(selectedEvent.start_date, language)}</p></div>
            <div><p className="text-xs text-muted-foreground">End</p><p className="font-medium text-foreground">{formatLocalizedDate(selectedEvent.end_date, language)}</p></div>
            <div><p className="text-xs text-muted-foreground">Time</p><p className="font-medium text-foreground">{selectedEvent.start_time?.slice(0, 5) ?? "-"}</p></div>
          </div>
          <p className="mt-4 whitespace-pre-wrap rounded-xl border border-border bg-background/60 p-3 text-sm text-muted-foreground">{selectedEvent.note || text(language, { en: "No detail yet.", ja: "詳細はまだありません。" })}</p>
        </div>
      )}
    </div>
  )
}
