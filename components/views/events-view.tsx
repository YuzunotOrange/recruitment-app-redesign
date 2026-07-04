"use client"

import { Fragment, useEffect, useMemo, useState } from "react"
import { CalendarClock, ChevronDown, ChevronUp, GraduationCap, Pencil, Plus, Save, Trash2, X } from "lucide-react"
import {
  daysUntil,
} from "@/lib/data"
import { apiRequest } from "@/lib/api"
import { formatLocalizedDate, text, useLanguagePreference } from "@/lib/language"
import { requestAppDataRefresh } from "@/lib/notification-events"
import { SplitDateInput } from "@/components/split-date-input"
import { StatusBadge } from "@/components/status-badge"

type EventType = "briefing" | "interview" | "test" | "deadline" | "intern" | "offer" | "other"

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
  end_time: string | null
  type: EventType
  note: string | null
  candidate_dates: ApiCandidateDate[]
  created_at: string
  updated_at: string
}

type ApiCandidateDate = {
  id: number
  start_date: string
  end_date: string
  start_time: string | null
  end_time: string | null
  note: string | null
  is_selected: boolean
}

type CandidateForm = {
  start_date: string
  end_date: string
  start_time: string
  end_time: string
  note: string
  is_selected: boolean
}

type EventForm = {
  company_id: string
  title: string
  start_date: string
  end_date: string
  start_time: string
  end_time: string
  type: EventType
  note: string
  candidate_dates: CandidateForm[]
}

const emptyCandidate: CandidateForm = {
  start_date: "",
  end_date: "",
  start_time: "",
  end_time: "",
  note: "",
  is_selected: false,
}

const emptyForm: EventForm = {
  company_id: "",
  title: "",
  start_date: "",
  end_date: "",
  start_time: "",
  end_time: "",
  type: "briefing",
  note: "",
  candidate_dates: [],
}

const eventTypeMeta: Record<EventType, { ja: string; tone: "info" | "warning" | "danger" | "neutral" | "success" }> = {
  briefing: { ja: "Briefing", tone: "info" },
  interview: { ja: "Interview", tone: "info" },
  test: { ja: "Test", tone: "warning" },
  deadline: { ja: "Deadline", tone: "danger" },
  intern: { ja: "Intern", tone: "success" },
  offer: { ja: "Offer", tone: "success" },
  other: { ja: "Other", tone: "neutral" },
}

const eventTypes = Object.keys(eventTypeMeta) as EventType[]

