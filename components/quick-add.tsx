"use client"

import { useEffect, useState, type ReactNode } from "react"
import { Building2, CalendarPlus, ListTodo, Loader2, Plus, X } from "lucide-react"
import { apiRequest } from "@/lib/api"
import { requestAppDataRefresh } from "@/lib/notification-events"
import { industryMeta, type Industry, type Priority } from "@/lib/data"
import { text, useLanguagePreference } from "@/lib/language"
import { Button } from "@/components/ui/button"
import type { ViewKey } from "@/components/sidebar"

type Tab = "company" | "event" | "task"

const industries: Industry[] = ["maker", "finance", "consulting", "it", "other"]
const priorities: Priority[] = ["S", "A", "B", "C"]
const eventTypes = ["briefing", "interview", "test", "deadline", "intern", "offer", "other"] as const
const taskPriorities = ["high", "medium", "low"] as const

const emptyCompanyForm = { name: "", industry: "other" as Industry, priority: "B" as Priority, es_deadline: "" }
const emptyEventForm = { title: "", type: "briefing" as (typeof eventTypes)[number], start_date: "", start_time: "" }
const emptyTaskForm = { title: "", priority: "medium" as (typeof taskPriorities)[number], due_date: "" }

const copy = {
  quickAdd: { en: "Quick add", ja: "クイック追加" },
  company: { en: "Company", ja: "企業" },
  event: { en: "Event", ja: "イベント" },
  task: { en: "Task", ja: "タスク" },
  name: { en: "Company name", ja: "企業名" },
  title: { en: "Title", ja: "タイトル" },
  industry: { en: "Industry", ja: "業界" },
  priority: { en: "Priority", ja: "優先度" },
  esDeadline: { en: "ES deadline", ja: "ES締切" },
  type: { en: "Type", ja: "種別" },
  startDate: { en: "Date", ja: "日付" },
  startTime: { en: "Time", ja: "時刻" },
  dueDate: { en: "Due date", ja: "期限" },
  add: { en: "Add", ja: "追加" },
  adding: { en: "Adding...", ja: "追加中..." },
  close: { en: "Close", ja: "閉じる" },
  nameRequired: { en: "Company name is required.", ja: "企業名を入力してください。" },
  titleRequired: { en: "Title is required.", ja: "タイトルを入力してください。" },
  dateRequired: { en: "Date is required.", ja: "日付を入力してください。" },
}

