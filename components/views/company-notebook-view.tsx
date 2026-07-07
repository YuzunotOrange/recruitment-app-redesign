"use client"

import { useCallback, useEffect, useState, type ReactNode } from "react"
import { ArrowLeft, BrainCircuit, ExternalLink, Loader2, Save } from "lucide-react"
import { apiRequest } from "@/lib/api"
import { companyStatusMeta, industryMeta, type CompanyStatus, type Industry, type Priority } from "@/lib/data"
import { formatLocalizedDate, useLanguagePreference } from "@/lib/language"
import { requestAppDataRefresh } from "@/lib/notification-events"
import { PriorityBadge, StatusBadge } from "@/components/status-badge"

type StrategyPosition = "Reach" | "Core" | "Safe" | "Hold"
type SelectionRisk = "ES" | "SPI" | "Interview" | "Unknown"

type CompanyNotebook = {
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
  selection_risk: SelectionRisk | null
  recommended_action: string | null
  strategy_reason: string | null
  user_strategy_note: string | null
  es_motivation_draft: string | null
  es_research_connection: string | null
  es_project_connection: string | null
  es_appeal_points: string | null
  es_missing_information: string | null
  interview_expected_questions: string | null
  interview_stories: string | null
  interview_reverse_questions: string | null
  interview_reflection: string | null
  personal_notes: string | null
}

type ResearchSource = {
  title: string
  url: string
  retrieved_at: string
}

type CompanyResearch = {
  id: number
  company_id: number
  company_overview: string
  business_summary: string
  salary_level: number
  difficulty_level: number
  stability: number
  growth: number
  global: number
  dx: number
  work_life_balance: number
  recommended_people: string
  research_summary: string
  strengths: string
  weaknesses: string
  selection_process: string
  selection_points: string
  ai_strategy_position: StrategyPosition
  sources: ResearchSource[]
  provider: string
  generated_at: string
  accepted: boolean
  accepted_at: string | null
}

type DecisionForm = {
  strategy_position: StrategyPosition
  reason: string
  next_action: string
  personal_notes: string
  es_motivation_draft: string
  es_research_connection: string
  es_project_connection: string
  es_appeal_points: string
  es_missing_information: string
  interview_expected_questions: string
  interview_stories: string
  interview_reverse_questions: string
  interview_reflection: string
  notebook_personal_notes: string
}

const strategyPositions: StrategyPosition[] = ["Reach", "Core", "Safe", "Hold"]

function readMemoBlock(source: string | null | undefined, label: string) {
  if (!source) return ""
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const match = source.match(new RegExp(`\\[${escaped}\\]\\n([\\s\\S]*?)(?=\\n\\n\\[[^\\]]+\\]|$)`))
  return match?.[1]?.trim() ?? ""
}

function writeUserStrategyNote(form: DecisionForm) {
  return [
    `[Strategy Position]\n${form.strategy_position}`,
    `[Reason]\n${form.reason.trim()}`,
    `[Next Action]\n${form.next_action.trim()}`,
    `[Personal Notes]\n${form.personal_notes.trim()}`,
  ].join("\n\n")
}

function strategyPositionOf(company: CompanyNotebook): StrategyPosition {
  const stored = readMemoBlock(company.user_strategy_note, "Strategy Position") as StrategyPosition
  return strategyPositions.includes(stored) ? stored : "Hold"
}

function toDecisionForm(company: CompanyNotebook): DecisionForm {
  return {
    strategy_position: strategyPositionOf(company),
    reason: readMemoBlock(company.user_strategy_note, "Reason") || company.strategy_reason || "",
    next_action: readMemoBlock(company.user_strategy_note, "Next Action") || company.recommended_action || "",
    personal_notes: readMemoBlock(company.user_strategy_note, "Personal Notes"),
    es_motivation_draft: company.es_motivation_draft || "",
    es_research_connection: company.es_research_connection || "",
    es_project_connection: company.es_project_connection || "",
    es_appeal_points: company.es_appeal_points || "",
    es_missing_information: company.es_missing_information || "",
    interview_expected_questions: company.interview_expected_questions || "",
    interview_stories: company.interview_stories || "",
    interview_reverse_questions: company.interview_reverse_questions || "",
    interview_reflection: company.interview_reflection || "",
    notebook_personal_notes: company.personal_notes || "",
  }
}

function stars(score: number | null | undefined) {
  if (score == null) return "Not analyzed"
  const safeScore = Math.max(1, Math.min(5, score))
  return `${"★".repeat(safeScore)}${"☆".repeat(5 - safeScore)}`
}
function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-foreground">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={4}
        className="mt-2 w-full resize-y rounded-xl border border-border bg-background px-3 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
      />
    </label>
  )
}

