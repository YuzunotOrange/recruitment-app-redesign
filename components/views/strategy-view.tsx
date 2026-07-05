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
  application_reason: string
  desired_work: string
  company_appeal: string
  concern: string
  user_strategy_note: string
}

const memoLabels = {
  application_reason: "応募したい理由",
  desired_work: "この企業でやりたい仕事",
  company_appeal: "この企業の魅力",
  concern: "気になる点・不安",
} as const

function readMemoBlock(source: string | null, label: string) {
  if (!source) return ""
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const match = source.match(new RegExp(`\\[${escaped}\\]\\n([\\s\\S]*?)(?=\\n\\n\\[[^\\]]+\\]|$)`))
  return match?.[1]?.trim() ?? ""
}

function writeMemoBlocks(form: StrategyMemoForm) {
  return [
    `[${memoLabels.application_reason}]\n${form.application_reason.trim()}`,
    `[${memoLabels.desired_work}]\n${form.desired_work.trim()}`,
    `[${memoLabels.company_appeal}]\n${form.company_appeal.trim()}`,
    `[${memoLabels.concern}]\n${form.concern.trim()}`,
  ].join("\n\n")
}

function toMemoForm(company: StrategyCompany): StrategyMemoForm {
  return {
    strategy_rank: company.strategy_rank,
    difficulty_level: company.difficulty_level,
    fit_score: company.fit_score,
    success_probability: company.success_probability,
    selection_risk: company.selection_risk,
    recommended_action: company.recommended_action ?? "",
    application_reason: readMemoBlock(company.strategy_reason, memoLabels.application_reason) || (company.strategy_reason ?? ""),
    desired_work: readMemoBlock(company.strategy_reason, memoLabels.desired_work),
    company_appeal: readMemoBlock(company.strategy_reason, memoLabels.company_appeal),
    concern: readMemoBlock(company.strategy_reason, memoLabels.concern),
    user_strategy_note: company.user_strategy_note ?? "",
  }
}

function HintBox({ examples, points }: { examples: string[]; points: string[] }) {
  return (
    <div className="mt-2 rounded-lg border border-accent/25 bg-accent/10 p-3 text-xs text-muted-foreground">
      <p className="font-semibold text-foreground">入力例</p>
      <ul className="mt-1 list-disc space-y-1 pl-4">
        {examples.map((example) => <li key={example}>{example}</li>)}
      </ul>
      <p className="mt-3 font-semibold text-foreground">考えるポイント</p>
      <ul className="mt-1 list-disc space-y-1 pl-4">
        {points.map((point) => <li key={point}>{point}</li>)}
      </ul>
    </div>
  )
}

function GuidedTextarea({
  title,
  description,
  value,
  placeholder,
  examples,
  points,
  onChange,
}: {
  title: string
  description: string
  value: string
  placeholder: string
  examples: string[]
  points: string[]
  onChange: (value: string) => void
}) {
  const [showHint, setShowHint] = useState(false)
  return (
    <div className="rounded-xl border border-border bg-background/60 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <label className="text-sm font-semibold text-foreground">{title}</label>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        <button
          type="button"
          onClick={() => setShowHint((current) => !current)}
          className="shrink-0 rounded-lg border border-accent/30 bg-accent/10 px-2 py-1 text-xs font-medium text-accent hover:bg-accent/15"
        >
          💡 AIヒント
        </button>
      </div>
      {showHint && <HintBox examples={examples} points={points} />}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={4}
        className="mt-3 min-h-28 w-full resize-y rounded-lg border border-border bg-card px-3 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
      />
    </div>
  )
}

