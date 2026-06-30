"use client"

import { useEffect, useMemo, useState } from "react"
import { Filter, Pencil, Plus, Save, Search, Trash2, X } from "lucide-react"
import {
  companyStatusMeta,
  daysUntil,
  industryMeta,
  type CompanyStatus,
  type Industry,
  type Priority,
} from "@/lib/data"
import { apiRequest } from "@/lib/api"
import { formatLocalizedDate, text, useLanguagePreference } from "@/lib/language"
import { requestNotificationRefresh } from "@/lib/notification-events"
import { SplitDateInput } from "@/components/split-date-input"
import { PriorityBadge, Stars, StatusBadge } from "@/components/status-badge"

type ApiCompany = {
  id: number
  user_id: number
  name: string
  industry: Industry
  priority: Priority
  importance: number
  status: CompanyStatus
  es_deadline: string | null
  note: string | null
  created_at: string
  updated_at: string
}

type CompanyForm = {
  name: string
  industry: Industry
  priority: Priority
  importance: number
  status: CompanyStatus
  es_deadline: string
  note: string
}

const emptyForm: CompanyForm = {
  name: "",
  industry: "other",
  priority: "C",
  importance: 3,
  status: "planned",
  es_deadline: "",
  note: "",
}

const industryTabs: { key: Industry | "all"; ja: string; en: string }[] = [
  { key: "all", ja: "All", en: "All" },
  { key: "maker", ja: "Maker", en: "Maker" },
  { key: "finance", ja: "Finance", en: "Finance" },
  { key: "consulting", ja: "Consulting", en: "Consulting" },
  { key: "it", ja: "IT", en: "IT" },
  { key: "other", ja: "Other", en: "Other" },
]

const industries: Industry[] = ["maker", "finance", "consulting", "it", "other"]
const priorities: Priority[] = ["S", "A", "B", "C"]
const statuses = Object.keys(companyStatusMeta) as CompanyStatus[]

function toPayload(form: CompanyForm) {
  return {
    name: form.name,
    industry: form.industry,
    priority: form.priority,
    importance: form.importance,
    status: form.status,
    es_deadline: form.es_deadline || null,
    note: form.note || null,
  }
}

function toForm(company: ApiCompany): CompanyForm {
  return {
    name: company.name,
    industry: company.industry,
    priority: company.priority,
    importance: company.importance,
    status: company.status,
    es_deadline: company.es_deadline ?? "",
    note: company.note ?? "",
  }
}

