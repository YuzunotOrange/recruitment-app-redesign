"use client"

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import {
  AlertTriangle,
  BarChart3,
  BrainCircuit,
  Check,
  CircleHelp,
  Edit3,
  RefreshCw,
  Save,
  Target,
  Trophy,
  X,
  XCircle,
} from "lucide-react"
import { apiRequest } from "@/lib/api"
import { companyStatusMeta, industryMeta, type CompanyStatus, type Industry, type Priority } from "@/lib/data"
import { StatusBadge } from "@/components/status-badge"

type StrategyRank = "S" | "A" | "B"
type SelectionRisk = "ES" | "SPI" | "Interview" | "Unknown"
type StrategyPosition = "Reach" | "Core" | "Safe" | "Hold"

type StrategyCompany = {
  id: number
  name: string
  industry: Industry
  priority: Priority
  importance: number
  status: CompanyStatus
  es_deadline: string | null
  strategy_rank: StrategyRank | null
  difficulty_level: number | null
  fit_score: number | null
  success_probability: number | null
  selection_risk: SelectionRisk | null
  recommended_action: string | null
  strategy_reason: string | null
  user_strategy_note: string | null
  research_status: "not_generated" | "mock_generated" | "generated" | "accepted" | "rejected"
  research_provider: string | null
  accepted_research_summary: string | null
  accepted_research_at: string | null
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

type StrategyMemoForm = {
  strategy_position: StrategyPosition
  reason: string
  next_action: string
  personal_notes: string
}

const strategyPositions: StrategyPosition[] = ["Reach", "Core", "Safe", "Hold"]
const activeStrategyPositions: Exclude<StrategyPosition, "Hold">[] = ["Reach", "Core", "Safe"]

const idealRatios: Record<Exclude<StrategyPosition, "Hold">, number> = {
  Reach: 30,
  Core: 50,
  Safe: 20,
}

const positionTone: Record<StrategyPosition, string> = {
  Reach: "border-fuchsia-400/40 bg-fuchsia-500/10 text-fuchsia-200",
  Core: "border-cyan-400/40 bg-cyan-500/10 text-cyan-200",
  Safe: "border-emerald-400/40 bg-emerald-500/10 text-emerald-200",
  Hold: "border-zinc-400/40 bg-zinc-500/10 text-zinc-200",
}

const urgencyTone: Record<string, string> = {
  high: "bg-destructive/10 text-destructive ring-destructive/20",
  medium: "bg-warning/15 text-warning-foreground ring-warning/20",
  low: "bg-success/10 text-success ring-success/20",
}

const researchStatusLabel: Record<StrategyCompany["research_status"], string> = {
  not_generated: "Not generated",
  mock_generated: "Mock generated",
  generated: "Generated",
  accepted: "Accepted",
  rejected: "Rejected",
}

const researchStatusTone: Record<StrategyCompany["research_status"], string> = {
  not_generated: "bg-muted text-muted-foreground ring-border",
  mock_generated: "bg-warning/10 text-warning-foreground ring-warning/30",
  generated: "bg-primary/10 text-primary ring-primary/30",
  accepted: "bg-success/10 text-success ring-success/30",
  rejected: "bg-destructive/10 text-destructive ring-destructive/30",
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

function readMemoBlock(source: string | null, label: string) {
  if (!source) return ""
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const match = source.match(new RegExp(`\\[${escaped}\\]\\n([\\s\\S]*?)(?=\\n\\n\\[[^\\]]+\\]|$)`))
  return match?.[1]?.trim() ?? ""
}

function writeUserStrategyNote(form: StrategyMemoForm) {
  return [
    `[Strategy Position]\n${form.strategy_position}`,
    `[Reason]\n${form.reason.trim()}`,
    `[Next Action]\n${form.next_action.trim()}`,
    `[Personal Notes]\n${form.personal_notes.trim()}`,
  ].join("\n\n")
}

function hasSystemAnalysis(company: StrategyCompany) {
  return (
    company.difficulty_level != null ||
    company.fit_score != null ||
    company.success_probability != null ||
    Boolean(company.selection_risk && company.selection_risk !== "Unknown") ||
    Boolean(company.strategy_rank)
  )
}

function systemRecommendation(company: StrategyCompany): StrategyPosition | null {
  if (!hasSystemAnalysis(company)) return null
  if (company.status === "declined" || (company.success_probability != null && company.success_probability < 30)) return "Hold"
  if (company.strategy_rank === "S") return "Reach"
  if (company.strategy_rank === "A") return "Core"
  if (company.strategy_rank === "B") return "Safe"
  return "Core"
}

function strategyPositionOf(company: StrategyCompany): StrategyPosition {
  const storedPosition = readMemoBlock(company.user_strategy_note, "Strategy Position") as StrategyPosition
  if (strategyPositions.includes(storedPosition)) return storedPosition
  return systemRecommendation(company) ?? "Hold"
}

function toMemoForm(company: StrategyCompany): StrategyMemoForm {
  const storedReason = readMemoBlock(company.user_strategy_note, "Reason")
  const storedNextAction = readMemoBlock(company.user_strategy_note, "Next Action")
  const personalNotesBlock = readMemoBlock(company.user_strategy_note, "Personal Notes")
  const hasStructuredNote = Boolean(readMemoBlock(company.user_strategy_note, "Strategy Position") || storedReason || storedNextAction || personalNotesBlock)

  return {
    strategy_position: strategyPositionOf(company),
    reason: storedReason || (company.strategy_reason ?? ""),
    next_action: storedNextAction || (company.recommended_action ?? ""),
    personal_notes: hasStructuredNote ? personalNotesBlock : company.user_strategy_note ?? "",
  }
}

function formatDate(dateIso: string | null) {
  if (!dateIso) return "-"
  const [year, month, day] = dateIso.split("-").map(Number)
  if (!year || !month || !day) return dateIso
  return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(year, month - 1, day))
}

function formatDateTime(value: string | null) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function displayValue(value: number | string | null | undefined, suffix = "") {
  if (value == null || value === "") return "Not analyzed"
  return `${value}${suffix}`
}

function difficultyStars(level: number | null) {
  if (level == null) return "Not analyzed"
  const safeLevel = Math.max(1, Math.min(5, level))
  return `${"★".repeat(safeLevel)}${"☆".repeat(5 - safeLevel)}`
}

function interviewStatus(status: CompanyStatus) {
  if (status === "interview") return "Interview active"
  if (status === "offer") return "Offer reached"
  if (status === "es_rejected") return "Stopped at ES"
  if (status === "spi_rejected") return "Stopped at SPI"
  if (status === "declined") return "Declined"
  return "Not started"
}

function flattenCompanies(summary: StrategySummary) {
  const byId = new Map<number, StrategyCompany>()
  Object.values(summary.buckets).forEach((bucket) => {
    bucket.companies.forEach((company) => byId.set(company.id, company))
  })
  return Array.from(byId.values())
}

function mainIssueText(metrics: StrategySummary["metrics"]) {
  if (metrics.offers > 0) return "内定後の比較・意思決定"
  if (metrics.spi_rejected >= metrics.es_rejected && metrics.spi_rejected > 0) return "SPI対策が最優先"
  if (metrics.es_rejected > metrics.spi_rejected && metrics.es_rejected > 0) return "ES改善が最優先"
  if (metrics.interviews < 3) return "面接機会を増やす"
  return "バランス良好"
}

function balanceRatio(position: Exclude<StrategyPosition, "Hold">, buckets: Record<StrategyPosition, StrategyCompany[]>) {
  const activeTotal = activeStrategyPositions.reduce((total, item) => total + buckets[item].length, 0)
  return activeTotal ? Math.round((buckets[position].length / activeTotal) * 1000) / 10 : 0
}

function balanceAdvice(buckets: Record<StrategyPosition, StrategyCompany[]>) {
  const activeTotal = activeStrategyPositions.reduce((total, position) => total + buckets[position].length, 0)
  if (!activeTotal) return "Reach / Core / Safe に企業を分類すると応募バランスを確認できます。"

  const shortages = activeStrategyPositions
    .map((position) => {
      const idealCount = Math.ceil((activeTotal * idealRatios[position]) / 100)
      return { position, shortage: Math.max(0, idealCount - buckets[position].length) }
    })
    .filter((item) => item.shortage > 0)
    .sort((a, b) => b.shortage - a.shortage)

  if (!shortages.length) return "現在の応募バランスは理想比率に近いです。"
  const target = shortages[0]
  return `${target.position}企業をあと${target.shortage}社追加するとバランスが良くなります。`
}

function SummaryCard({ label, value, description }: { label: string; value: number | string; description?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
      {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
    </div>
  )
}

function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        aria-label="Show explanation"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card text-xs font-semibold text-muted-foreground hover:text-foreground"
      >
        ?
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-20 w-64 rounded-xl border border-border bg-popover p-3 text-xs leading-relaxed text-popover-foreground shadow-lg">
          {text}
        </div>
      )}
    </div>
  )
}

