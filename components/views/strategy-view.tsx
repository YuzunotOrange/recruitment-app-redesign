"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, BarChart3, BrainCircuit, RefreshCw, Save, ShieldAlert, Target, Trophy, X } from "lucide-react"
import { apiRequest } from "@/lib/api"
import { companyStatusMeta, type CompanyStatus, type Industry, type Priority } from "@/lib/data"
import { StatusBadge } from "@/components/status-badge"

type StrategyRank = "S" | "A" | "B"
type SelectionRisk = "ES" | "SPI" | "Interview" | "Unknown"

type StrategyCompany = {
  id: number
  name: string
  industry: Industry
  priority: Priority
  importance: number
  status: CompanyStatus
  strategy_rank: StrategyRank
  difficulty_level: number
  fit_score: number
  success_probability: number
  selection_risk: SelectionRisk
  recommended_action: string | null
  strategy_reason: string | null
  user_strategy_note: string | null
}

type StrategyAction = {
  title: string
  reason: string
  action: string
  urgency: "high" | "medium" | "low" | string
  company_id: number | null
  company_name: string | null
}

type StrategyBucket = {
  rank: StrategyRank
  count: number
  ratio: number
  companies: StrategyCompany[]
}

type StrategySummary = {
  buckets: Record<StrategyRank, StrategyBucket>
  counts: Record<StrategyRank, number>
  ratios: Record<StrategyRank, number>
  metrics: {
    total_companies: number
    es_rejected: number
    spi_rejected: number
    interviews: number
    offers: number
  }
  recommended_actions: StrategyAction[]
}

const rankTone: Record<StrategyRank, string> = {
  S: "border-destructive/30 bg-destructive/10 text-destructive",
  A: "border-warning/30 bg-warning/15 text-warning-foreground",
  B: "border-accent/30 bg-accent/10 text-accent",
}

const urgencyTone: Record<string, string> = {
  high: "bg-destructive/10 text-destructive ring-destructive/20",
  medium: "bg-warning/15 text-warning-foreground ring-warning/20",
  low: "bg-success/10 text-success ring-success/20",
}

const strategyRanks: StrategyRank[] = ["S", "A", "B"]
const selectionRisks: SelectionRisk[] = ["Unknown", "ES", "SPI", "Interview"]

type StrategyMemoForm = {
  strategy_rank: StrategyRank
  difficulty_level: number
  fit_score: number
  success_probability: number
  selection_risk: SelectionRisk
  recommended_action: string
  strategy_reason: string
  user_strategy_note: string
}

function toMemoForm(company: StrategyCompany): StrategyMemoForm {
  return {
    strategy_rank: company.strategy_rank,
    difficulty_level: company.difficulty_level,
    fit_score: company.fit_score,
    success_probability: company.success_probability,
    selection_risk: company.selection_risk,
    recommended_action: company.recommended_action ?? "",
    strategy_reason: company.strategy_reason ?? "",
    user_strategy_note: company.user_strategy_note ?? "",
  }
}

function emptySummary(): StrategySummary {
  return {
    buckets: {
      S: { rank: "S", count: 0, ratio: 0, companies: [] },
      A: { rank: "A", count: 0, ratio: 0, companies: [] },
      B: { rank: "B", count: 0, ratio: 0, companies: [] },
    },
    counts: { S: 0, A: 0, B: 0 },
    ratios: { S: 0, A: 0, B: 0 },
    metrics: { total_companies: 0, es_rejected: 0, spi_rejected: 0, interviews: 0, offers: 0 },
    recommended_actions: [],
  }
}

function StrategyMeter({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-foreground">{label}</span>
        <span className="tabular-nums text-muted-foreground">{value}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
    </div>
  )
}