export function CompaniesView() {
  const language = useLanguagePreference()
  const [tab, setTab] = useState<Industry | "all">("all")
  const [companies, setCompanies] = useState<ApiCompany[]>([])
  const [allCompanies, setAllCompanies] = useState<ApiCompany[]>([])
  const [statusFilter, setStatusFilter] = useState<CompanyStatus | "all">("all")
  const [priorityFilter, setPriorityFilter] = useState<Priority | "all">("all")
  const [search, setSearch] = useState("")
  const [form, setForm] = useState<CompanyForm>(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const activeFilters = useMemo(
    () => ({
      industry: tab === "all" ? null : tab,
      status: statusFilter === "all" ? null : statusFilter,
      priority: priorityFilter === "all" ? null : priorityFilter,
      search: search.trim() || null,
    }),
    [priorityFilter, search, statusFilter, tab],
  )

  async function loadCompanies(filters = activeFilters) {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filters.industry) params.set("industry", filters.industry)
      if (filters.status) params.set("status", filters.status)
      if (filters.priority) params.set("priority", filters.priority)
      if (filters.search) params.set("search", filters.search)

      const query = params.toString()
      const data = await apiRequest<ApiCompany[]>(query ? `/companies?${query}` : "/companies")
      setCompanies(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load companies.")
    } finally {
      setLoading(false)
    }
  }

  async function loadAllCompanies() {
    try {
      const data = await apiRequest<ApiCompany[]>("/companies")
      setAllCompanies(data)
    } catch {
      // The filtered list error is shown by loadCompanies.
    }
  }

  async function refreshCompanies(filters = activeFilters) {
    await Promise.all([loadCompanies(filters), loadAllCompanies()])
  }

  useEffect(() => {
    refreshCompanies(activeFilters)
  }, [activeFilters])

  const hasFilters = tab !== "all" || statusFilter !== "all" || priorityFilter !== "all" || search.trim().length > 0

  const tabCounts = useMemo(
    () =>
      industryTabs.reduce<Record<Industry | "all", number>>(
        (counts, item) => {
          counts[item.key] =
            item.key === "all" ? allCompanies.length : allCompanies.filter((company) => company.industry === item.key).length
          return counts
        },
        { all: 0, maker: 0, finance: 0, consulting: 0, it: 0, other: 0 },
      ),
    [allCompanies],
  )

  const resetForm = () => {
    setForm(emptyForm)
    setEditingId(null)
  }

  const clearFilters = () => {
    setTab("all")
    setStatusFilter("all")
    setPriorityFilter("all")
    setSearch("")
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError(null)

    try {
      if (editingId) {
        await apiRequest<ApiCompany>(`/companies/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(toPayload(form)),
        })
        await refreshCompanies()
      } else {
        await apiRequest<ApiCompany>("/companies", {
          method: "POST",
          body: JSON.stringify(toPayload(form)),
        })
        await refreshCompanies()
      }
      requestNotificationRefresh()
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save company.")
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (company: ApiCompany) => {
    setEditingId(company.id)
    setForm(toForm(company))
  }

  const handleDelete = async (companyId: number) => {
    if (!window.confirm("Delete this company?")) return

    setError(null)
    try {
      await apiRequest<void>(`/companies/${companyId}`, { method: "DELETE" })
      await refreshCompanies()
      requestNotificationRefresh()
      if (editingId === companyId) resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete company.")
    }
  }

  const handleStatusChange = async (company: ApiCompany, status: CompanyStatus) => {
    setError(null)
    try {
      await apiRequest<ApiCompany>(`/companies/${company.id}`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      })
      await refreshCompanies()
      requestNotificationRefresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status.")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {industryTabs.map((item) => (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === item.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground ring-1 ring-border hover:text-foreground"
              }`}
            >
              {item.ja}
              <span className="ml-1.5 text-xs opacity-60">{tabCounts[item.key]}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={clearFilters}
          disabled={!hasFilters}
          className="inline-flex items-center gap-1.5 rounded-lg bg-card px-3 py-1.5 text-sm text-muted-foreground ring-1 ring-border hover:text-foreground disabled:opacity-50"
        >
          <Filter className="h-4 w-4" />
          {text(language, { en: "Clear filters", ja: "条件をクリア" })}
        </button>
      </div>

      <div className="grid gap-3 rounded-2xl border border-border bg-card p-4 lg:grid-cols-4">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted-foreground lg:col-span-2">
          <Search className="h-4 w-4" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={text(language, { en: "Search companies", ja: "企業を検索" })}
            className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as CompanyStatus | "all")}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">{text(language, { en: "All statuses", ja: "すべてのステータス" })}</option>
          {statuses.map((status) => (
            <option key={status} value={status}>
              {companyStatusMeta[status].en}
            </option>
          ))}
        </select>
        <select
          value={priorityFilter}
          onChange={(event) => setPriorityFilter(event.target.value as Priority | "all")}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">{text(language, { en: "All priorities", ja: "すべての優先度" })}</option>
          {priorities.map((priority) => (
            <option key={priority} value={priority}>
              Priority {priority}
            </option>
          ))}
        </select>
      </div>

      <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-card p-4">
        <div className="grid gap-3 lg:grid-cols-6">
          <input
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            required
            placeholder={text(language, { en: "Company", ja: "企業名" })}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring lg:col-span-2"
          />
          <select
            value={form.industry}
            onChange={(event) => setForm((current) => ({ ...current, industry: event.target.value as Industry }))}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          >
            {industries.map((industry) => (
              <option key={industry} value={industry}>
                {industryMeta[industry].en}
              </option>
            ))}
          </select>
          <select
            value={form.priority}
            onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value as Priority }))}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          >
            {priorities.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>
          <input
            value={form.importance}
            onChange={(event) => setForm((current) => ({ ...current, importance: Number(event.target.value) }))}
            type="number"
            min={1}
            max={5}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          />
          <SplitDateInput
            value={form.es_deadline}
            onChange={(deadline) => setForm((current) => ({ ...current, es_deadline: deadline }))}
            ariaLabel="ES deadline"
            className="lg:col-span-2"
          />
          <select
            value={form.status}
            onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as CompanyStatus }))}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring lg:col-span-2"
          >
            {statuses.map((status) => (
              <option key={status} value={status}>
                {companyStatusMeta[status].en}
              </option>
            ))}
          </select>
          <input
            value={form.note}
            onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
            placeholder={text(language, { en: "Note", ja: "メモ" })}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring lg:col-span-3"
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
          <div className="px-5 py-8 text-sm text-muted-foreground">Loading companies...</div>
        ) : companies.length === 0 ? (
          <div className="px-5 py-8 text-sm text-muted-foreground">
            {hasFilters
              ? text(language, { en: "No companies match current filters.", ja: "現在の条件に一致する企業はありません。" })
              : text(language, { en: "No companies yet.", ja: "企業はまだありません。" })}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">{text(language, { en: "Company", ja: "企業" })}</th>
                  <th className="px-4 py-3 font-medium">{text(language, { en: "Industry", ja: "業界" })}</th>
                  <th className="px-4 py-3 font-medium">{text(language, { en: "Priority", ja: "優先度" })}</th>
                  <th className="px-4 py-3 font-medium">{text(language, { en: "Importance", ja: "重要度" })}</th>
                  <th className="px-4 py-3 font-medium">{text(language, { en: "Status", ja: "ステータス" })}</th>
                  <th className="px-4 py-3 font-medium">{text(language, { en: "Next event", ja: "次の予定" })}</th>
                  <th className="px-4 py-3 font-medium">{text(language, { en: "ES deadline", ja: "ES締切" })}</th>
                  <th className="px-4 py-3 font-medium">{text(language, { en: "Note", ja: "メモ" })}</th>
                  <th className="px-4 py-3 font-medium">{text(language, { en: "Actions", ja: "操作" })}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {companies.map((company) => {
                  const statusMeta = companyStatusMeta[company.status]
                  const dueSoon =
                    company.es_deadline && daysUntil(company.es_deadline) >= 0 && daysUntil(company.es_deadline) <= 7

                  return (
                    <tr key={company.id} className="transition-colors hover:bg-muted/40">
                      <td className="px-4 py-3">
                        <span className="font-medium text-foreground">{company.name}</span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{text(language, industryMeta[company.industry])}</td>
                      <td className="px-4 py-3">
                        <PriorityBadge priority={company.priority} />
                      </td>
                      <td className="px-4 py-3">
                        <Stars count={company.importance} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <StatusBadge tone={statusMeta.tone}>{statusMeta.ja}</StatusBadge>
                          <select
                            value={company.status}
                            onChange={(event) => handleStatusChange(company, event.target.value as CompanyStatus)}
                            className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:ring-2 focus:ring-ring"
                          >
                            {statuses.map((status) => (
                              <option key={status} value={status}>
                                {companyStatusMeta[status].en}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        -
                      </td>
                      <td className="px-4 py-3">
                        {company.es_deadline ? (
                          <span className={dueSoon ? "font-medium text-destructive" : "text-muted-foreground"}>
                            {formatLocalizedDate(company.es_deadline, language)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="max-w-[200px] truncate px-4 py-3 text-muted-foreground" title={company.note ?? undefined}>
                        {company.note ?? "-"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleEdit(company)}
                            className="inline-flex items-center justify-center rounded-lg bg-card p-1.5 text-muted-foreground ring-1 ring-border hover:text-foreground"
                            aria-label="Edit company"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(company.id)}
                            className="inline-flex items-center justify-center rounded-lg bg-card p-1.5 text-muted-foreground ring-1 ring-border hover:text-destructive"
                            aria-label="Delete company"
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
