"use client"

import { useEffect, useMemo, useState } from "react"
import { CalendarClock, GraduationCap, Pencil, Plus, Save, Trash2, X } from "lucide-react"
import {
  daysUntil,
} from "@/lib/data"
import { apiRequest } from "@/lib/api"
import { formatLocalizedDate, text, useLanguagePreference } from "@/lib/language"
import { requestAppDataRefresh } from "@/lib/notification-events"
import { SplitDateInput } from "@/components/split-date-input"
import { StatusBadge } from "@/components/status-badge"

type EventType = "briefing" | "interview" | "test" | "deadline" | "intern" | "other"

type ApiCompany = {
  id: number
  name: string
}

type ApiEvent = {
  id: number
  user_id: number
  company_id: number | null
  company_name: string | null
  title: string
  start_date: string
  end_date: string
  start_time: string | null
  type: EventType
  note: string | null
  created_at: string
  updated_at: string
}

type EventForm = {
  company_id: string
  title: string
  start_date: string
  end_date: string
  start_time: string
  type: EventType
  note: string
}

const emptyForm: EventForm = {
  company_id: "",
  title: "",
  start_date: "",
  end_date: "",
  start_time: "",
  type: "briefing",
  note: "",
}

const eventTypeMeta: Record<EventType, { ja: string; tone: "info" | "warning" | "danger" | "neutral" | "success" }> = {
  briefing: { ja: "Briefing", tone: "info" },
  interview: { ja: "Interview", tone: "info" },
  test: { ja: "Test", tone: "warning" },
  deadline: { ja: "Deadline", tone: "danger" },
  intern: { ja: "Intern", tone: "success" },
  other: { ja: "Other", tone: "neutral" },
}

const eventTypes = Object.keys(eventTypeMeta) as EventType[]

function toPayload(form: EventForm) {
  return {
    company_id: form.company_id ? Number(form.company_id) : null,
    title: form.title,
    start_date: form.start_date,
    end_date: form.end_date || form.start_date,
    start_time: form.start_time || null,
    type: form.type,
    note: form.note || null,
  }
}

function isIsoDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return false

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))

  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

function validateForm(form: EventForm) {
  if (!isIsoDate(form.start_date)) return "Start date must be a valid date."
  if (!isIsoDate(form.end_date)) return "End date must be a valid date."
  if (form.end_date < form.start_date) return "End date must be on or after start date."
  return null
}

function toForm(event: ApiEvent): EventForm {
  return {
    company_id: event.company_id ? String(event.company_id) : "",
    title: event.title,
    start_date: event.start_date,
    end_date: event.end_date,
    start_time: event.start_time ? event.start_time.slice(0, 5) : "",
    type: event.type,
    note: event.note ?? "",
  }
}