function CompanyStrategyCard({ company, onSelect }: { company: StrategyCompany; onSelect: (company: StrategyCompany) => void }) {
  const statusMeta = companyStatusMeta[company.status]
  return (
    <button type="button" onClick={() => onSelect(company)} className="w-full rounded-xl border border-border bg-background/70 p-4 text-left hover:bg-muted/40">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{company.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Difficulty {company.difficulty_level} / Fit {company.fit_score}
          </p>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${rankTone[company.strategy_rank]}`}>
          {company.strategy_rank}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StatusBadge tone={statusMeta.tone}>{statusMeta.en}</StatusBadge>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{company.selection_risk}</span>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
          {company.success_probability}%
        </span>
      </div>
      {company.recommended_action && <p className="mt-3 text-sm text-muted-foreground">{company.recommended_action}</p>}
    </button>
  )
}

export function StrategyView() {
  const [summary, setSummary] = useState<StrategySummary>(emptySummary)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [memoSaving, setMemoSaving] = useState(false)
  const [selectedCompany, setSelectedCompany] = useState<StrategyCompany | null>(null)
  const [memoForm, setMemoForm] = useState<StrategyMemoForm | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadStrategy = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setSummary(await apiRequest<StrategySummary>("/strategy"))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load strategy.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadStrategy()
  }, [loadStrategy])

  const recalculate = async () => {
    setSaving(true)
    setError(null)
    try {
      setSummary(await apiRequest<StrategySummary>("/strategy/recalculate", { method: "POST" }))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to recalculate strategy.")
    } finally {
      setSaving(false)
    }
  }

  const selectCompany = (company: StrategyCompany) => {
    setSelectedCompany(company)
    setMemoForm(toMemoForm(company))
  }

  const saveMemo = async () => {
    if (!selectedCompany || !memoForm) return
    setMemoSaving(true)
    setError(null)
    try {
      await apiRequest<StrategyCompany>(`/companies/${selectedCompany.id}`, {
        method: "PUT",
        body: JSON.stringify({
          strategy_rank: memoForm.strategy_rank,
          difficulty_level: memoForm.difficulty_level,
          fit_score: memoForm.fit_score,
          success_probability: memoForm.success_probability,
          selection_risk: memoForm.selection_risk,
          recommended_action: memoForm.recommended_action || null,
          strategy_reason: memoForm.strategy_reason || null,
          user_strategy_note: memoForm.user_strategy_note || null,
        }),
      })
      const nextSummary = await apiRequest<StrategySummary>("/strategy")
      setSummary(nextSummary)
      const nextCompany = Object.values(nextSummary.buckets)
        .flatMap((bucket) => bucket.companies)
        .find((company) => company.id === selectedCompany.id)
      if (nextCompany) {
        setSelectedCompany(nextCompany)
        setMemoForm(toMemoForm(nextCompany))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save strategy memo.")
    } finally {
      setMemoSaving(false)
    }
  }

  const biggestIssue = useMemo(() => {
    if (summary.metrics.spi_rejected >= 2) return "SPI"
    if (summary.metrics.es_rejected >= 2) return "ES"
    if (summary.metrics.interviews < 3) return "Interview volume"
    return "Balanced"
  }, [summary])

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            <BrainCircuit className="h-4 w-4" />
            <span>Strategy MVP</span>
          </div>
          <h2 className="mt-2 text-xl font-semibold text-foreground">Application Strategy Dashboard</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Review S/A/B balance, rejection patterns, and next actions for better offer odds.
          </p>
        </div>
        <button
          type="button"
          onClick={recalculate}
          disabled={saving}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${saving ? "animate-spin" : ""}`} />
          Recalculate
        </button>
      </div>

      {error && <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}
      {loading && <div className="rounded-xl border border-border bg-card px-4 py-6 text-sm text-muted-foreground">Loading strategy...</div>}

      {!loading && (
        <>
          <section className="grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-border bg-card p-4 md:col-span-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <BarChart3 className="h-4 w-4 text-accent" />
                Application Balance
              </div>
              <div className="mt-4 space-y-4">
                <StrategyMeter label="S rank" value={summary.ratios.S ?? 0} />
                <StrategyMeter label="A rank" value={summary.ratios.A ?? 0} />
                <StrategyMeter label="B rank" value={summary.ratios.B ?? 0} />
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <ShieldAlert className="h-4 w-4 text-destructive" />
                Rejection Pattern
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-muted-foreground">ES rejected</p><p className="text-2xl font-semibold text-foreground">{summary.metrics.es_rejected}</p></div>
                <div><p className="text-muted-foreground">SPI rejected</p><p className="text-2xl font-semibold text-foreground">{summary.metrics.spi_rejected}</p></div>
                <div><p className="text-muted-foreground">Interview</p><p className="text-2xl font-semibold text-foreground">{summary.metrics.interviews}</p></div>
                <div><p className="text-muted-foreground">Offer</p><p className="text-2xl font-semibold text-foreground">{summary.metrics.offers}</p></div>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Target className="h-4 w-4 text-primary" />
                Main Issue
              </div>
              <p className="mt-4 text-3xl font-semibold text-foreground">{biggestIssue}</p>
              <p className="mt-2 text-sm text-muted-foreground">Rule-based diagnosis from current company data.</p>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            {(["S", "A", "B"] as StrategyRank[]).map((rank) => (
              <div key={rank} className="rounded-2xl border border-border bg-card p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold text-foreground">Rank {rank}</h3>
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${rankTone[rank]}`}>
                    {summary.counts[rank] ?? 0} / {summary.ratios[rank] ?? 0}%
                  </span>
                </div>
                <div className="space-y-3">
                  {summary.buckets[rank]?.companies.length ? (
                    summary.buckets[rank].companies.map((company) => <CompanyStrategyCard key={company.id} company={company} onSelect={selectCompany} />)
                  ) : (
                    <p className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">No companies yet.</p>
                  )}
                </div>
              </div>
            ))}
          </section>

          {selectedCompany && memoForm && (
            <section className="rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                    <Target className="h-4 w-4" />
                    <span>Strategy Memo</span>
                  </div>
                  <h3 className="mt-2 text-lg font-semibold text-foreground">{selectedCompany.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Edit why this rank matters, what the risk is, and what to do next.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCompany(null)
                    setMemoForm(null)
                  }}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                  Close
                </button>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-6">
                <select
                  value={memoForm.strategy_rank}
                  onChange={(event) => setMemoForm((current) => current && ({ ...current, strategy_rank: event.target.value as StrategyRank }))}
                  className="rounded-lg border border-border bg-background px-3 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                >
                  {strategyRanks.map((rank) => (
                    <option key={rank} value={rank}>Rank {rank}</option>
                  ))}
                </select>
                <input
                  value={memoForm.difficulty_level}
                  onChange={(event) => setMemoForm((current) => current && ({ ...current, difficulty_level: Number(event.target.value) }))}
                  type="number"
                  min={1}
                  max={5}
                  aria-label="Difficulty level"
                  className="rounded-lg border border-border bg-background px-3 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                />
                <input
                  value={memoForm.fit_score}
                  onChange={(event) => setMemoForm((current) => current && ({ ...current, fit_score: Number(event.target.value) }))}
                  type="number"
                  min={0}
                  max={100}
                  aria-label="Fit score"
                  className="rounded-lg border border-border bg-background px-3 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                />
                <input
                  value={memoForm.success_probability}
                  onChange={(event) => setMemoForm((current) => current && ({ ...current, success_probability: Number(event.target.value) }))}
                  type="number"
                  min={0}
                  max={100}
                  aria-label="Success probability"
                  className="rounded-lg border border-border bg-background px-3 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                />
                <select
                  value={memoForm.selection_risk}
                  onChange={(event) => setMemoForm((current) => current && ({ ...current, selection_risk: event.target.value as SelectionRisk }))}
                  className="rounded-lg border border-border bg-background px-3 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                >
                  {selectionRisks.map((risk) => (
                    <option key={risk} value={risk}>Risk {risk}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={saveMemo}
                  disabled={memoSaving}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  Save
                </button>
                <textarea
                  value={memoForm.recommended_action}
                  onChange={(event) => setMemoForm((current) => current && ({ ...current, recommended_action: event.target.value }))}
                  placeholder="Recommended action"
                  rows={3}
                  className="min-h-24 resize-y rounded-lg border border-border bg-background px-3 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring lg:col-span-2"
                />
                <textarea
                  value={memoForm.strategy_reason}
                  onChange={(event) => setMemoForm((current) => current && ({ ...current, strategy_reason: event.target.value }))}
                  placeholder="Strategy reason"
                  rows={3}
                  className="min-h-24 resize-y rounded-lg border border-border bg-background px-3 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring lg:col-span-2"
                />
                <textarea
                  value={memoForm.user_strategy_note}
                  onChange={(event) => setMemoForm((current) => current && ({ ...current, user_strategy_note: event.target.value }))}
                  placeholder="User strategy note"
                  rows={3}
                  className="min-h-24 resize-y rounded-lg border border-border bg-background px-3 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring lg:col-span-2"
                />
              </div>
            </section>
          )}

          <section className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Trophy className="h-4 w-4 text-warning" />
              Recommended Actions
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {summary.recommended_actions.length ? (
                summary.recommended_actions.map((action, index) => (
                  <article key={`${action.title}-${index}`} className="rounded-xl border border-border bg-background/70 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-semibold text-foreground">{action.title}</h3>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${urgencyTone[action.urgency] ?? urgencyTone.low}`}>
                        {action.urgency}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{action.reason}</p>
                    <p className="mt-3 text-sm font-medium text-foreground">{action.action}</p>
                  </article>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                  <AlertTriangle className="mb-2 h-4 w-4" />
                  No extra recommended actions.
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