function GuidedSelect<T extends string>({
  title,
  description,
  value,
  options,
  examples,
  points,
  onChange,
}: {
  title: string
  description: string
  value: T
  options: Array<{ value: T; label: string }>
  examples: string[]
  points: string[]
  onChange: (value: T) => void
}) {
  const [showHint, setShowHint] = useState(false)
  return (
    <div className="rounded-xl border border-border bg-background/60 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <label className="text-sm font-semibold text-foreground">{title}</label>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        <button
          type="button"
          onClick={() => setShowHint((current) => !current)}
          className="shrink-0 rounded-lg border border-accent/30 bg-accent/10 px-2 py-1 text-xs font-medium text-accent hover:bg-accent/15"
        >
          💡 AIヒント
        </button>
      </div>
      {showHint && <HintBox examples={examples} points={points} />}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="mt-3 min-h-11 w-full rounded-lg border border-border bg-card px-3 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
      >
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </div>
  )
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
          strategy_reason: writeMemoBlocks(memoForm),
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
                  <p className="mt-1 text-sm text-muted-foreground">企業について考えるためのガイド付きノートです。</p>
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
                <div className="rounded-2xl border border-border bg-background/40 p-4">
                  <h4 className="text-base font-semibold text-foreground">応募戦略</h4>
                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    <GuidedSelect
                      title="応募ランク"
                      description="この企業をあなたはどの程度優先して受けますか？"
                      value={memoForm.strategy_rank}
                      options={strategyRanks.map((rank) => ({ value: rank, label: `${rank} ランク` }))}
                      examples={["S: 第一志望級", "A: 本命候補", "B: 面接機会を増やす候補"]}
                      points={["自分の志望度で決める", "難易度だけでなく納得度も見る", "迷ったらAにして後で見直す"]}
                      onChange={(value) => setMemoForm((current) => current && ({ ...current, strategy_rank: value }))}
                    />
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl border border-border bg-background/60 p-3">
                        <label className="text-sm font-semibold text-foreground">難易度</label>
                        <p className="mt-1 text-xs text-muted-foreground">選考の難しさを1〜5で記録します。</p>
                        <input
                          value={memoForm.difficulty_level}
                          onChange={(event) => setMemoForm((current) => current && ({ ...current, difficulty_level: Number(event.target.value) }))}
                          type="number"
                          min={1}
                          max={5}
                          className="mt-3 min-h-11 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                      <div className="rounded-xl border border-border bg-background/60 p-3">
                        <label className="text-sm font-semibold text-foreground">相性</label>
                        <p className="mt-1 text-xs text-muted-foreground">自分との相性を0〜100で記録します。</p>
                        <input
                          value={memoForm.fit_score}
                          onChange={(event) => setMemoForm((current) => current && ({ ...current, fit_score: Number(event.target.value) }))}
                          type="number"
                          min={0}
                          max={100}
                          className="mt-3 min-h-11 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                      <div className="rounded-xl border border-border bg-background/60 p-3">
                        <label className="text-sm font-semibold text-foreground">通過見込み</label>
                        <p className="mt-1 text-xs text-muted-foreground">現時点の成功確率を0〜100で記録します。</p>
                        <input
                          value={memoForm.success_probability}
                          onChange={(event) => setMemoForm((current) => current && ({ ...current, success_probability: Number(event.target.value) }))}
                          type="number"
                          min={0}
                          max={100}
                          className="mt-3 min-h-11 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                    </div>
                    <GuidedTextarea
                      title="応募したい理由"
                      description="なぜこの企業を受けたいのかを書きます。"
                      value={memoForm.application_reason}
                      placeholder="例：AI/DXに携わりたい、海外で働きたい、福利厚生が魅力、研究内容を活かせる"
                      examples={["AI/DXに携わりたい", "海外で働きたい", "福利厚生が魅力", "研究内容を活かせる"]}
                      points={["自分の価値観とつながっているか", "企業名を変えても成立する理由になっていないか", "面接で話せる具体性があるか"]}
                      onChange={(value) => setMemoForm((current) => current && ({ ...current, application_reason: value }))}
                    />
                    <GuidedTextarea
                      title="この企業でやりたい仕事"
                      description="入社後に挑戦したい仕事や職種を書きます。"
                      value={memoForm.desired_work}
                      placeholder="例：AI開発、DXコンサル、データ分析、研究開発"
                      examples={["AI開発", "DXコンサル", "データ分析", "研究開発"]}
                      points={["事業や職種と結びついているか", "自分の経験と接続できるか", "面接で深掘りされても説明できるか"]}
                      onChange={(value) => setMemoForm((current) => current && ({ ...current, desired_work: value }))}
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-background/40 p-4">
                  <h4 className="text-base font-semibold text-foreground">企業分析</h4>
                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    <GuidedTextarea
                      title="この企業の魅力"
                      description="他社と比べて魅力に感じる点を書きます。"
                      value={memoForm.company_appeal}
                      placeholder="例：海外売上比率が高い、若手でも挑戦できる、DX投資が積極的"
                      examples={["海外売上比率が高い", "若手でも挑戦できる", "DX投資が積極的"]}
                      points={["ニュースやIRで確認できるか", "自分の志望理由につながるか", "競合他社との差分になっているか"]}
                      onChange={(value) => setMemoForm((current) => current && ({ ...current, company_appeal: value }))}
                    />
                    <GuidedTextarea
                      title="気になる点・不安"
                      description="選考や働き方で不安な点を書きます。"
                      value={memoForm.concern}
                      placeholder="例：SPIが難しい、勤務地、残業時間、倍率が高い"
                      examples={["SPIが難しい", "勤務地", "残業時間", "倍率が高い"]}
                      points={["調べれば解消できる不安か", "OB訪問で確認すべき内容か", "選考対策に変換できるか"]}
                      onChange={(value) => setMemoForm((current) => current && ({ ...current, concern: value }))}
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-background/40 p-4">
                  <h4 className="text-base font-semibold text-foreground">選考対策</h4>
                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    <GuidedSelect
                      title="現状一番の課題"
                      description="いま一番対策が必要な選考フェーズを選びます。"
                      value={memoForm.selection_risk}
                      options={[
                        { value: "ES", label: "ES" },
                        { value: "SPI", label: "SPI" },
                        { value: "Interview", label: "面接（ケース面接・英語含む）" },
                        { value: "Unknown", label: "不明" },
                      ]}
                      examples={["ES", "SPI", "面接", "ケース面接", "英語", "不明"]}
                      points={["次に落ちる可能性が高い場所を選ぶ", "迷う場合は不明にしてメモへ残す", "ケース面接や英語は面接リスクとして管理する"]}
                      onChange={(value) => setMemoForm((current) => current && ({ ...current, selection_risk: value }))}
                    />
                    <GuidedTextarea
                      title="次にやること"
                      description="この企業に対して次に取る具体的な行動を書きます。"
                      value={memoForm.recommended_action}
                      placeholder="例：SPIを2周、OB訪問、企業研究、面接練習"
                      examples={["SPIを2周", "OB訪問", "企業研究", "面接練習"]}
                      points={["今日または今週できる行動にする", "具体的な完了条件を書く", "締切や面接日から逆算する"]}
                      onChange={(value) => setMemoForm((current) => current && ({ ...current, recommended_action: value }))}
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-background/40 p-4">
                  <h4 className="text-base font-semibold text-foreground">自分メモ</h4>
                  <div className="mt-3">
                    <GuidedTextarea
                      title="自由記述"
                      description="説明会・面接・インターンなどで気づいたことを自由に残します。"
                      value={memoForm.user_strategy_note}
                      placeholder="例：説明会で社員が○○と言っていた、面接で聞かれそう、インターン参加予定"
                      examples={["説明会で社員が○○と言っていた", "面接で聞かれそう", "インターン参加予定"]}
                      points={["あとで面接前に読み返せる内容にする", "社員の発言や自分の感情も残す", "疑問点は次の質問候補にする"]}
                      onChange={(value) => setMemoForm((current) => current && ({ ...current, user_strategy_note: value }))}
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={saveMemo}
                    disabled={memoSaving}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" />
                    保存
                  </button>
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
