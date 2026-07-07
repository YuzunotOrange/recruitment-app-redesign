"use client"

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import {
  BarChart3,
  BrainCircuit,
  CircleHelp,
  RefreshCw,
  Save,
  Target,
  X,
} from "lucide-react"
import { apiRequest } from "@/lib/api"
import { companyStatusMeta, industryMeta, type CompanyStatus, type Industry, type Priority } from "@/lib/data"
import { text, useLanguagePreference, type LanguageMode } from "@/lib/language"
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
  Reach: "border-fuchsia-400/50 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-200",
  Core: "border-cyan-400/50 bg-cyan-500/10 text-cyan-700 dark:text-cyan-200",
  Safe: "border-emerald-400/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200",
  Hold: "border-zinc-400/50 bg-zinc-500/10 text-zinc-700 dark:text-zinc-200",
}

function bilingual(language: LanguageMode, value: { en: string; ja: string }) {
  if (language === "ja-en") return `${value.en} / ${value.ja}`
  return text(language, value)
}

const strategyCopy = {
  command: { en: "Strategy MVP", ja: "\u6226\u7565MVP" },
  title: { en: "Application Strategy Dashboard", ja: "\u5fdc\u52df\u6226\u7565\u30c0\u30c3\u30b7\u30e5\u30dc\u30fc\u30c9" },
  subtitle: {
    en: "Strategy Position shows portfolio balance. Company Rank stays as preference only.",
    ja: "Strategy Position\u306f\u5fdc\u52df\u30dd\u30fc\u30c8\u30d5\u30a9\u30ea\u30aa\u306e\u5f79\u5272\u3067\u3059\u3002Company Rank\u306f\u5fd7\u671b\u5ea6\u3068\u3057\u3066\u53c2\u8003\u8868\u793a\u3057\u307e\u3059\u3002",
  },
  recalculate: { en: "Recalculate", ja: "\u518d\u8a08\u7b97" },
  loading: { en: "Loading strategy...", ja: "\u6226\u7565\u3092\u8aad\u307f\u8fbc\u307f\u4e2d..." },
  totalCompanies: { en: "Total Companies", ja: "\u4f01\u696d\u6570" },
  registeredCompanies: { en: "Registered companies", ja: "\u767b\u9332\u6e08\u307f\u4f01\u696d" },
  strategyPosition: { en: "Strategy Position", ja: "\u5fdc\u52df\u6226\u7565\u4e0a\u306e\u4f4d\u7f6e\u3065\u3051" },
  excludedFromBalance: { en: "Excluded from balance", ja: "\u30d0\u30e9\u30f3\u30b9\u8a08\u7b97\u304b\u3089\u9664\u5916" },
  esRejected: { en: "ES Rejected", ja: "ES\u843d\u3061" },
  spiRejected: { en: "SPI Rejected", ja: "SPI\u843d\u3061" },
  interview: { en: "Interview", ja: "\u9762\u63a5" },
  offer: { en: "Offer", ja: "\u5185\u5b9a" },
  mainIssue: { en: "Main Issue", ja: "\u4e3b\u306a\u8ab2\u984c" },
  ruleDiagnosis: { en: "Rule-based diagnosis", ja: "\u30eb\u30fc\u30eb\u30d9\u30fc\u30b9\u8a3a\u65ad" },
  balance: { en: "Application Balance", ja: "\u5fdc\u52df\u30d0\u30e9\u30f3\u30b9" },
  balanceSubtitle: {
    en: "Balance uses Strategy Position only. Company Rank is shown as preference data.",
    ja: "\u30d0\u30e9\u30f3\u30b9\u8a08\u7b97\u306b\u306fStrategy Position\u306e\u307f\u3092\u4f7f\u3044\u307e\u3059\u3002Company Rank\u306f\u5fd7\u671b\u5ea6\u3068\u3057\u3066\u8868\u793a\u3057\u307e\u3059\u3002",
  },
  balanceAdvice: { en: "Balance Advice", ja: "\u30d0\u30e9\u30f3\u30b9\u6539\u5584\u6848" },
  holdNote: {
    en: "Hold is shown separately and is not included in Application Balance.",
    ja: "Hold\u306f\u5225\u67a0\u8868\u793a\u3067\u3001\u5fdc\u52df\u30d0\u30e9\u30f3\u30b9\u306b\u306f\u542b\u3081\u307e\u305b\u3093\u3002",
  },
  holdTracked: { en: "Hold is tracked separately and excluded from the ideal ratio.", ja: "Hold\u306f\u5225\u67a0\u3067\u7ba1\u7406\u3057\u3001\u7406\u60f3\u6bd4\u7387\u304b\u3089\u9664\u5916\u3057\u307e\u3059\u3002" },
  noCompanies: { en: "No companies yet.", ja: "\u4f01\u696d\u306f\u307e\u3060\u3042\u308a\u307e\u305b\u3093\u3002" },
  companyRank: { en: "Company Rank", ja: "\u4f01\u696d\u5fd7\u671b\u5ea6" },
  nextAction: { en: "Next Action", ja: "\u6b21\u306e\u884c\u52d5" },
  esDeadline: { en: "ES Deadline", ja: "ES\u7de0\u5207" },
  notSet: { en: "Not set", ja: "\u672a\u8a2d\u5b9a" },
  openMemo: { en: "Open Memo / Edit Strategy", ja: "\u30e1\u30e2\u3092\u958b\u304f / \u6226\u7565\u3092\u7de8\u96c6" },
  companies: { en: "companies", ja: "\u793e" },
  current: { en: "Current", ja: "\u73fe\u5728" },
  ideal: { en: "Ideal", ja: "\u7406\u60f3" },
  separate: { en: "separate", ja: "\u5225\u67a0" },
  strategyMemo: { en: "Strategy Memo", ja: "\u6226\u7565\u30e1\u30e2" },
  memoSubtitle: {
    en: "Only you decide Strategy Position, Reason, Next Action, and Personal Notes.",
    ja: "Strategy Position、Reason、Next Action、Personal Notesはあなたが決定します。",
  },
  close: { en: "Close", ja: "\u9589\u3058\u308b" },
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

function strategyPositionOf(company: StrategyCompany): StrategyPosition {
  const storedPosition = readMemoBlock(company.user_strategy_note, "Strategy Position") as StrategyPosition
  if (strategyPositions.includes(storedPosition)) return storedPosition
  return "Hold"
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

function interviewStatus(status: CompanyStatus, language: LanguageMode = "en") {
  if (status === "interview") return bilingual(language, { en: "Interview active", ja: "面接中" })
  if (status === "offer") return bilingual(language, { en: "Offer reached", ja: "内定" })
  if (status === "es_rejected") return bilingual(language, { en: "Stopped at ES", ja: "ESで終了" })
  if (status === "spi_rejected") return bilingual(language, { en: "Stopped at SPI", ja: "SPIで終了" })
  if (status === "declined") return bilingual(language, { en: "Declined", ja: "辞退" })
  return bilingual(language, { en: "Not started", ja: "未開始" })
}

function flattenCompanies(summary: StrategySummary) {
  const byId = new Map<number, StrategyCompany>()
  Object.values(summary.buckets).forEach((bucket) => {
    bucket.companies.forEach((company) => byId.set(company.id, company))
  })
  return Array.from(byId.values())
}

function mainIssueText(metrics: StrategySummary["metrics"], language: LanguageMode) {
  if (metrics.offers > 0) return bilingual(language, { en: "Compare offers and decide carefully", ja: "内定後の比較・意思決定" })
  if (metrics.spi_rejected >= metrics.es_rejected && metrics.spi_rejected > 0) return bilingual(language, { en: "Prioritize SPI practice", ja: "SPI対策が最優先" })
  if (metrics.es_rejected > metrics.spi_rejected && metrics.es_rejected > 0) return bilingual(language, { en: "Improve ES quality", ja: "ES改善が最優先" })
  if (metrics.interviews < 3) return bilingual(language, { en: "Increase interview opportunities", ja: "面接機会を増やす" })
  return bilingual(language, { en: "Balanced", ja: "バランス良好" })
}

function balanceRatio(position: Exclude<StrategyPosition, "Hold">, buckets: Record<StrategyPosition, StrategyCompany[]>) {
  const activeTotal = activeStrategyPositions.reduce((total, item) => total + buckets[item].length, 0)
  return activeTotal ? Math.round((buckets[position].length / activeTotal) * 1000) / 10 : 0
}

function balanceAdvice(buckets: Record<StrategyPosition, StrategyCompany[]>, language: LanguageMode) {
  const activeTotal = activeStrategyPositions.reduce((total, position) => total + buckets[position].length, 0)
  if (!activeTotal) return bilingual(language, { en: "Classify companies into Reach / Core / Safe to check portfolio balance.", ja: "Reach / Core / Safe に企業を分類すると応募バランスを確認できます。" })

  const shortages = activeStrategyPositions
    .map((position) => {
      const idealCount = Math.ceil((activeTotal * idealRatios[position]) / 100)
      return { position, shortage: Math.max(0, idealCount - buckets[position].length) }
    })
    .filter((item) => item.shortage > 0)
    .sort((a, b) => b.shortage - a.shortage)

  if (!shortages.length) return bilingual(language, { en: "Current application balance is close to the ideal ratio.", ja: "現在の応募バランスは理想比率に近いです。" })
  const target = shortages[0]
  if (language === "ja") return `${target.position}企業をあと${target.shortage}社追加するとバランスが良くなります。`
  if (language === "ja-en") return `${target.position} companies are short by ${target.shortage}. / ${target.position}企業をあと${target.shortage}社追加するとバランスが良くなります。`
  return `${target.position} companies are short by ${target.shortage}.`
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
    readonly: "text-blue-700 dark:text-blue-300",
    ai: "text-purple-700 dark:text-purple-300",
    user: "text-emerald-700 dark:text-emerald-300",
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
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-700 dark:text-blue-300">Read Only</p>
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
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-purple-700 dark:text-purple-300">AI / System</p>
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
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">User Input</p>
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
  language,
}: {
  label: Exclude<StrategyPosition, "Hold">
  current: number
  ideal: number
  count: number
  language: LanguageMode
}) {
  const delta = Math.round((current - ideal) * 10) / 10

  return (
    <div className="rounded-xl border border-border bg-background/60 p-3">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-semibold text-foreground">{label}</span>
        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${positionTone[label]}`}>
          {count} {bilingual(language, strategyCopy.companies)}
        </span>
      </div>
      <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
        <span>{bilingual(language, strategyCopy.current)}: {current}%</span>
        <span>{bilingual(language, strategyCopy.ideal)}: {ideal}%</span>
        <span>{delta >= 0 ? `+${delta}%` : `${delta}%`}</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(current, 100)}%` }} />
      </div>
    </div>
  )
}

