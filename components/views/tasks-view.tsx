"use client"

import type { FormEvent } from "react"
import { useEffect, useMemo, useState } from "react"
import { CheckCircle2, Pencil, Plus, Save, Trash2, X } from "lucide-react"

import { apiRequest } from "@/lib/api"
import { formatLocalizedDate, text, useLanguagePreference } from "@/lib/language"
import { requestAppDataRefresh } from "@/lib/notification-events"
import { SplitDateInput } from "@/components/split-date-input"
import { StatusBadge } from "@/components/status-badge"

type TaskPriority = "high" | "medium" | "low"
type TaskStatus = "todo" | "in_progress" | "completed"

type ApiCompany = { id: number; name: string }
type ApiEvent = { id: number; title: string; company_name: string | null; start_date: string }

type ApiTask = {
  id: number
  user_id: number
  title: string
  description: string | null
  due_date: string | null
  priority: TaskPriority
  status: TaskStatus
  related_company_id: number | null
  related_event_id: number | null
  company_name: string | null
  event_title: string | null
  created_at: string
  updated_at: string
}

type TaskForm = {
  title: string
  description: string
  due_date: string
  priority: TaskPriority
  status: TaskStatus
  related_company_id: string
  related_event_id: string
}

const emptyForm: TaskForm = {
  title: "",
  description: "",
  due_date: "",
  priority: "medium",
  status: "todo",
  related_company_id: "",
  related_event_id: "",
}

const priorityTone: Record<TaskPriority, "danger" | "warning" | "info"> = {
  high: "danger",
  medium: "warning",
  low: "info",
}

const statusTone: Record<TaskStatus, "neutral" | "info" | "success"> = {
  todo: "neutral",
  in_progress: "info",
  completed: "success",
}

const statusLabel: Record<TaskStatus, { en: string; ja: string }> = {
  todo: { en: "Todo", ja: "未着手" },
  in_progress: { en: "In progress", ja: "進行中" },
  completed: { en: "Completed", ja: "完了" },
}

function toPayload(form: TaskForm) {
  return {
    title: form.title,
    description: form.description || null,
    due_date: form.due_date || null,
    priority: form.priority,
    status: form.status,
    related_company_id: form.related_company_id ? Number(form.related_company_id) : null,
    related_event_id: form.related_event_id ? Number(form.related_event_id) : null,
  }
}

function toForm(task: ApiTask): TaskForm {
  return {
    title: task.title,
    description: task.description ?? "",
    due_date: task.due_date ?? "",
    priority: task.priority,
    status: task.status,
    related_company_id: task.related_company_id ? String(task.related_company_id) : "",
    related_event_id: task.related_event_id ? String(task.related_event_id) : "",
  }
}

function isOverdue(task: ApiTask) {
  if (!task.due_date || task.status === "completed") return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(task.due_date + "T00:00:00")
  return due.getTime() < today.getTime()
}

