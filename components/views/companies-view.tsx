"use client"

import { useEffect, useMemo, useState } from "react"
import { BookOpen, Filter, Pencil, Plus, Save, Search, Trash2, X } from "lucide-react"
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
import { requestAppDataRefresh } from "@/lib/notification-events"
import { SplitDateInput } from "@/components/split-date-input"
import { PriorityBadge, Stars, StatusBadge } from "@/components/status-badge"

type StrategyPosition = "Reach" | "Core" | "Safe" | "Hold"

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
  strategy_rank: "S" | "A" | "B" | null
  difficulty_level: number | null
  fit_score: number | null
  success_probability: number | null
  selection_risk: "ES" | "SPI" | "Interview" | "Unknown" | null
  recommended_action: string | null
  strategy_reason: string | null
  user_strategy_note: string | null
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

const industryTabs: { key: Industry | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "maker", label: "Maker" },
  { key: "finance", label: "Finance" },
  { key: "consulting", label: "Consulting" },
  { key: "it", label: "IT" },
  { key: "other", label: "Other" },
]

const industries: Industry[] = ["maker", "finance", "consulting", "it", "other"]
const priorities: Priority[] = ["S", "A", "B", "C"]
const statuses = Object.keys(companyStatusMeta) as CompanyStatus[]
const strategyPositions: StrategyPosition[] = ["Reach", "Core", "Safe", "Hold"]

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

function readMemoBlock(source: string | null | undefined, label: string) {
  if (!source) return ""
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const match = source.match(new RegExp(`\\[${escaped}\\]\\n([\\s\\S]*?)(?=\\n\\n\\[[^\\]]+\\]|$)`))
  return match?.[1]?.trim() ?? ""
}

function strategyPositionOf(company: ApiCompany): StrategyPosition {
  const stored = readMemoBlock(company.user_strategy_note, "Strategy Position") as StrategyPosition
  return strategyPositions.includes(stored) ? stored : "Hold"
}

function mainRiskOf(company: ApiCompany) {
  return company.selection_risk && company.selection_risk !== "Unknown" ? company.selection_risk : "-"
}