function toPayload(form: EventForm) {
  const candidateDates = form.candidate_dates
    .filter((candidate) => candidate.start_date || candidate.end_date || candidate.start_time || candidate.end_time || candidate.note)
    .map((candidate) => ({
      start_date: candidate.start_date,
      end_date: candidate.end_date || candidate.start_date,
      start_time: candidate.start_time || null,
      end_time: candidate.end_time || null,
      note: candidate.note || null,
      is_selected: candidate.is_selected,
    }))

  return {
    company_id: form.company_id ? Number(form.company_id) : null,
    title: form.title,
    start_date: form.start_date,
    end_date: form.end_date || form.start_date,
    start_time: form.start_time || null,
    end_time: form.end_time || null,
    type: form.type,
    note: form.note || null,
    candidate_dates: candidateDates,
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
  const activeCandidates = form.candidate_dates.filter((candidate) => candidate.start_date || candidate.end_date || candidate.start_time || candidate.end_time || candidate.note)
  if (activeCandidates.filter((candidate) => candidate.is_selected).length > 1) return "Only one candidate date can be selected."
  for (const candidate of activeCandidates) {
    if (!isIsoDate(candidate.start_date)) return "Candidate start date must be a valid date."
    if (!isIsoDate(candidate.end_date || candidate.start_date)) return "Candidate end date must be a valid date."
    if ((candidate.end_date || candidate.start_date) < candidate.start_date) return "Candidate end date must be on or after start date."
  }
  return null
}

function toForm(event: ApiEvent): EventForm {
  return {
    company_id: event.company_id ? String(event.company_id) : "",
    title: event.title,
    start_date: event.start_date,
    end_date: event.end_date,
    start_time: event.start_time ? event.start_time.slice(0, 5) : "",
    end_time: event.end_time ? event.end_time.slice(0, 5) : "",
    type: event.type,
    note: event.note ?? "",
    candidate_dates: (event.candidate_dates ?? []).map((candidate) => ({
      start_date: candidate.start_date,
      end_date: candidate.end_date,
      start_time: candidate.start_time ? candidate.start_time.slice(0, 5) : "",
      end_time: candidate.end_time ? candidate.end_time.slice(0, 5) : "",
      note: candidate.note ?? "",
      is_selected: candidate.is_selected,
    })),
  }
}

function formatTimeRange(start?: string | null, end?: string | null) {
  const startLabel = start ? start.slice(0, 5) : ""
  const endLabel = end ? end.slice(0, 5) : ""
  if (startLabel && endLabel) return `${startLabel} - ${endLabel}`
  if (startLabel) return startLabel
  return "-"
}

function selectedCandidate(event: ApiEvent) {
  return event.candidate_dates?.find((candidate) => candidate.is_selected) ?? null
}

function candidateLabel(event: ApiEvent, language: ReturnType<typeof useLanguagePreference>) {
  const selected = selectedCandidate(event)
  if (selected) return formatLocalizedDate(selected.start_date, language)
  if (event.candidate_dates?.length > 0) return `${event.candidate_dates.length} candidates`
  return formatLocalizedDate(event.start_date, language)
}

function candidateDateRange(candidate: ApiCandidateDate, language: ReturnType<typeof useLanguagePreference>) {
  const start = formatLocalizedDate(candidate.start_date, language)
  const end = formatLocalizedDate(candidate.end_date, language)
  return candidate.end_date && candidate.end_date !== candidate.start_date ? `${start} - ${end}` : start
}

function eventTimeLabel(event: ApiEvent) {
  const selected = selectedCandidate(event)
  if (selected) return formatTimeRange(selected.start_time, selected.end_time)
  if (event.candidate_dates?.length > 0) return "-"
  return formatTimeRange(event.start_time, event.end_time)
}

function EventsTab() {
  const language = useLanguagePreference()
  const [events, setEvents] = useState<ApiEvent[]>([])
  const [companies, setCompanies] = useState<ApiCompany[]>([])
  const [form, setForm] = useState<EventForm>(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [expandedIds, setExpandedIds] = useState<number[]>([])
  const [selectedEvent, setSelectedEvent] = useState<ApiEvent | null>(null)
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

  const addCandidateDate = () => {
    setForm((current) => ({
      ...current,
      candidate_dates: [...current.candidate_dates, { ...emptyCandidate }],
    }))
  }

  const updateCandidateDate = (index: number, patch: Partial<CandidateForm>) => {
    setForm((current) => ({
      ...current,
      candidate_dates: current.candidate_dates.map((candidate, candidateIndex) => (
        candidateIndex === index ? { ...candidate, ...patch } : candidate
      )),
    }))
  }

  const selectCandidateDate = (index: number) => {
    setForm((current) => ({
      ...current,
      candidate_dates: current.candidate_dates.map((candidate, candidateIndex) => ({
        ...candidate,
        is_selected: candidateIndex === index,
      })),
    }))
  }

  const removeCandidateDate = (index: number) => {
    setForm((current) => ({
      ...current,
      candidate_dates: current.candidate_dates.filter((_, candidateIndex) => candidateIndex !== index),
    }))
  }

  const toggleExpanded = (eventId: number) => {
    setExpandedIds((current) => (
      current.includes(eventId)
        ? current.filter((id) => id !== eventId)
        : [...current, eventId]
    ))
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
    setSelectedEvent(event)
    setForm(toForm(event))
  }

  const handleDelete = async (eventId: number) => {
    if (!window.confirm("Delete this event?")) return

    setError(null)
    try {
      await apiRequest<void>(`/events/${eventId}`, { method: "DELETE" })
      setEvents((current) => current.filter((event) => event.id !== eventId))
      requestAppDataRefresh()
      if (selectedEvent?.id === eventId) setSelectedEvent(null)
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
            className="rounded-lg border border-border bg-background px-3 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring lg:col-span-2"
          />
          <select
            value={form.company_id}
            onChange={(event) => setForm((current) => ({ ...current, company_id: event.target.value }))}
            className="rounded-lg border border-border bg-background px-3 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring lg:col-span-2"
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
            className="rounded-lg border border-border bg-background px-3 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
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
            className="rounded-lg border border-border bg-background px-3 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            value={form.end_time}
            onChange={(event) => setForm((current) => ({ ...current, end_time: event.target.value }))}
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
          <textarea
            value={form.note}
            onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
            placeholder={text(language, { en: "Detail / note", ja: "詳細 / メモ" })}
            rows={3}
            className="min-h-24 resize-y rounded-lg border border-border bg-background px-3 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring lg:col-span-4"
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
        <div className="mt-4 rounded-xl border border-border bg-background/50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground">Candidate dates</p>
            <button
              type="button"
              onClick={addCandidateDate}
              className="inline-flex items-center gap-1.5 rounded-lg bg-card px-3 py-2 text-xs font-medium text-muted-foreground ring-1 ring-border hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
              Add candidate date
            </button>
          </div>
          {form.candidate_dates.length === 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">No candidate dates. The main date will be used.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {form.candidate_dates.map((candidate, index) => (
                <div key={index} className="grid gap-2 rounded-xl border border-border bg-card p-3 sm:grid-cols-2 lg:grid-cols-6">
                  <SplitDateInput
                    value={candidate.start_date}
                    onChange={(startDate) => updateCandidateDate(index, { start_date: startDate, end_date: candidate.end_date || startDate })}
                    ariaLabel={`Candidate ${index + 1} start date`}
                    className="lg:col-span-2"
                  />
                  <SplitDateInput
                    value={candidate.end_date}
                    onChange={(endDate) => updateCandidateDate(index, { end_date: endDate })}
                    ariaLabel={`Candidate ${index + 1} end date`}
                    className="lg:col-span-2"
                  />
                  <input
                    value={candidate.start_time}
                    onChange={(event) => updateCandidateDate(index, { start_time: event.target.value })}
                    type="time"
                    className="min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                  />
                  <input
                    value={candidate.end_time}
                    onChange={(event) => updateCandidateDate(index, { end_time: event.target.value })}
                    type="time"
                    className="min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                  />
                  <input
                    value={candidate.note}
                    onChange={(event) => updateCandidateDate(index, { note: event.target.value })}
                    placeholder="Candidate note"
                    className="min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring sm:col-span-2 lg:col-span-4"
                  />
                  <div className="flex items-center justify-between gap-2 sm:col-span-2 lg:col-span-2">
                    <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="radio"
                        name="selected-candidate"
                        checked={candidate.is_selected}
                        onChange={() => selectCandidateDate(index)}
                        className="h-4 w-4 accent-primary"
                      />
                      Selected
                    </label>
                    <button
                      type="button"
                      onClick={() => removeCandidateDate(index)}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground ring-1 ring-border hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </form>

      {error && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

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

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {loading ? (
          <div className="px-5 py-8 text-sm text-muted-foreground">{text(language, { en: "Loading events...", ja: "イベントを読み込み中..." })}</div>
        ) : sorted.length === 0 ? (
          <div className="px-5 py-8 text-sm text-muted-foreground">{text(language, { en: "No events yet.", ja: "イベントはまだありません。" })}</div>
        ) : (
          <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[880px] text-sm">

              <thead>
                <tr className="border-b border-border bg-muted/50 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">{text(language, { en: "Company", ja: "企業" })}</th>
                  <th className="px-4 py-3 font-medium">{text(language, { en: "Event", ja: "イベント" })}</th>
                  <th className="px-4 py-3 font-medium">{text(language, { en: "Candidate Dates", ja: "開始日" })}</th>
                  <th className="px-4 py-3 font-medium">{text(language, { en: "Selected Date", ja: "終了日" })}</th>
                  <th className="px-4 py-3 font-medium">{text(language, { en: "Time", ja: "時間" })}</th>
                  <th className="px-4 py-3 font-medium">{text(language, { en: "Remaining", ja: "残り" })}</th>
                  <th className="px-4 py-3 font-medium">{text(language, { en: "Actions", ja: "操作" })}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sorted.map((event) => {
                  const meta = eventTypeMeta[event.type]
                  const remainingDays = daysUntil(event.start_date)
                  const hasCandidates = event.candidate_dates?.length > 0
                  const selected = selectedCandidate(event)
                  const isExpanded = expandedIds.includes(event.id)

                  return (
                    <Fragment key={event.id}>
                    <tr onClick={() => setSelectedEvent(event)} className="cursor-pointer transition-colors hover:bg-muted/40">
                      <td className="px-4 py-3 font-medium text-foreground">{event.company_name ?? "-"}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge tone={meta.tone}>{event.title}</StatusBadge>
                          {hasCandidates && !selected && (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                              Candidates available
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground" colSpan={2}>
                        <div className="flex items-center gap-2">
                          <span>{candidateLabel(event, language)}</span>
                          {hasCandidates && (
                            <button
                              type="button"
                              onClick={(clickEvent) => {
                                clickEvent.stopPropagation()
                                toggleExpanded(event.id)
                              }}
                              className="inline-flex items-center justify-center rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                              aria-label={isExpanded ? "Hide candidate dates" : "Show candidate dates"}
                            >
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{eventTimeLabel(event)}</td>
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
                            type="button"
                            onClick={(clickEvent) => { clickEvent.stopPropagation(); handleEdit(event) }}
                            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-card p-2 text-muted-foreground ring-1 ring-border hover:text-foreground"
                            aria-label="Edit event"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(clickEvent) => { clickEvent.stopPropagation(); handleDelete(event.id) }}
                            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-card p-2 text-muted-foreground ring-1 ring-border hover:text-destructive"
                            aria-label="Delete event"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {hasCandidates && isExpanded && (
                      <tr className="bg-muted/20">
                        <td colSpan={7} className="px-4 py-3">
                          <div className="space-y-2">
                            {event.candidate_dates.map((candidate) => (
                              <div key={candidate.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
                                {candidate.is_selected && <StatusBadge tone="success">Selected</StatusBadge>}
                                <span className="font-medium text-foreground">{candidateDateRange(candidate, language)}</span>
                                <span>{formatTimeRange(candidate.start_time, candidate.end_time)}</span>
                                {candidate.note && <span>{candidate.note}</span>}
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="space-y-3 p-3 md:hidden">
            {sorted.map((event) => {
              const meta = eventTypeMeta[event.type]
              const remainingDays = daysUntil(event.start_date)
              const hasCandidates = event.candidate_dates?.length > 0
              const isExpanded = expandedIds.includes(event.id)

              return (
                <div
                  key={event.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedEvent(event)}
                  onKeyDown={(keyEvent) => {
                    if (keyEvent.key === "Enter" || keyEvent.key === " ") setSelectedEvent(event)
                  }}
                  className="rounded-xl border border-border bg-background p-3 hover:bg-muted/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="font-medium text-foreground">{event.company_name ?? "-"}</p>
                      <StatusBadge tone={meta.tone}>{event.title}</StatusBadge>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {hasCandidates && (
                        <button
                          type="button"
                          onClick={(clickEvent) => {
                            clickEvent.stopPropagation()
                            toggleExpanded(event.id)
                          }}
                          className="inline-flex items-center justify-center rounded-lg bg-card p-1.5 text-muted-foreground ring-1 ring-border"
                          aria-label={isExpanded ? "Hide candidate dates" : "Show candidate dates"}
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(clickEvent) => {
                          clickEvent.stopPropagation()
                          handleEdit(event)
                        }}
                        className="inline-flex items-center justify-center rounded-lg bg-card p-1.5 text-muted-foreground ring-1 ring-border"
                        aria-label="Edit event"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(clickEvent) => {
                          clickEvent.stopPropagation()
                          handleDelete(event.id)
                        }}
                        className="inline-flex items-center justify-center rounded-lg bg-card p-1.5 text-muted-foreground ring-1 ring-border"
                        aria-label="Delete event"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
                    <div className="flex justify-between gap-3">
                      <span>Date</span>
                      <span className="text-right">{candidateLabel(event, language)}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span>Time</span>
                      <span>{eventTimeLabel(event)}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span>Remaining</span>
                      <span className={remainingDays <= 7 ? "font-medium text-destructive" : ""}>
                        {remainingDays < 0
                          ? "Done"
                          : remainingDays === 0
                            ? "Today"
                            : `${remainingDays}d`}
                      </span>
                    </div>
                  </div>
                  {hasCandidates && isExpanded && (
                    <div className="mt-3 space-y-2">
                      {event.candidate_dates.map((candidate) => (
                        <div key={candidate.id} className="rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
                          <div className="flex flex-wrap items-center gap-2">
                            {candidate.is_selected && <StatusBadge tone="success">Selected</StatusBadge>}
                            <span className="font-medium text-foreground">{candidateDateRange(candidate, language)}</span>
                            <span>{formatTimeRange(candidate.start_time, candidate.end_time)}</span>
                          </div>
                          {candidate.note && <p className="mt-1">{candidate.note}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          </>
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
        <>
        <div className="space-y-3 p-3 md:hidden" data-mobile-intern-card>
          {sorted.map((event) => (
            <div key={event.id} className="rounded-xl border border-border bg-background/60 p-4">
              <p className="text-base font-semibold text-foreground">{event.title}</p><p className="mt-1 text-sm text-muted-foreground">{event.company_name ?? text(language, { en: "No company", ja: "企業なし" })}</p>
              <div className="mt-3 grid gap-2 text-sm"><div className="flex justify-between gap-3"><span className="text-muted-foreground">Schedule</span><span className="text-right">{formatLocalizedDate(event.start_date, language)} - {formatLocalizedDate(event.end_date, language)}</span></div><div className="flex justify-between gap-3"><span className="text-muted-foreground">Time</span><span>{event.start_time?.slice(0, 5) ?? "-"}</span></div>{event.note && <p className="text-muted-foreground">{event.note}</p>}</div>
            </div>
          ))}
        </div>
        <div className="hidden overflow-x-auto md:block">
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
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">{candidateLabel(event, language)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{eventTimeLabel(event)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{event.note ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
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
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
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
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
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