function SectionHeader({
  title,
  description,
  tone,
}: {
  title: string
  description: string
  tone: "readonly" | "ai" | "user"
}) {
  const toneClass = {
    readonly: "text-blue-300",
    ai: "text-purple-300",
    user: "text-pink-300",
  }[tone]

  return (
    <div>
      <h4 className={`text-base font-semibold ${toneClass}`}>{title}</h4>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

function ReadOnlyItem({
  title,
  value,
  description,
  children,
  why,
}: {
  title: string
  value?: string
  description: string
  children?: ReactNode
  why?: string
}) {
  return (
    <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-300">Read Only</p>
          <p className="mt-2 text-sm font-semibold text-foreground">{title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        {why && <InfoTip text={why} />}
      </div>
      <div className="mt-3 text-sm font-semibold text-foreground">{children ?? value}</div>
    </div>
  )
}

function AiItem({
  title,
  value,
  description,
  children,
  why,
}: {
  title: string
  value?: string
  description: string
  children?: ReactNode
  why: string
}) {
  return (
    <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-purple-300">AI / System</p>
          <p className="mt-2 text-sm font-semibold text-foreground">{title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        <InfoTip text={why} />
      </div>
      <div className="mt-3 text-sm font-semibold text-foreground">{children ?? value}</div>
    </div>
  )
}

function UserField({
  title,
  description,
  why,
  children,
}: {
  title: string
  description: string
  why: string
  children: ReactNode
}) {
  return (
    <div className="rounded-xl border border-pink-500/30 bg-pink-500/10 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-pink-300">User Input</p>
          <label className="mt-2 block text-sm font-semibold text-foreground">{title}</label>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        <InfoTip text={why} />
      </div>
      <div className="mt-3">{children}</div>
    </div>
  )
}

function BalanceMeter({
  label,
  current,
  ideal,
  count,
}: {
  label: Exclude<StrategyPosition, "Hold">
  current: number
  ideal: number
  count: number
}) {
  const delta = Math.round((current - ideal) * 10) / 10

  return (
    <div className="rounded-xl border border-border bg-background/60 p-3">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-semibold text-foreground">{label}</span>
        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${positionTone[label]}`}>
          {count} companies
        </span>
      </div>
      <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
        <span>Current: {current}%</span>
        <span>Ideal: {ideal}%</span>
        <span>{delta >= 0 ? `+${delta}%` : `${delta}%`}</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(current, 100)}%` }} />
      </div>
    </div>
  )
}

function CompanyStrategyCard({ company, onSelect }: { company: StrategyCompany; onSelect: (company: StrategyCompany) => void }) {
  const statusMeta = companyStatusMeta[company.status]
  const position = strategyPositionOf(company)

  return (
    <button type="button" onClick={() => onSelect(company)} className="w-full rounded-xl border border-border bg-background/70 p-4 text-left hover:bg-muted/40">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{company.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">Company Rank: {company.priority} / 志望度</p>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${positionTone[position]}`}>
          {position}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StatusBadge tone={statusMeta.tone}>{statusMeta.en}</StatusBadge>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          Main Risk: {company.selection_risk && company.selection_risk !== "Unknown" ? company.selection_risk : "Not analyzed"}
        </span>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
          Success: {displayValue(company.success_probability, "%")}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${researchStatusTone[company.research_status]}`}>
          AI Research: {researchStatusLabel[company.research_status]}
        </span>
      </div>
      <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Next Action:</span> {company.recommended_action || "Not set"}
      </p>
      <span className="mt-3 inline-flex min-h-9 items-center rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground">
        Open Memo / Edit Strategy
      </span>
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

  const companies = useMemo(() => flattenCompanies(summary), [summary])

  const positionBuckets = useMemo(() => {
    const buckets: Record<StrategyPosition, StrategyCompany[]> = { Reach: [], Core: [], Safe: [], Hold: [] }
    companies.forEach((company) => buckets[strategyPositionOf(company)].push(company))
    return buckets
  }, [companies])

  const positionRatios = useMemo(() => {
    const total = activeStrategyPositions.reduce((count, position) => count + positionBuckets[position].length, 0)
    return strategyPositions.reduce<Record<StrategyPosition, number>>(
      (ratios, position) => {
        ratios[position] =
          position === "Hold" ? 0 : total ? Math.round((positionBuckets[position].length / total) * 1000) / 10 : 0
        return ratios
      },
      { Reach: 0, Core: 0, Safe: 0, Hold: 0 },
    )
  }, [positionBuckets])

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
          recommended_action: memoForm.next_action || null,
          strategy_reason: memoForm.reason || null,
          user_strategy_note: writeUserStrategyNote(memoForm),
        }),
      })
      const nextSummary = await apiRequest<StrategySummary>("/strategy")
      setSummary(nextSummary)
      const nextCompany = flattenCompanies(nextSummary).find((company) => company.id === selectedCompany.id)
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

  const biggestIssue = useMemo(() => mainIssueText(summary.metrics), [summary.metrics])
  const balanceMessage = useMemo(() => balanceAdvice(positionBuckets), [positionBuckets])

  const selectedSystemRecommendation = selectedCompany ? systemRecommendation(selectedCompany) : null

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
            Strategy Position shows portfolio balance. Company Rank stays as preference only.
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
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <SummaryCard label="Total Companies" value={summary.metrics.total_companies} description="Registered companies" />
            <SummaryCard label="Reach" value={positionBuckets.Reach.length} description="Strategy Position" />
            <SummaryCard label="Core" value={positionBuckets.Core.length} description="Strategy Position" />
            <SummaryCard label="Safe" value={positionBuckets.Safe.length} description="Strategy Position" />
            <SummaryCard label="Hold" value={positionBuckets.Hold.length} description="Excluded from balance" />
            <SummaryCard label="ES Rejected" value={summary.metrics.es_rejected} />
            <SummaryCard label="SPI Rejected" value={summary.metrics.spi_rejected} />
            <SummaryCard label="Interview" value={summary.metrics.interviews} />
            <SummaryCard label="Offer" value={summary.metrics.offers} />
            <SummaryCard label="Main Issue" value={biggestIssue} description="Rule-based diagnosis" />
          </section>

          <section className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <BarChart3 className="h-4 w-4 text-accent" />
                Application Balance
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Balance uses Strategy Position only. Company Rank is shown as preference data.
              </p>
              <div className="mt-4 grid gap-3 lg:grid-cols-3">
                {activeStrategyPositions.map((position) => (
                  <BalanceMeter
                    key={position}
                    label={position}
                    count={positionBuckets[position].length}
                    current={balanceRatio(position, positionBuckets)}
                    ideal={idealRatios[position]}
                  />
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Target className="h-4 w-4 text-primary" />
                Balance Advice
              </div>
              <p className="mt-4 text-lg font-semibold text-foreground">{balanceMessage}</p>
              <div className="mt-4 rounded-xl border border-border bg-background/60 p-3 text-sm text-muted-foreground">
                Hold: {positionBuckets.Hold.length} companies. Hold is tracked separately and excluded from the ideal ratio.
              </div>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-4">
            {strategyPositions.map((position) => (
              <div key={position} className="rounded-2xl border border-border bg-card p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold text-foreground">{position}</h3>
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${positionTone[position]}`}>
                    {positionBuckets[position].length} / {position === "Hold" ? "separate" : `${positionRatios[position]}%`}
                  </span>
                </div>
                {position === "Hold" && (
                  <p className="mb-3 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                    Hold is shown separately and is not included in Application Balance.
                  </p>
                )}
                <div className="space-y-3">
                  {positionBuckets[position].length ? (
                    positionBuckets[position].map((company) => <CompanyStrategyCard key={company.id} company={company} onSelect={selectCompany} />)
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
                  <p className="mt-1 text-sm text-muted-foreground">
                    Read the system analysis, then decide your own application strategy.
                  </p>
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

              <div className="mt-4 space-y-5">
                <div className="rounded-2xl border border-blue-500/30 bg-blue-500/5 p-4">
                  <SectionHeader title="Company Information" description="Basic company fields from the Company Add/Edit form. Read only here." tone="readonly" />
                  <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <ReadOnlyItem title="Company Rank" description="Preference level: how much you want this company." value={selectedCompany.priority} why="Company Rank is S/A/B/C preference. It is not the strategy position." />
                    <ReadOnlyItem title="Industry" description="Registered industry." value={industryMeta[selectedCompany.industry]?.en ?? selectedCompany.industry} />
                    <ReadOnlyItem title="Current Status" description="Current selection status." why="This comes from the company status field.">
                      <StatusBadge tone={companyStatusMeta[selectedCompany.status].tone}>{companyStatusMeta[selectedCompany.status].en}</StatusBadge>
                    </ReadOnlyItem>
                    <ReadOnlyItem title="ES Deadline" description="Registered ES deadline." value={formatDate(selectedCompany.es_deadline)} />
                    <ReadOnlyItem title="Interview Status" description="Interview phase state." value={interviewStatus(selectedCompany.status)} />
                  </div>
                </div>

                <div className="rounded-2xl border border-purple-500/30 bg-purple-500/5 p-4">
                  <SectionHeader title="AI / System Analysis" description="System-calculated analysis. These fields are read only." tone="ai" />
                  <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <AiItem title="Selection Difficulty" description="Company selection difficulty." why="This is the company's selection difficulty, not your ability.">
                      <span className="text-lg tracking-wide text-warning">{difficultyStars(selectedCompany.difficulty_level)}</span>
                    </AiItem>
                    <AiItem title="Fit Score" description="Fit with your experience and direction." value={displayValue(selectedCompany.fit_score, " / 100")} why="This estimates fit with your research, development experience, and interests." />
                    <AiItem title="Current Success Probability" description="Estimated passing probability." value={displayValue(selectedCompany.success_probability, "%")} why="This is calculated from the current ES, SPI, and interview status." />
                    <AiItem title="Main Risk" description="Most important item to prepare." value={selectedCompany.selection_risk && selectedCompany.selection_risk !== "Unknown" ? selectedCompany.selection_risk : "Not analyzed"} why="This shows the current selection area that needs the most attention." />
                    <AiItem title="AI Suggested Position" description="System-suggested strategy position." why="This is a suggestion. Your final Strategy Position is selected below.">
                      {selectedSystemRecommendation ? (
                        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${positionTone[selectedSystemRecommendation]}`}>
                          {selectedSystemRecommendation}
                        </span>
                      ) : (
                        "Not analyzed"
                      )}
                    </AiItem>
                  </div>
                  <div className="mt-4 rounded-xl border border-purple-500/30 bg-background/60 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-foreground">Accepted Research</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {selectedCompany.research_status === "accepted" ? "あり" : "なし"}
                        </p>
                      </div>
                      <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2 lg:min-w-[420px]">
                        <p><span className="font-medium text-foreground">Accepted at:</span> {formatDateTime(selectedCompany.accepted_research_at)}</p>
                        <p><span className="font-medium text-foreground">Provider:</span> {selectedCompany.research_provider ?? "-"}</p>
                      </div>
                    </div>
                    {selectedCompany.accepted_research_summary ? (
                      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{selectedCompany.accepted_research_summary}</p>
                    ) : (
                      <p className="mt-3 text-sm text-muted-foreground">No accepted AI Research has been linked to this Strategy Memo yet.</p>
                    )}
                    {selectedCompany.research_provider === "mock" && (
                      <p className="mt-3 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
                        This is demo research generated by MockAIProvider. It does not use real company websites, IR, or news yet.
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-pink-500/30 bg-pink-500/5 p-4">
                  <SectionHeader title="Your Decision" description="Only these fields are edited by you." tone="user" />
                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    <UserField title="Strategy Position" description="Reach, Core, Safe, or Hold." why="Strategy Position is your portfolio role for this application. It is separate from Company Rank.">
                      <select
                        value={memoForm.strategy_position}
                        onChange={(event) => setMemoForm((current) => current && ({ ...current, strategy_position: event.target.value as StrategyPosition }))}
                        className="min-h-11 w-full rounded-lg border border-pink-500/30 bg-card px-3 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-pink-500/40"
                      >
                        <option value="Reach">Reach</option>
                        <option value="Core">Core</option>
                        <option value="Safe">Safe</option>
                        <option value="Hold">Hold</option>
                      </select>
                    </UserField>
                    <UserField title="Reason" description="Why you chose this strategy position." why="Write the reason in your own words so the decision is clear later.">
                      <textarea
                        value={memoForm.reason}
                        onChange={(event) => setMemoForm((current) => current && ({ ...current, reason: event.target.value }))}
                        placeholder="Example: First choice. Difficult, but I want to challenge it."
                        rows={4}
                        className="min-h-28 w-full resize-y rounded-lg border border-pink-500/30 bg-card px-3 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-pink-500/40"
                      />
                    </UserField>
                    <UserField title="Next Action" description="The next concrete action for this company." why="Keep it specific enough to act on this week.">
                      <textarea
                        value={memoForm.next_action}
                        onChange={(event) => setMemoForm((current) => current && ({ ...current, next_action: event.target.value }))}
                        placeholder="Example: Focus on SPI practice."
                        rows={4}
                        className="min-h-28 w-full resize-y rounded-lg border border-pink-500/30 bg-card px-3 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-pink-500/40"
                      />
                    </UserField>
                    <UserField title="Personal Notes" description="Free notes for briefings, alumni visits, and interviews." why="Keep small observations here so you can review them before interviews.">
                      <textarea
                        value={memoForm.personal_notes}
                        onChange={(event) => setMemoForm((current) => current && ({ ...current, personal_notes: event.target.value }))}
                        placeholder={"Example: Ask for an alumni visit.\nEmphasize research experience in interviews."}
                        rows={5}
                        className="min-h-32 w-full resize-y rounded-lg border border-pink-500/30 bg-card px-3 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-pink-500/40"
                      />
                    </UserField>
                  </div>

                  <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                      <button
                        type="button"
                        disabled={!selectedSystemRecommendation}
                        onClick={() => selectedSystemRecommendation && setMemoForm((current) => current && ({ ...current, strategy_position: selectedSystemRecommendation }))}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-2 text-sm font-medium text-purple-200 hover:bg-purple-500/15 disabled:opacity-50"
                      >
                        <Check className="h-4 w-4" />
                        Use AI Suggested Position
                      </button>
                      <button
                        type="button"
                        onClick={() => setMemoForm((current) => current && ({ ...current, reason: current.reason || "I will review the system suggestion and adjust it with my own judgment." }))}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-pink-500/30 bg-pink-500/10 px-3 py-2 text-sm font-medium text-pink-200 hover:bg-pink-500/15"
                      >
                        <Edit3 className="h-4 w-4" />
                        Edit Before Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setMemoForm((current) => current && ({ ...current, strategy_position: "Hold", reason: current.reason || "Hold for now and review after collecting more information." }))}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-zinc-500/30 bg-zinc-500/10 px-3 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-500/15"
                      >
                        <XCircle className="h-4 w-4" />
                        Reject Suggestion
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={saveMemo}
                      disabled={memoSaving}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                    >
                      <Save className="h-4 w-4" />
                      Save Decision
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-background/40 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <CircleHelp className="h-4 w-4 text-accent" />
                    Why?
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Company Rank means preference. Strategy Position means portfolio role: Reach, Core, Safe, or Hold.
                  </p>
                </div>
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