function EventsTab() {
  const language = useLanguagePreference()
  const [events, setEvents] = useState<ApiEvent[]>([])
  const [companies, setCompanies] = useState<ApiCompany[]>([])
  const [form, setForm] = useState<EventForm>(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadData() {
    setLoading(true)
    setError(null)

    try {
      const [eventData, companyData] = await Promise.all([
        apiRequest<ApiEvent[]>("/events"),
        apiRequest<ApiCompany[]>("/companies"),
      ])
      setEvents(eventData)
      setCompanies(companyData)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load events.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const sorted = useMemo(
    () => [...events].sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()),
    [events],
  )

  const resetForm = () => {
    setForm(emptyForm)
    setEditingId(null)
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    const validationError = validateForm(form)
    if (validationError) {
      setError(validationError)
      return
    }

    setSaving(true)

    try {
      const payload = toPayload(form)
      if (editingId) {
        const updated = await apiRequest<ApiEvent>(`/events/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        })
        setEvents((current) => current.map((item) => (item.id === updated.id ? updated : item)))
      } else {
        const created = await apiRequest<ApiEvent>("/events", {
          method: "POST",
          body: JSON.stringify(payload),
        })
        setEvents((current) => [...current, created])
      }
      requestAppDataRefresh()
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save event.")
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (event: ApiEvent) => {
    setEditingId(event.id)
    setForm(toForm(event))
  }

  const handleDelete = async (eventId: number) => {
    if (!window.confirm("Delete this event?")) return

    setError(null)
    try {
      await apiRequest<void>(`/events/${eventId}`, { method: "DELETE" })
      setEvents((current) => current.filter((event) => event.id !== eventId))
      requestAppDataRefresh()
      if (editingId === eventId) resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete event.")
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-card p-4">
        <div className="grid gap-3 lg:grid-cols-6">
          <input
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            required
            placeholder={text(language, { en: "Event", ja: "イベント" })}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring lg:col-span-2"
          />
          <select
            value={form.company_id}
            onChange={(event) => setForm((current) => ({ ...current, company_id: event.target.value }))}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring lg:col-span-2"
          >
            <option value="">{text(language, { en: "No company", ja: "企業なし" })}</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
          <select
            value={form.type}
            onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as EventType }))}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          >
            {eventTypes.map((type) => (
              <option key={type} value={type}>
                {eventTypeMeta[type].ja}
              </option>
            ))}
          </select>
          <input
            value={form.start_time}
            onChange={(event) => setForm((current) => ({ ...current, start_time: event.target.value }))}
            type="time"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          />
          <SplitDateInput
            value={form.start_date}
            onChange={(startDate) => {
              setForm((current) => ({
                ...current,
                start_date: startDate,
                end_date: current.end_date || startDate,
              }))
            }}
            required
            ariaLabel="Start date"
            className="lg:col-span-2"
          />
          <SplitDateInput
            value={form.end_date}
            onChange={(endDate) => {
              setForm((current) => ({ ...current, end_date: endDate }))
            }}
            required
            ariaLabel="End date"
            className="lg:col-span-2"
          />
          <input
            value={form.note}
            onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
            placeholder={text(language, { en: "Note", ja: "メモ" })}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring lg:col-span-2"
          />
          <div className="flex gap-2 lg:col-span-1">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {editingId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {editingId ? text(language, { en: "Save", ja: "保存" }) : text(language, { en: "Add", ja: "追加" })}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center justify-center rounded-lg bg-card px-3 py-2 text-sm text-muted-foreground ring-1 ring-border hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </form>

      {error && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {loading ? (
          <div className="px-5 py-8 text-sm text-muted-foreground">{text(language, { en: "Loading events...", ja: "イベントを読み込み中..." })}</div>
        ) : sorted.length === 0 ? (
          <div className="px-5 py-8 text-sm text-muted-foreground">{text(language, { en: "No events yet.", ja: "イベントはまだありません。" })}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">{text(language, { en: "Company", ja: "企業" })}</th>
                  <th className="px-4 py-3 font-medium">{text(language, { en: "Event", ja: "イベント" })}</th>
                  <th className="px-4 py-3 font-medium">{text(language, { en: "Start", ja: "開始日" })}</th>
                  <th className="px-4 py-3 font-medium">{text(language, { en: "End", ja: "終了日" })}</th>
                  <th className="px-4 py-3 font-medium">{text(language, { en: "Time", ja: "時間" })}</th>
                  <th className="px-4 py-3 font-medium">{text(language, { en: "Remaining", ja: "残り" })}</th>
                  <th className="px-4 py-3 font-medium">{text(language, { en: "Actions", ja: "操作" })}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sorted.map((event) => {
                  const meta = eventTypeMeta[event.type]
                  const remainingDays = daysUntil(event.start_date)

                  return (
                    <tr key={event.id} className="transition-colors hover:bg-muted/40">
                      <td className="px-4 py-3 font-medium text-foreground">{event.company_name ?? "-"}</td>
                      <td className="px-4 py-3">
                        <StatusBadge tone={meta.tone}>{event.title}</StatusBadge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatLocalizedDate(event.start_date, language)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatLocalizedDate(event.end_date, language)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{event.start_time?.slice(0, 5) ?? "-"}</td>
                      <td className="px-4 py-3">
                        <span className={remainingDays <= 7 ? "font-medium text-destructive" : "text-muted-foreground"}>
                          {remainingDays < 0
                            ? text(language, { en: "Done", ja: "完了" })
                            : remainingDays === 0
                              ? text(language, { en: "Today", ja: "今日" })
                              : `${remainingDays}d`}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleEdit(event)}
                            className="inline-flex items-center justify-center rounded-lg bg-card p-1.5 text-muted-foreground ring-1 ring-border hover:text-foreground"
                            aria-label="Edit event"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(event.id)}
                            className="inline-flex items-center justify-center rounded-lg bg-card p-1.5 text-muted-foreground ring-1 ring-border hover:text-destructive"
                            aria-label="Delete event"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function InternTab() {
  const language = useLanguagePreference()
  const [events, setEvents] = useState<ApiEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function loadInternEvents() {
      setLoading(true)
      setError(null)

      try {
        const data = await apiRequest<ApiEvent[]>("/events?type=intern")
        if (active) setEvents(data)
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Failed to load internships.")
      } finally {
        if (active) setLoading(false)
      }
    }

    loadInternEvents()

    return () => {
      active = false
    }
  }, [])

  const sorted = useMemo(
    () => [...events].sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()),
    [events],
  )

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      {error ? (
        <div className="px-5 py-8 text-sm text-destructive">{error}</div>
      ) : loading ? (
        <div className="px-5 py-8 text-sm text-muted-foreground">{text(language, { en: "Loading internships...", ja: "インターンを読み込み中..." })}</div>
      ) : sorted.length === 0 ? (
        <div className="px-5 py-8 text-sm text-muted-foreground">{text(language, { en: "No internships yet.", ja: "インターンはまだありません。" })}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">{text(language, { en: "Program", ja: "プログラム" })}</th>
                <th className="px-4 py-3 font-medium">{text(language, { en: "Company", ja: "企業" })}</th>
                <th className="px-4 py-3 font-medium">{text(language, { en: "Schedule", ja: "日程" })}</th>
                <th className="px-4 py-3 font-medium">{text(language, { en: "Time", ja: "時間" })}</th>
                <th className="px-4 py-3 font-medium">{text(language, { en: "Note", ja: "メモ" })}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sorted.map((event) => (
                <tr key={event.id} className="transition-colors hover:bg-muted/40">
                  <td className="px-4 py-3 font-medium text-foreground">{event.title}</td>
                  <td className="px-4 py-3 text-muted-foreground">{event.company_name ?? "-"}</td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">
                    {formatLocalizedDate(event.start_date, language)} - {formatLocalizedDate(event.end_date, language)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{event.start_time?.slice(0, 5) ?? "-"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{event.note ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function EventsView() {
  const [tab, setTab] = useState<"events" | "intern">("events")
  const language = useLanguagePreference()
  return (
    <div className="space-y-4">
      <div className="flex gap-1.5">
        <button
          onClick={() => setTab("events")}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            tab === "events"
              ? "bg-primary text-primary-foreground"
              : "bg-card text-muted-foreground ring-1 ring-border hover:text-foreground"
          }`}
        >
          <CalendarClock className="h-4 w-4" />
          {text(language, { en: "Events", ja: "イベント" })}
        </button>
        <button
          onClick={() => setTab("intern")}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            tab === "intern"
              ? "bg-primary text-primary-foreground"
              : "bg-card text-muted-foreground ring-1 ring-border hover:text-foreground"
          }`}
        >
          <GraduationCap className="h-4 w-4" />
          {text(language, { en: "Internships", ja: "インターン" })}
        </button>
      </div>
      {tab === "events" ? <EventsTab /> : <InternTab />}
    </div>
  )
}