function CompanyStrategyCard({
  company,
  onSelect,
  language,
}: {
  company: StrategyCompany
  onSelect: (company: StrategyCompany) => void
  language: LanguageMode
}) {
  const statusMeta = companyStatusMeta[company.status]
  const position = strategyPositionOf(company)

  return (
    <button type="button" onClick={() => onSelect(company)} className="w-full rounded-xl border border-border bg-background/70 p-4 text-left hover:bg-muted/40">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{company.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {bilingual(language, strategyCopy.companyRank)}: {company.priority}
          </p>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${positionTone[position]}`}>
          {position}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StatusBadge tone={statusMeta.tone}>{text(language, statusMeta)}</StatusBadge>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {bilingual(language, strategyCopy.esDeadline)}: {formatDate(company.es_deadline)}
        </span>
      </div>
      <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{bilingual(language, strategyCopy.nextAction)}:</span>{" "}
        {company.recommended_action || bilingual(language, strategyCopy.notSet)}
      </p>
      <span className="mt-3 inline-flex min-h-9 items-center rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground">
        {bilingual(language, strategyCopy.openMemo)}
      </span>
    </button>
  )
}

export function StrategyView() {
  const language = useLanguagePreference()
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

  const biggestIssue = useMemo(() => mainIssueText(summary.metrics, language), [summary.metrics, language])
  const balanceMessage = useMemo(() => balanceAdvice(positionBuckets, language), [positionBuckets, language])

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            <BrainCircuit className="h-4 w-4" />
            <span>{bilingual(language, strategyCopy.command)}</span>
          </div>
          <h2 className="mt-2 text-xl font-semibold text-foreground">{bilingual(language, strategyCopy.title)}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {bilingual(language, strategyCopy.subtitle)}
          </p>
        </div>
        <button
          type="button"
          onClick={recalculate}
          disabled={saving}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${saving ? "animate-spin" : ""}`} />
          {bilingual(language, strategyCopy.recalculate)}
        </button>
      </div>

      {error && <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}
      {loading && <div className="rounded-xl border border-border bg-card px-4 py-6 text-sm text-muted-foreground">{bilingual(language, strategyCopy.loading)}</div>}

      {!loading && (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
            <SummaryCard label={bilingual(language, strategyCopy.totalCompanies)} value={summary.metrics.total_companies} description={bilingual(language, strategyCopy.registeredCompanies)} />
            <SummaryCard label="Reach" value={positionBuckets.Reach.length} description={bilingual(language, strategyCopy.strategyPosition)} />
            <SummaryCard label="Core" value={positionBuckets.Core.length} description={bilingual(language, strategyCopy.strategyPosition)} />
            <SummaryCard label="Safe" value={positionBuckets.Safe.length} description={bilingual(language, strategyCopy.strategyPosition)} />
            <SummaryCard label="Hold" value={positionBuckets.Hold.length} description={bilingual(language, strategyCopy.excludedFromBalance)} />
            <SummaryCard label={bilingual(language, strategyCopy.esRejected)} value={summary.metrics.es_rejected} />
            <SummaryCard label={bilingual(language, strategyCopy.spiRejected)} value={summary.metrics.spi_rejected} />
            <SummaryCard label={bilingual(language, strategyCopy.interview)} value={summary.metrics.interviews} />
            <SummaryCard label={bilingual(language, strategyCopy.offer)} value={summary.metrics.offers} />
            <SummaryCard label={bilingual(language, strategyCopy.mainIssue)} value={biggestIssue} description={bilingual(language, strategyCopy.ruleDiagnosis)} />
          </section>

          <section className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <BarChart3 className="h-4 w-4 text-accent" />
                {bilingual(language, strategyCopy.balance)}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {bilingual(language, strategyCopy.balanceSubtitle)}
              </p>
              <div className="mt-4 grid gap-3 xl:grid-cols-3">
                {activeStrategyPositions.map((position) => (
                  <BalanceMeter
                    key={position}
                    label={position}
                    count={positionBuckets[position].length}
                    current={balanceRatio(position, positionBuckets)}
                    ideal={idealRatios[position]}
                    language={language}
                  />
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Target className="h-4 w-4 text-primary" />
                {bilingual(language, strategyCopy.balanceAdvice)}
              </div>
              <p className="mt-4 text-lg font-semibold text-foreground">{balanceMessage}</p>
              <div className="mt-4 rounded-xl border border-border bg-background/60 p-3 text-sm text-muted-foreground">
                Hold: {positionBuckets.Hold.length} {bilingual(language, strategyCopy.companies)}. {bilingual(language, strategyCopy.holdTracked)}
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
            {strategyPositions.map((position) => (
              <div key={position} className="rounded-2xl border border-border bg-card p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold text-foreground">{position}</h3>
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${positionTone[position]}`}>
                    {positionBuckets[position].length} / {position === "Hold" ? bilingual(language, strategyCopy.separate) : `${positionRatios[position]}%`}
                  </span>
                </div>
                {position === "Hold" && (
                  <p className="mb-3 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                    {bilingual(language, strategyCopy.holdNote)}
                  </p>
                )}
                <div className="space-y-3">
                  {positionBuckets[position].length ? (
                    positionBuckets[position].map((company) => <CompanyStrategyCard key={company.id} company={company} onSelect={selectCompany} language={language} />)
                  ) : (
                    <p className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">{bilingual(language, strategyCopy.noCompanies)}</p>
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
                    <span>{bilingual(language, strategyCopy.strategyMemo)}</span>
                  </div>
                  <h3 className="mt-2 text-lg font-semibold text-foreground">{selectedCompany.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {bilingual(language, strategyCopy.memoSubtitle)}
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
                  {bilingual(language, strategyCopy.close)}
                </button>
              </div>

              <div className="mt-4 space-y-5">
                <div className="rounded-2xl border border-blue-500/30 bg-blue-500/5 p-4">
                  <SectionHeader title="Company Information" description="Basic company fields from the Company Add/Edit form. Read only here." tone="readonly" />
                  <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
                    <ReadOnlyItem title="Company Rank" description="Preference level: how much you want this company." value={selectedCompany.priority} why="Company Rank is S/A/B/C preference. It is not the strategy position." />
                    <ReadOnlyItem title="Industry" description="Registered industry." value={industryMeta[selectedCompany.industry]?.en ?? selectedCompany.industry} />
                    <ReadOnlyItem title="Current Status" description="Current selection status." why="This comes from the company status field.">
                      <StatusBadge tone={companyStatusMeta[selectedCompany.status].tone}>{companyStatusMeta[selectedCompany.status].en}</StatusBadge>
                    </ReadOnlyItem>
                    <ReadOnlyItem title="ES Deadline" description="Registered ES deadline." value={formatDate(selectedCompany.es_deadline)} />
                    <ReadOnlyItem title="Interview Status" description="Interview phase state." value={interviewStatus(selectedCompany.status)} />
                  </div>
                </div>

                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                  <SectionHeader title="Your Decision" description="Only these fields are edited by you." tone="user" />
                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    <UserField title="Strategy Position" description="Reach, Core, Safe, or Hold." why="Strategy Position is your portfolio role for this application. It is separate from Company Rank.">
                      <select
                        value={memoForm.strategy_position}
                        onChange={(event) => setMemoForm((current) => current && ({ ...current, strategy_position: event.target.value as StrategyPosition }))}
                        className="min-h-11 w-full rounded-lg border border-emerald-500/30 bg-card px-3 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-emerald-500/40"
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
                        className="min-h-28 w-full resize-y rounded-lg border border-emerald-500/30 bg-card px-3 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-emerald-500/40"
                      />
                    </UserField>
                    <UserField title="Next Action" description="The next concrete action for this company." why="Keep it specific enough to act on this week.">
                      <textarea
                        value={memoForm.next_action}
                        onChange={(event) => setMemoForm((current) => current && ({ ...current, next_action: event.target.value }))}
                        placeholder="Example: Focus on SPI practice."
                        rows={4}
                        className="min-h-28 w-full resize-y rounded-lg border border-emerald-500/30 bg-card px-3 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-emerald-500/40"
                      />
                    </UserField>
                    <UserField title="Personal Notes" description="Free notes for briefings, alumni visits, and interviews." why="Keep small observations here so you can review them before interviews.">
                      <textarea
                        value={memoForm.personal_notes}
                        onChange={(event) => setMemoForm((current) => current && ({ ...current, personal_notes: event.target.value }))}
                        placeholder={"Example: Ask for an alumni visit.\nEmphasize research experience in interviews."}
                        rows={5}
                        className="min-h-32 w-full resize-y rounded-lg border border-emerald-500/30 bg-card px-3 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-emerald-500/40"
                      />
                    </UserField>
                  </div>

                  <div className="mt-4 flex justify-end">
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

        </>
      )}
    </div>
  )
}