export function QuickAdd({ onNavigate }: { onNavigate: (view: ViewKey) => void }) {
  const language = useLanguagePreference()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>("company")
  const [companyForm, setCompanyForm] = useState(emptyCompanyForm)
  const [eventForm, setEventForm] = useState(emptyEventForm)
  const [taskForm, setTaskForm] = useState(emptyTaskForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const close = () => {
    setOpen(false)
    setError(null)
  }

  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)

    try {
      if (tab === "company") {
        if (!companyForm.name.trim()) throw new Error(text(language, copy.nameRequired))
        await apiRequest("/companies", {
          method: "POST",
          body: JSON.stringify({
            name: companyForm.name,
            industry: companyForm.industry,
            priority: companyForm.priority,
            es_deadline: companyForm.es_deadline || null,
          }),
        })
        setCompanyForm(emptyCompanyForm)
        onNavigate("companies")
      } else if (tab === "event") {
        if (!eventForm.title.trim()) throw new Error(text(language, copy.titleRequired))
        if (!eventForm.start_date) throw new Error(text(language, copy.dateRequired))
        await apiRequest("/events", {
          method: "POST",
          body: JSON.stringify({
            title: eventForm.title,
            type: eventForm.type,
            start_date: eventForm.start_date,
            end_date: eventForm.start_date,
            start_time: eventForm.start_time || null,
          }),
        })
        setEventForm(emptyEventForm)
        onNavigate("events")
      } else {
        if (!taskForm.title.trim()) throw new Error(text(language, copy.titleRequired))
        await apiRequest("/tasks", {
          method: "POST",
          body: JSON.stringify({
            title: taskForm.title,
            priority: taskForm.priority,
            due_date: taskForm.due_date || null,
            status: "todo",
          }),
        })
        setTaskForm(emptyTaskForm)
        onNavigate("tasks")
      }
      requestAppDataRefresh()
      close()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={text(language, copy.quickAdd)}
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] right-4 z-[8500] flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:scale-105 hover:shadow-xl md:bottom-8 md:right-8 md:h-auto md:w-auto md:gap-2 md:rounded-full md:px-5 md:py-3"
      >
        <Plus className="h-6 w-6 md:h-4 md:w-4" />
        <span className="hidden text-sm font-medium md:inline">{text(language, copy.quickAdd)}</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[9500] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={close}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">{text(language, copy.quickAdd)}</h2>
              <button
                type="button"
                onClick={close}
                aria-label={text(language, copy.close)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <TabButton active={tab === "company"} icon={Building2} label={text(language, copy.company)} onClick={() => setTab("company")} />
              <TabButton active={tab === "event"} icon={CalendarPlus} label={text(language, copy.event)} onClick={() => setTab("event")} />
              <TabButton active={tab === "task"} icon={ListTodo} label={text(language, copy.task)} onClick={() => setTab("task")} />
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              {tab === "company" && (
                <>
                  <Field label={text(language, copy.name)}>
                    <input
                      autoFocus
                      value={companyForm.name}
                      onChange={(event) => setCompanyForm((prev) => ({ ...prev, name: event.target.value }))}
                      className={inputCls}
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label={text(language, copy.industry)}>
                      <select
                        value={companyForm.industry}
                        onChange={(event) => setCompanyForm((prev) => ({ ...prev, industry: event.target.value as Industry }))}
                        className={inputCls}
                      >
                        {industries.map((industry) => (
                          <option key={industry} value={industry}>
                            {text(language, industryMeta[industry])}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label={text(language, copy.priority)}>
                      <select
                        value={companyForm.priority}
                        onChange={(event) => setCompanyForm((prev) => ({ ...prev, priority: event.target.value as Priority }))}
                        className={inputCls}
                      >
                        {priorities.map((priority) => (
                          <option key={priority} value={priority}>
                            {priority}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <Field label={text(language, copy.esDeadline)}>
                    <input
                      type="date"
                      value={companyForm.es_deadline}
                      onChange={(event) => setCompanyForm((prev) => ({ ...prev, es_deadline: event.target.value }))}
                      className={inputCls}
                    />
                  </Field>
                </>
              )}

              {tab === "event" && (
                <>
                  <Field label={text(language, copy.title)}>
                    <input
                      autoFocus
                      value={eventForm.title}
                      onChange={(event) => setEventForm((prev) => ({ ...prev, title: event.target.value }))}
                      className={inputCls}
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label={text(language, copy.type)}>
                      <select
                        value={eventForm.type}
                        onChange={(event) =>
                          setEventForm((prev) => ({ ...prev, type: event.target.value as (typeof eventTypes)[number] }))
                        }
                        className={inputCls}
                      >
                        {eventTypes.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label={text(language, copy.startTime)}>
                      <input
                        type="time"
                        value={eventForm.start_time}
                        onChange={(event) => setEventForm((prev) => ({ ...prev, start_time: event.target.value }))}
                        className={inputCls}
                      />
                    </Field>
                  </div>
                  <Field label={text(language, copy.startDate)}>
                    <input
                      type="date"
                      value={eventForm.start_date}
                      onChange={(event) => setEventForm((prev) => ({ ...prev, start_date: event.target.value }))}
                      className={inputCls}
                    />
                  </Field>
                </>
              )}

              {tab === "task" && (
                <>
                  <Field label={text(language, copy.title)}>
                    <input
                      autoFocus
                      value={taskForm.title}
                      onChange={(event) => setTaskForm((prev) => ({ ...prev, title: event.target.value }))}
                      className={inputCls}
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label={text(language, copy.priority)}>
                      <select
                        value={taskForm.priority}
                        onChange={(event) =>
                          setTaskForm((prev) => ({ ...prev, priority: event.target.value as (typeof taskPriorities)[number] }))
                        }
                        className={inputCls}
                      >
                        {taskPriorities.map((priority) => (
                          <option key={priority} value={priority}>
                            {priority}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label={text(language, copy.dueDate)}>
                      <input
                        type="date"
                        value={taskForm.due_date}
                        onChange={(event) => setTaskForm((prev) => ({ ...prev, due_date: event.target.value }))}
                        className={inputCls}
                      />
                    </Field>
                  </div>
                </>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={close}>
                  {text(language, copy.close)}
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {saving ? text(language, copy.adding) : text(language, copy.add)}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

function TabButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean
  icon: typeof Building2
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2 text-xs font-medium transition ${
        active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}

const inputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