export function CompanyNotebookView({ companyId, onBack }: { companyId: number; onBack: () => void }) {
  const language = useLanguagePreference()
  const [company, setCompany] = useState<CompanyNotebook | null>(null)
  const [research, setResearch] = useState<CompanyResearch | null>(null)
  const [form, setForm] = useState<DecisionForm | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadNotebook = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [companyData, researchData] = await Promise.all([
        apiRequest<CompanyNotebook>(`/companies/${companyId}`),
        apiRequest<CompanyResearch | null>(`/companies/${companyId}/research`),
      ])
      setCompany(companyData)
      setResearch(researchData)
      setForm(toDecisionForm(companyData))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load company notebook.")
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    loadNotebook()
  }, [loadNotebook])

  async function generateResearch() {
    setGenerating(true)
    setError(null)
    try {
      const generated = await apiRequest<CompanyResearch>(`/companies/${companyId}/research/generate`, { method: "POST" })
      setResearch(generated)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate AI research.")
    } finally {
      setGenerating(false)
    }
  }

  async function saveDecision() {
    if (!form) return
    setSaving(true)
    setError(null)
    try {
      const updated = await apiRequest<CompanyNotebook>(`/companies/${companyId}`, {
        method: "PUT",
        body: JSON.stringify({
          recommended_action: form.next_action || null,
          strategy_reason: form.reason || null,
          user_strategy_note: writeUserStrategyNote(form),
          es_motivation_draft: form.es_motivation_draft || null,
          es_research_connection: form.es_research_connection || null,
          es_project_connection: form.es_project_connection || null,
          es_appeal_points: form.es_appeal_points || null,
          es_missing_information: form.es_missing_information || null,
          interview_expected_questions: form.interview_expected_questions || null,
          interview_stories: form.interview_stories || null,
          interview_reverse_questions: form.interview_reverse_questions || null,
          interview_reflection: form.interview_reflection || null,
          personal_notes: form.notebook_personal_notes || null,
        }),
      })
      setCompany(updated)
      setForm(toDecisionForm(updated))
      requestAppDataRefresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save company notebook.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="rounded-2xl border border-border bg-card px-4 py-8 text-sm text-muted-foreground">Loading Company Notebook...</div>
  }

  if (!company || !form) {
    return (
      <div className="space-y-4">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back to Companies
        </button>
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-6 text-sm text-destructive">
          {error || "Company not found."}
        </div>
      </div>
    )
  }

  const statusMeta = companyStatusMeta[company.status]

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back to Companies
          </button>
          <h1 className="mt-3 text-2xl font-semibold text-foreground">{company.name} Notebook</h1>
          <p className="mt-1 text-sm text-muted-foreground">Company information, research sources, strategy notes, and your preparation memos are organized here.</p>
        </div>
        <button
          type="button"
          onClick={saveDecision}
          disabled={saving}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          Save Notebook
        </button>
      </div>

      {error && <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}

      <Section title="Basic Info" subtitle="Basic company information from the Companies list. Use it here as decision context.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-border bg-background/60 p-3"><p className="text-xs text-muted-foreground">Company</p><p className="mt-1 font-semibold text-foreground">{company.name}</p></div>
          <div className="rounded-xl border border-border bg-background/60 p-3"><p className="text-xs text-muted-foreground">Industry</p><p className="mt-1 font-semibold text-foreground">{industryMeta[company.industry].en}</p></div>
          <div className="rounded-xl border border-border bg-background/60 p-3"><p className="text-xs text-muted-foreground">Company Rank</p><div className="mt-1"><PriorityBadge priority={company.priority} /></div></div>
          <div className="rounded-xl border border-border bg-background/60 p-3"><p className="text-xs text-muted-foreground">Current Status</p><div className="mt-1"><StatusBadge tone={statusMeta.tone}>{statusMeta.en}</StatusBadge></div></div>
          <div className="rounded-xl border border-border bg-background/60 p-3"><p className="text-xs text-muted-foreground">ES Deadline</p><p className="mt-1 font-semibold text-foreground">{company.es_deadline ? formatLocalizedDate(company.es_deadline, language) : "-"}</p></div>
          <div className="rounded-xl border border-border bg-background/60 p-3 md:col-span-2 xl:col-span-3"><p className="text-xs text-muted-foreground">Note</p><p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{company.note || "-"}</p></div>
        </div>
      </Section>

      <Section title="AI Research" subtitle="AI organizes company information. You make the final decision.">
        {!research ? (
          <div className="rounded-xl border border-dashed border-border bg-background/60 p-5">
            <p className="text-sm text-muted-foreground">AI Research has not been generated yet.</p>
            <button
              type="button"
              onClick={generateResearch}
              disabled={generating}
              className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <BrainCircuit className="h-4 w-4" />}
              Generate Research
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {research.provider === "mock" && (
              <p className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning-foreground">
                This is demo research generated by MockAIProvider. It does not use real company websites, IR, or news yet.
              </p>
            )}
            <div className="grid gap-3 lg:grid-cols-2">
              <article className="rounded-xl border border-border bg-background/60 p-4"><h3 className="font-semibold text-foreground">Company Overview</h3><p className="mt-2 text-sm text-muted-foreground">{research.company_overview}</p></article>
              <article className="rounded-xl border border-border bg-background/60 p-4"><h3 className="font-semibold text-foreground">Business Summary</h3><p className="mt-2 text-sm text-muted-foreground">{research.business_summary}</p></article>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ["Salary", research.salary_level],
                ["Stability", research.stability],
                ["Growth", research.growth],
                ["Global", research.global],
                ["DX", research.dx],
                ["Work-Life Balance", research.work_life_balance],
              ].map(([label, score]) => (
                <div key={label} className="rounded-xl border border-border bg-background/60 p-3">
                  <p className="text-sm font-semibold text-foreground">{label}</p>
                  <p className="mt-2 text-lg tracking-wide text-warning">{stars(Number(score))}</p>
                </div>
              ))}
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {[
                ["Required Skills / Candidate Profile", research.recommended_people],
                ["Selection Process", research.selection_process],
                ["Selection Points", research.selection_points],
                ["Strengths", research.strengths],
                ["Weaknesses", research.weaknesses],
                ["Research Summary", research.research_summary],
              ].map(([label, value]) => (
                <article key={label} className="rounded-xl border border-border bg-background/60 p-4">
                  <h3 className="font-semibold text-foreground">{label}</h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{value}</p>
                </article>
              ))}
            </div>
            <article className="rounded-xl border border-border bg-background/60 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-semibold text-foreground">Information Sources</h3>
                  <p className="mt-1 text-xs text-muted-foreground">Provider: {research.provider} / Generated: {formatLocalizedDate(research.generated_at.slice(0, 10), language)}</p>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                {research.sources.map((source) => (
                  <a key={`${source.title}-${source.url}`} href={source.url} target="_blank" rel="noreferrer" className="flex flex-col gap-1 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between">
                    <span className="inline-flex items-center gap-2 font-medium text-foreground"><ExternalLink className="h-4 w-4 text-accent" />{source.title}</span>
                    <span className="text-xs text-muted-foreground">{formatLocalizedDate(source.retrieved_at.slice(0, 10), language)}</span>
                  </a>
                ))}
              </div>
            </article>
          </div>
        )}
      </Section>

      <Section title="Strategy Decision" subtitle="User decision only. AI Research is context; official Strategy Position is saved by you.">
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
          <h3 className="font-semibold text-foreground">User Decision / You decide</h3>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <label className="block">
              <span className="text-sm font-semibold text-foreground">Strategy Position</span>
              <select value={form.strategy_position} onChange={(event) => setForm((current) => (current ? { ...current, strategy_position: event.target.value as StrategyPosition } : current))} className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring">
                {strategyPositions.map((position) => <option key={position} value={position}>{position}</option>)}
              </select>
            </label>
            <TextAreaField label="Reason" value={form.reason} onChange={(value) => setForm((current) => (current ? { ...current, reason: value } : current))} />
            <TextAreaField label="Next Action" value={form.next_action} onChange={(value) => setForm((current) => (current ? { ...current, next_action: value } : current))} />
            <TextAreaField label="Personal Notes for Strategy" value={form.personal_notes} onChange={(value) => setForm((current) => (current ? { ...current, personal_notes: value } : current))} />
          </div>
        </div>
      </Section>
      <Section title="ES Memo" subtitle="Your own application memo. Organize reasons and examples in your own words.">
        <div className="grid gap-3 lg:grid-cols-2">
          <TextAreaField label="Motivation draft" value={form.es_motivation_draft} onChange={(value) => setForm((current) => (current ? { ...current, es_motivation_draft: value } : current))} />
          <TextAreaField label="Research connection" value={form.es_research_connection} onChange={(value) => setForm((current) => (current ? { ...current, es_research_connection: value } : current))} />
          <TextAreaField label="Project / Web app connection" value={form.es_project_connection} onChange={(value) => setForm((current) => (current ? { ...current, es_project_connection: value } : current))} />
          <TextAreaField label="Company-specific appeal points" value={form.es_appeal_points} onChange={(value) => setForm((current) => (current ? { ...current, es_appeal_points: value } : current))} />
          <TextAreaField label="Missing information" value={form.es_missing_information} onChange={(value) => setForm((current) => (current ? { ...current, es_missing_information: value } : current))} />
        </div>
      </Section>

      <Section title="Interview Memo" subtitle="Keep interview preparation and reflections for this company.">
        <div className="grid gap-3 lg:grid-cols-2">
          <TextAreaField label="Expected questions" value={form.interview_expected_questions} onChange={(value) => setForm((current) => (current ? { ...current, interview_expected_questions: value } : current))} />
          <TextAreaField label="Stories to tell" value={form.interview_stories} onChange={(value) => setForm((current) => (current ? { ...current, interview_stories: value } : current))} />
          <TextAreaField label="Reverse questions" value={form.interview_reverse_questions} onChange={(value) => setForm((current) => (current ? { ...current, interview_reverse_questions: value } : current))} />
          <TextAreaField label="Interview reflection" value={form.interview_reflection} onChange={(value) => setForm((current) => (current ? { ...current, interview_reflection: value } : current))} />
        </div>
      </Section>

      <Section title="Personal Notes" subtitle="Free notes for research, briefings, OB visits, and anything you want to keep.">
        <TextAreaField label="Personal Notes" value={form.notebook_personal_notes} onChange={(value) => setForm((current) => (current ? { ...current, notebook_personal_notes: value } : current))} />
      </Section>
    </div>
  )
}