export function TasksView() {
  const language = useLanguagePreference()
  const [tasks, setTasks] = useState<ApiTask[]>([])
  const [companies, setCompanies] = useState<ApiCompany[]>([])
  const [events, setEvents] = useState<ApiEvent[]>([])
  const [form, setForm] = useState<TaskForm>(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [filter, setFilter] = useState<TaskStatus | "all">("all")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const [taskData, companyData, eventData] = await Promise.all([
        apiRequest<ApiTask[]>("/tasks"),
        apiRequest<ApiCompany[]>("/companies"),
        apiRequest<ApiEvent[]>("/events"),
      ])
      setTasks(taskData)
      setCompanies(companyData)
      setEvents(eventData)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tasks.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const filteredTasks = useMemo(
    () => tasks.filter((task) => filter === "all" || task.status === filter),
    [filter, tasks],
  )

  const counts = useMemo(
    () => ({
      incomplete: tasks.filter((task) => task.status !== "completed").length,
      today: tasks.filter((task) => task.status !== "completed" && task.due_date === new Date().toISOString().slice(0, 10)).length,
      overdue: tasks.filter(isOverdue).length,
    }),
    [tasks],
  )

  function resetForm() {
    setForm(emptyForm)
    setEditingId(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      if (editingId) {
        await apiRequest<ApiTask>("/tasks/" + editingId, { method: "PUT", body: JSON.stringify(toPayload(form)) })
      } else {
        await apiRequest<ApiTask>("/tasks", { method: "POST", body: JSON.stringify(toPayload(form)) })
      }
      resetForm()
      await loadData()
      requestAppDataRefresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save task.")
    } finally {
      setSaving(false)
    }
  }

  async function completeTask(taskId: number) {
    await apiRequest<ApiTask>("/tasks/" + taskId + "/complete", { method: "PATCH" })
    await loadData()
    requestAppDataRefresh()
  }

  async function deleteTask(taskId: number) {
    await apiRequest<void>("/tasks/" + taskId, { method: "DELETE" })
    await loadData()
    requestAppDataRefresh()
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">{text(language, { en: "Incomplete tasks", ja: "未完了タスク" })}</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{counts.incomplete}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">{text(language, { en: "Today", ja: "今日やること" })}</p>
          <p className="mt-1 text-2xl font-semibold text-accent">{counts.today}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">{text(language, { en: "Overdue tasks", ja: "期限切れタスク" })}</p>
          <p className="mt-1 text-2xl font-semibold text-destructive">{counts.overdue}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-card p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <input required value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder={text(language, { en: "Task title", ja: "タスク名" })} className="min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring xl:col-span-2" />
          <input value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder={text(language, { en: "Description", ja: "説明" })} className="min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring xl:col-span-2" />
          <SplitDateInput value={form.due_date} onChange={(due_date) => setForm((current) => ({ ...current, due_date }))} ariaLabel="Task due date" className="min-w-0" />
          <select value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value as TaskPriority }))} className="min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring">
            <option value="high">high</option>
            <option value="medium">medium</option>
            <option value="low">low</option>
          </select>
          <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as TaskStatus }))} className="min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring">
            {Object.entries(statusLabel).map(([value, label]) => <option key={value} value={value}>{text(language, label)}</option>)}
          </select>
          <select value={form.related_company_id} onChange={(event) => setForm((current) => ({ ...current, related_company_id: event.target.value }))} className="min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring xl:col-span-2">
            <option value="">{text(language, { en: "No company", ja: "企業なし" })}</option>
            {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
          </select>
          <select value={form.related_event_id} onChange={(event) => setForm((current) => ({ ...current, related_event_id: event.target.value }))} className="min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring xl:col-span-2">
            <option value="">{text(language, { en: "No event", ja: "イベントなし" })}</option>
            {events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}
          </select>
          <div className="flex gap-2 sm:col-span-2 xl:col-span-1">
            <button type="submit" disabled={saving} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
              {editingId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {editingId ? text(language, { en: "Save", ja: "保存" }) : text(language, { en: "Add", ja: "追加" })}
            </button>
            {editingId && <button type="button" onClick={resetForm} className="inline-flex items-center justify-center rounded-lg bg-card px-3 py-2 text-sm text-muted-foreground ring-1 ring-border hover:text-foreground"><X className="h-4 w-4" /></button>}
          </div>
        </div>
      </form>

      <div className="flex gap-2 overflow-x-auto">
        {(["all", "todo", "in_progress", "completed"] as const).map((item) => (
          <button key={item} onClick={() => setFilter(item)} className={(filter === item ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground") + " rounded-lg px-3 py-1.5 text-sm ring-1 ring-border"}>
            {item === "all" ? text(language, { en: "All", ja: "すべて" }) : text(language, statusLabel[item])}
          </button>
        ))}
      </div>

      {error && <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {loading ? <div className="px-5 py-8 text-sm text-muted-foreground">Loading tasks...</div> : filteredTasks.length === 0 ? <div className="px-5 py-8 text-sm text-muted-foreground">{text(language, { en: "No tasks yet.", ja: "タスクはまだありません。" })}</div> : (
          <div className="divide-y divide-border">
            {filteredTasks.map((task) => (
              <div key={task.id} className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center">
                <button onClick={() => completeTask(task.id)} disabled={task.status === "completed"} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-success disabled:text-success"><CheckCircle2 className="h-5 w-5" /></button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-foreground">{task.title}</p>
                    <StatusBadge tone={priorityTone[task.priority]}>{task.priority}</StatusBadge>
                    <StatusBadge tone={statusTone[task.status]}>{text(language, statusLabel[task.status])}</StatusBadge>
                    {isOverdue(task) && <StatusBadge tone="danger">{text(language, { en: "overdue", ja: "期限切れ" })}</StatusBadge>}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{task.description || "-"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{task.company_name ?? text(language, { en: "No company", ja: "企業なし" })}{task.event_title ? " / " + task.event_title : ""}</p>
                </div>
                <div className="flex items-center gap-2 lg:justify-end">
                  <span className="min-w-24 text-sm text-muted-foreground">{task.due_date ? formatLocalizedDate(task.due_date, language) : "-"}</span>
                  <button onClick={() => { setEditingId(task.id); setForm(toForm(task)) }} className="inline-flex items-center justify-center rounded-lg bg-card p-1.5 text-muted-foreground ring-1 ring-border hover:text-foreground"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => deleteTask(task.id)} className="inline-flex items-center justify-center rounded-lg bg-card p-1.5 text-muted-foreground ring-1 ring-border hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
