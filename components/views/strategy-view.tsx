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
  ShieldAlert,
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

type StrategyMemoForm = {
  strategy_position: StrategyPosition
  reason: string
  next_action: string
  personal_notes: string
}

const rankTone: Record<StrategyRank, string> = {
  S: "border-destructive/30 bg-destructive/10 text-destructive",
  A: "border-warning/30 bg-warning/15 text-warning-foreground",
  B: "border-accent/30 bg-accent/10 text-accent",
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

const strategyPositions: StrategyPosition[] = ["Reach", "Core", "Safe", "Hold"]

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

function aiRecommendation(company: StrategyCompany): StrategyPosition {
  if (company.status === "declined" || company.success_probability < 30) return "Hold"
  if (company.strategy_rank === "S") return "Reach"
  if (company.strategy_rank === "A") return "Core"
  return "Safe"
}

function toMemoForm(company: StrategyCompany): StrategyMemoForm {
  const storedPosition = readMemoBlock(company.user_strategy_note, "Strategy Position") as StrategyPosition
  const storedReason = readMemoBlock(company.user_strategy_note, "Reason")
  const storedNextAction = readMemoBlock(company.user_strategy_note, "Next Action")
  const personalNotesBlock = readMemoBlock(company.user_strategy_note, "Personal Notes")
  const hasStructuredNote = Boolean(storedPosition || storedReason || storedNextAction || personalNotesBlock)

  return {
    strategy_position: strategyPositions.includes(storedPosition) ? storedPosition : aiRecommendation(company),
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

function difficultyStars(level: number) {
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
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-purple-300">AIが分析</p>
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
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-pink-300">あなたが入力</p>
          <label className="mt-2 block text-sm font-semibold text-foreground">{title}</label>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        <InfoTip text={why} />
      </div>
      <div className="mt-3">{children}</div>
    </div>
  )
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
  const recommendation = aiRecommendation(company)

  return (
    <button type="button" onClick={() => onSelect(company)} className="w-full rounded-xl border border-border bg-background/70 p-4 text-left hover:bg-muted/40">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{company.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Company Rank {company.priority} / Fit {company.fit_score}
          </p>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${positionTone[recommendation]}`}>
          {recommendation}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StatusBadge tone={statusMeta.tone}>{statusMeta.en}</StatusBadge>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{company.selection_risk}</span>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
          {company.success_probability}%
        </span>
      </div>
      {company.recommended_action && <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{company.recommended_action}</p>}
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
          recommended_action: memoForm.next_action || null,
          strategy_reason: memoForm.reason || null,
          user_strategy_note: writeUserStrategyNote(memoForm),
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

  const selectedAiRecommendation = selectedCompany ? aiRecommendation(selectedCompany) : "Core"

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
                  <h3 className="font-semibold text-foreground">System Rank {rank}</h3>
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
                  <p className="mt-1 text-sm text-muted-foreground">
                    AIが分析した結果を見ながら、あなた自身の応募戦略を決める画面です。
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
                  <SectionHeader
                    title="Company Information"
                    description="企業一覧で登録済みの基本情報です。このセクションは編集できません。"
                    tone="readonly"
                  />
                  <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <ReadOnlyItem title="Company Rank" description="企業そのものの志望度です。" value={selectedCompany.priority} why="Company一覧で設定したS〜Cの志望度です。Strategy Positionとは別の情報です。" />
                    <ReadOnlyItem title="Industry" description="登録済みの業界です。" value={industryMeta[selectedCompany.industry]?.en ?? selectedCompany.industry} />
                    <ReadOnlyItem title="Current Status" description="現在の選考ステータスです。" why="企業の現在地を確認するための情報です。">
                      <StatusBadge tone={companyStatusMeta[selectedCompany.status].tone}>{companyStatusMeta[selectedCompany.status].en}</StatusBadge>
                    </ReadOnlyItem>
                    <ReadOnlyItem title="ES Deadline" description="登録済みのES締切です。" value={formatDate(selectedCompany.es_deadline)} />
                    <ReadOnlyItem title="Interview Status" description="面接フェーズの状態です。" value={interviewStatus(selectedCompany.status)} />
                  </div>
                </div>

                <div className="rounded-2xl border border-purple-500/30 bg-purple-500/5 p-4">
                  <SectionHeader
                    title="AI / System Analysis"
                    description="ステータス、難易度、相性、通過可能性からシステムが自動分析します。ここは編集しません。"
                    tone="ai"
                  />
                  <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <AiItem
                      title="Selection Difficulty"
                      description="企業の選考難易度"
                      why="企業自体の選考難易度です。あなたの能力ではありません。"
                    >
                      <span className="text-lg tracking-wide text-warning">{difficultyStars(selectedCompany.difficulty_level)}</span>
                    </AiItem>
                    <AiItem
                      title="Fit Score"
                      description="研究・開発経験・志向との相性"
                      value={`${selectedCompany.fit_score} / 100`}
                      why="あなたの研究・開発経験や志向との相性です。"
                    />
                    <AiItem
                      title="Current Success Probability"
                      description="現在の選考状況から推定した通過可能性"
                      value={`${selectedCompany.success_probability}%`}
                      why="現在のES・SPI・面接状況から計算されます。確定値ではなく判断材料です。"
                    />
                    <AiItem
                      title="Main Risk"
                      description="現在最も対策すべき項目"
                      value={selectedCompany.selection_risk}
                      why="直近で落ちやすい、または準備が必要な選考項目です。"
                    />
                    <AiItem
                      title="AI Recommendation"
                      description="AI・システムが提案する応募戦略"
                      why="企業ランク、難易度、相性、通過可能性から提案します。最終判断はあなたが行います。"
                    >
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${positionTone[selectedAiRecommendation]}`}>
                        {selectedAiRecommendation}
                      </span>
                    </AiItem>
                  </div>
                </div>

                <div className="rounded-2xl border border-pink-500/30 bg-pink-500/5 p-4">
                  <SectionHeader
                    title="Your Decision"
                    description="AI提案ではなく、あなた自身の応募戦略を決めます。ここだけ編集できます。"
                    tone="user"
                  />
                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    <UserField
                      title="Strategy Position"
                      description="Reach（挑戦） / Core（本命） / Safe（安全） / Hold（保留）から選びます。"
                      why="最終的にあなたが決める応募戦略です。Company Rankとは別に、応募ポートフォリオ上の位置づけを決めます。"
                    >
                      <select
                        value={memoForm.strategy_position}
                        onChange={(event) => setMemoForm((current) => current && ({ ...current, strategy_position: event.target.value as StrategyPosition }))}
                        className="min-h-11 w-full rounded-lg border border-pink-500/30 bg-card px-3 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-pink-500/40"
                      >
                        <option value="Reach">Reach（挑戦）</option>
                        <option value="Core">Core（本命）</option>
                        <option value="Safe">Safe（安全）</option>
                        <option value="Hold">Hold（保留）</option>
                      </select>
                    </UserField>
                    <UserField
                      title="Reason"
                      description="なぜこの応募戦略にするのかを書きます。"
                      why="難易度や志望度だけでなく、自分が納得できる理由を残す場所です。"
                    >
                      <textarea
                        value={memoForm.reason}
                        onChange={(event) => setMemoForm((current) => current && ({ ...current, reason: event.target.value }))}
                        placeholder="例：第一志望。難易度は高いが挑戦したい。"
                        rows={4}
                        className="min-h-28 w-full resize-y rounded-lg border border-pink-500/30 bg-card px-3 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-pink-500/40"
                      />
                    </UserField>
                    <UserField
                      title="Next Action"
                      description="この企業に対して次にやることを書きます。"
                      why="応募戦略を行動に変えるための欄です。次の一手だけに絞ると管理しやすくなります。"
                    >
                      <textarea
                        value={memoForm.next_action}
                        onChange={(event) => setMemoForm((current) => current && ({ ...current, next_action: event.target.value }))}
                        placeholder="例：SPI対策を重点的に進める"
                        rows={4}
                        className="min-h-28 w-full resize-y rounded-lg border border-pink-500/30 bg-card px-3 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-pink-500/40"
                      />
                    </UserField>
                    <UserField
                      title="Personal Notes"
                      description="説明会・OB訪問・面接で使えそうなメモを自由に残します。"
                      why="あとで面接前に読み返すための自分用メモです。小さな気づきでも残しておくと役立ちます。"
                    >
                      <textarea
                        value={memoForm.personal_notes}
                        onChange={(event) => setMemoForm((current) => current && ({ ...current, personal_notes: event.target.value }))}
                        placeholder={"例：OB訪問したい\n面接で研究内容を強調"}
                        rows={5}
                        className="min-h-32 w-full resize-y rounded-lg border border-pink-500/30 bg-card px-3 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-pink-500/40"
                      />
                    </UserField>
                  </div>

                  <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                      <button
                        type="button"
                        onClick={() => setMemoForm((current) => current && ({ ...current, strategy_position: selectedAiRecommendation }))}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-2 text-sm font-medium text-purple-200 hover:bg-purple-500/15"
                      >
                        <Check className="h-4 w-4" />
                        Accept AI Suggestion
                      </button>
                      <button
                        type="button"
                        onClick={() => setMemoForm((current) => current && ({ ...current, reason: current.reason || "AI提案を確認し、自分の判断で調整する。" }))}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-pink-500/30 bg-pink-500/10 px-3 py-2 text-sm font-medium text-pink-200 hover:bg-pink-500/15"
                      >
                        <Edit3 className="h-4 w-4" />
                        Edit Before Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setMemoForm((current) => current && ({ ...current, strategy_position: "Hold", reason: current.reason || "AI提案は一度保留し、追加情報を確認してから判断する。" }))}
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
                    各項目の「?」を押すと、何を意味する項目なのかを確認できます。Company Rankは企業そのものの志望度、Strategy Positionは応募戦略として完全に分けています。
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