export function CompaniesView({ onOpenNotebook }: { onOpenNotebook?: (companyId: number) => void }) {
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
      setCompanies(await apiRequest<ApiCompany[]>(query ? `/companies?${query}` : "/companies"))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load companies.")
    } finally {
      setLoading(false)
    }
  }

  async function loadAllCompanies() {
    try {
      setAllCompanies(await apiRequest<ApiCompany[]>("/companies"))
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
      } else {
        await apiRequest<ApiCompany>("/companies", {
          method: "POST",
          body: JSON.stringify(toPayload(form)),
        })
      }
      await refreshCompanies()
      requestAppDataRefresh()
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
      requestAppDataRefresh()
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
      requestAppDataRefresh()
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
              className={`rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                tab === item.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground ring-1 ring-border hover:text-foreground"
              }`}
            >
              {item.label}
              <span className="ml-1.5 text-xs opacity-60">{tabCounts[item.key]}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={clearFilters}
          disabled={!hasFilters}
          className="inline-flex items-center gap-1.5 rounded-lg bg-card px-3 py-2.5 text-sm text-muted-foreground ring-1 ring-border hover:text-foreground disabled:opacity-50"
        >
          <Filter className="h-4 w-4" />
          Clear filters
        </button>
      </div>

      <div className="grid gap-3 rounded-2xl border border-border bg-card p-4 xl:grid-cols-4">
        <div className="flex min-w-0 items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted-foreground xl:col-span-2">
          <Search className="h-4 w-4" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search companies"
            className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as CompanyStatus | "all")}
          className="min-w-0 rounded-lg border border-border bg-background px-3 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">All statuses</option>
          {statuses.map((status) => (
            <option key={status} value={status}>
              {text(language, companyStatusMeta[status])}
            </option>
          ))}
        </select>
        <select
          value={priorityFilter}
          onChange={(event) => setPriorityFilter(event.target.value as Priority | "all")}
          className="min-w-0 rounded-lg border border-border bg-background px-3 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">All company ranks</option>
          {priorities.map((priority) => (
            <option key={priority} value={priority}>
              Company Rank {priority}
            </option>
          ))}
        </select>
      </div>

      <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Company Add / Edit</p>
          <p className="mt-1 text-sm text-muted-foreground">
            This form edits only basic company information. AI Research and Strategy Memo are in Company Notebook.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <input
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            required
            placeholder="Company name"
            className="min-w-0 rounded-lg border border-border bg-background px-3 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring xl:col-span-2"
          />
          <select
            value={form.industry}
            onChange={(event) => setForm((current) => ({ ...current, industry: event.target.value as Industry }))}
            className="min-w-0 rounded-lg border border-border bg-background px-3 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          >
            {industries.map((industry) => (
              <option key={industry} value={industry}>
                {text(language, industryMeta[industry])}
              </option>
            ))}
          </select>
          <select
            value={form.priority}
            onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value as Priority }))}
            className="min-w-0 rounded-lg border border-border bg-background px-3 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          >
            {priorities.map((priority) => (
              <option key={priority} value={priority}>
                Rank {priority}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            max={5}
            value={form.importance}
            onChange={(event) => setForm((current) => ({ ...current, importance: Number(event.target.value) }))}
            className="min-w-0 rounded-lg border border-border bg-background px-3 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          />
          <select
            value={form.status}
            onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as CompanyStatus }))}
            className="min-w-0 rounded-lg border border-border bg-background px-3 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          >
            {statuses.map((status) => (
              <option key={status} value={status}>
                {text(language, companyStatusMeta[status])}
              </option>
            ))}
          </select>
          <div className="min-w-0 sm:col-span-2 xl:col-span-2">
            <SplitDateInput
              value={form.es_deadline}
              onChange={(value) => setForm((current) => ({ ...current, es_deadline: value }))}
              ariaLabel="ES deadline"
            />
          </div>
          <input
            value={form.note}
            onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
            placeholder="Note"
            className="min-w-0 rounded-lg border border-border bg-background px-3 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring sm:col-span-2 xl:col-span-3"
          />
          <div className="flex gap-2 sm:col-span-2 xl:col-span-1">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {editingId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {editingId ? "Save" : "Add"}
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
            {hasFilters ? "No companies match current filters." : "No companies yet."}
          </div>
        ) : (
          <>
            <div className="space-y-3 p-3 md:hidden" data-mobile-company-card>
              {companies.map((company) => {
                const statusMeta = companyStatusMeta[company.status]
                const dueSoon = company.es_deadline && daysUntil(company.es_deadline) >= 0 && daysUntil(company.es_deadline) <= 7
                return (
                  <div key={company.id} className="rounded-xl border border-border bg-background/60 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold text-foreground">{company.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{text(language, industryMeta[company.industry])}</p>
                      </div>
                      <PriorityBadge priority={company.priority} />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <StatusBadge tone={statusMeta.tone}>{statusMeta.en}</StatusBadge>
                      <span className="rounded-full border border-border bg-card px-2.5 py-1 text-xs font-semibold text-foreground">
                        {strategyPositionOf(company)}
                      </span>
                      <Stars count={company.importance} />
                    </div>
                    <div className="mt-3 grid gap-2 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">ES deadline</span>
                        {company.es_deadline ? (
                          <span className={dueSoon ? "cyber-blink font-medium text-destructive" : "text-foreground"}>
                            {formatLocalizedDate(company.es_deadline, language)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Main risk</span>
                        <span className="text-foreground">{mainRiskOf(company)}</span>
                      </div>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <select
                        value={company.status}
                        onChange={(event) => handleStatusChange(company, event.target.value as CompanyStatus)}
                        className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                      >
                        {statuses.map((status) => (
                          <option key={status} value={status}>{text(language, companyStatusMeta[status])}</option>
                        ))}
                      </select>
                      <button onClick={() => onOpenNotebook?.(company.id)} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-card p-2 text-muted-foreground ring-1 ring-border hover:text-primary" aria-label="Open notebook"><BookOpen className="h-4 w-4" /></button>
                      <button onClick={() => handleEdit(company)} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-card p-2 text-muted-foreground ring-1 ring-border hover:text-foreground" aria-label="Edit company"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => handleDelete(company.id)} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-card p-2 text-muted-foreground ring-1 ring-border hover:text-destructive" aria-label="Delete company"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[1180px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50 text-left text-xs text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Company</th>
                    <th className="px-4 py-3 font-medium">Industry</th>
                    <th className="px-4 py-3 font-medium">Company Rank</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">ES deadline</th>
                    <th className="px-4 py-3 font-medium">Strategy Position</th>
                    <th className="px-4 py-3 font-medium">Main Risk</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {companies.map((company) => {
                    const statusMeta = companyStatusMeta[company.status]
                    const dueSoon = company.es_deadline && daysUntil(company.es_deadline) >= 0 && daysUntil(company.es_deadline) <= 7

                    return (
                      <tr key={company.id} className="transition-colors hover:bg-muted/40">
                        <td className="px-4 py-3"><span className="font-medium text-foreground">{company.name}</span></td>
                        <td className="px-4 py-3 text-muted-foreground">{text(language, industryMeta[company.industry])}</td>
                        <td className="px-4 py-3"><PriorityBadge priority={company.priority} /></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <StatusBadge tone={statusMeta.tone}>{statusMeta.en}</StatusBadge>
                            <select
                              value={company.status}
                              onChange={(event) => handleStatusChange(company, event.target.value as CompanyStatus)}
                              className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:ring-2 focus:ring-ring"
                            >
                              {statuses.map((status) => (
                                <option key={status} value={status}>{text(language, companyStatusMeta[status])}</option>
                              ))}
                            </select>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {company.es_deadline ? (
                            <span className={dueSoon ? "cyber-blink font-medium text-destructive" : "text-muted-foreground"}>
                              {formatLocalizedDate(company.es_deadline, language)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-full border border-border bg-background px-2.5 py-1 text-xs font-semibold text-foreground">
                            {strategyPositionOf(company)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{mainRiskOf(company)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => onOpenNotebook?.(company.id)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-card px-3 py-2 text-muted-foreground ring-1 ring-border hover:text-primary" aria-label="Open notebook">
                              <BookOpen className="h-4 w-4" />
                              <span>Notebook</span>
                            </button>
                            <button onClick={() => handleEdit(company)} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-card p-2 text-muted-foreground ring-1 ring-border hover:text-foreground" aria-label="Edit company"><Pencil className="h-4 w-4" /></button>
                            <button onClick={() => handleDelete(company.id)} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-card p-2 text-muted-foreground ring-1 ring-border hover:text-destructive" aria-label="Delete company"><Trash2 className="h-4 w-4" /></button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
