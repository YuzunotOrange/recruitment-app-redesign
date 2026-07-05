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
import { requestAppDataRefresh } from "@/lib/notification-events"
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
  strategy_rank: "S" | "A" | "B"
  difficulty_level: number
  fit_score: number
  success_probability: number
  selection_risk: "ES" | "SPI" | "Interview" | "Unknown"
  recommended_action: string | null
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
  strategy_rank: "S" | "A" | "B"
  difficulty_level: number
  fit_score: number
  success_probability: number
  selection_risk: "ES" | "SPI" | "Interview" | "Unknown"
  recommended_action: string
}

const emptyForm: CompanyForm = {
  name: "",
  industry: "other",
  priority: "C",
  importance: 3,
  status: "planned",
  es_deadline: "",
  note: "",
  strategy_rank: "A",
  difficulty_level: 3,
  fit_score: 50,
  success_probability: 50,
  selection_risk: "Unknown",
  recommended_action: "",
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
const strategyRanks: Array<"S" | "A" | "B"> = ["S", "A", "B"]
const selectionRisks: Array<"ES" | "SPI" | "Interview" | "Unknown"> = ["Unknown", "ES", "SPI", "Interview"]

function toPayload(form: CompanyForm) {
  return {
    name: form.name,
    industry: form.industry,
    priority: form.priority,
    importance: form.importance,
    status: form.status,
    es_deadline: form.es_deadline || null,
    note: form.note || null,
    strategy_rank: form.strategy_rank,
    difficulty_level: form.difficulty_level,
    fit_score: form.fit_score,
    success_probability: form.success_probability,
    selection_risk: form.selection_risk,
    recommended_action: form.recommended_action || null,
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
    strategy_rank: company.strategy_rank ?? "A",
    difficulty_level: company.difficulty_level ?? 3,
    fit_score: company.fit_score ?? 50,
    success_probability: company.success_probability ?? 50,
    selection_risk: company.selection_risk ?? "Unknown",
    recommended_action: company.recommended_action ?? "",
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
              {item.ja}
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
          className="rounded-lg border border-border bg-background px-3 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
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
          className="rounded-lg border border-border bg-background px-3 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
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
            className="rounded-lg border border-border bg-background px-3 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring lg:col-span-2"
          />
          <select
            value={form.industry}
            onChange={(event) => setForm((current) => ({ ...current, industry: event.target.value as Industry }))}
            className="rounded-lg border border-border bg-background px-3 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
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
            className="rounded-lg border border-border bg-background px-3 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
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
            className="rounded-lg border border-border bg-background px-3 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
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
            className="rounded-lg border border-border bg-background px-3 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring lg:col-span-2"
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
            className="rounded-lg border border-border bg-background px-3 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring lg:col-span-3"
          />
          <select
            value={form.strategy_rank}
            onChange={(event) => setForm((current) => ({ ...current, strategy_rank: event.target.value as "S" | "A" | "B" }))}
            className="rounded-lg border border-border bg-background px-3 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          >
            {strategyRanks.map((rank) => (
              <option key={rank} value={rank}>
                Strategy {rank}
              </option>
            ))}
          </select>
          <input
            value={form.difficulty_level}
            onChange={(event) => setForm((current) => ({ ...current, difficulty_level: Number(event.target.value) }))}
            type="number"
            min={1}
            max={5}
            aria-label="Difficulty level"
            className="rounded-lg border border-border bg-background px-3 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            value={form.fit_score}
            onChange={(event) => setForm((current) => ({ ...current, fit_score: Number(event.target.value) }))}
            type="number"
            min={0}
            max={100}
            aria-label="Fit score"
            className="rounded-lg border border-border bg-background px-3 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            value={form.success_probability}
            onChange={(event) => setForm((current) => ({ ...current, success_probability: Number(event.target.value) }))}
            type="number"
            min={0}
            max={100}
            aria-label="Success probability"
            className="rounded-lg border border-border bg-background px-3 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          />
          <select
            value={form.selection_risk}
            onChange={(event) => setForm((current) => ({ ...current, selection_risk: event.target.value as "ES" | "SPI" | "Interview" | "Unknown" }))}
            className="rounded-lg border border-border bg-background px-3 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          >
            {selectionRisks.map((risk) => (
              <option key={risk} value={risk}>
                Risk {risk}
              </option>
            ))}
          </select>
          <input
            value={form.recommended_action}
            onChange={(event) => setForm((current) => ({ ...current, recommended_action: event.target.value }))}
            placeholder="Recommended action"
            className="rounded-lg border border-border bg-background px-3 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring lg:col-span-3"
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
          <>
          <div className="space-y-3 p-3 md:hidden" data-mobile-company-card>
            {companies.map((company) => {
              const statusMeta = companyStatusMeta[company.status]
              const dueSoon = company.es_deadline && daysUntil(company.es_deadline) >= 0 && daysUntil(company.es_deadline) <= 7
              return (
                <div key={company.id} className="rounded-xl border border-border bg-background/60 p-4">
                  <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-base font-semibold text-foreground">{company.name}</p><p className="mt-1 text-xs text-muted-foreground">{text(language, industryMeta[company.industry])}</p></div><PriorityBadge priority={company.priority} /></div>
                  <div className="mt-3 flex flex-wrap items-center gap-2"><StatusBadge tone={statusMeta.tone}>{statusMeta.ja}</StatusBadge><Stars count={company.importance} /><span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Rank {company.strategy_rank}</span><span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{company.success_probability}%</span></div>
                  <div className="mt-3 grid gap-2 text-sm"><div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">ES deadline</span>{company.es_deadline ? (<span className={dueSoon ? "cyber-blink font-medium text-destructive" : "text-foreground"}>{formatLocalizedDate(company.es_deadline, language)}</span>) : (<span className="text-muted-foreground">-</span>)}</div>{company.note && <p className="text-muted-foreground">{company.note}</p>}</div>
                  <div className="mt-4 flex gap-2"><select value={company.status} onChange={(event) => handleStatusChange(company, event.target.value as CompanyStatus)} className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring">{statuses.map((status) => (<option key={status} value={status}>{companyStatusMeta[status].en}</option>))}</select><button onClick={() => handleEdit(company)} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-card p-2 text-muted-foreground ring-1 ring-border hover:text-foreground" aria-label="Edit company"><Pencil className="h-4 w-4" /></button><button onClick={() => handleDelete(company.id)} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-card p-2 text-muted-foreground ring-1 ring-border hover:text-destructive" aria-label="Delete company"><Trash2 className="h-4 w-4" /></button></div>
                </div>
              )
            })}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[1180px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">{text(language, { en: "Company", ja: "企業" })}</th>
                  <th className="px-4 py-3 font-medium">{text(language, { en: "Industry", ja: "業界" })}</th>
                  <th className="px-4 py-3 font-medium">{text(language, { en: "Priority", ja: "優先度" })}</th>
                  <th className="px-4 py-3 font-medium">{text(language, { en: "Importance", ja: "重要度" })}</th>
                  <th className="px-4 py-3 font-medium">{text(language, { en: "Status", ja: "ステータス" })}</th>
                  <th className="px-4 py-3 font-medium">{text(language, { en: "Next event", ja: "次の予定" })}</th>
                  <th className="px-4 py-3 font-medium">{text(language, { en: "ES deadline", ja: "ES締切" })}</th>
                  <th className="px-4 py-3 font-medium">Strategy</th>
                  <th className="px-4 py-3 font-medium">Risk</th>
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
                          <span className={dueSoon ? "cyber-blink font-medium text-destructive" : "text-muted-foreground"}>
                            {formatLocalizedDate(company.es_deadline, language)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Rank {company.strategy_rank}</span>
                          <p className="text-xs text-muted-foreground">Fit {company.fit_score} / Win {company.success_probability}%</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{company.selection_risk}</td>
                      <td className="max-w-[200px] truncate px-4 py-3 text-muted-foreground" title={company.note ?? undefined}>
                        {company.note ?? "-"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleEdit(company)}
                            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-card p-2 text-muted-foreground ring-1 ring-border hover:text-foreground"
                            aria-label="Edit company"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(company.id)}
                            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-card p-2 text-muted-foreground ring-1 ring-border hover:text-destructive"
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
          </>
        )}
      </div>
    </div>
  )
}
