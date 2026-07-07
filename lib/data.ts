// ---------- Shared Types ----------

export type Priority = "S" | "A" | "B" | "C"
export type Industry = "maker" | "finance" | "consulting" | "it" | "other"

export type CompanyStatus =
  | "planned"
  | "applied"
  | "es_submitted"
  | "es_passed"
  | "es_rejected"
  | "spi_taking"
  | "spi_passed"
  | "spi_rejected"
  | "gd_scheduled"
  | "gd_passed"
  | "gd_rejected"
  | "first_interview_scheduled"
  | "first_interview_passed"
  | "second_interview_scheduled"
  | "second_interview_passed"
  | "final_interview_scheduled"
  | "final_interview_passed"
  | "waiting_result"
  | "internship_scheduled"
  | "internship_attending"
  | "internship_offer"
  | "interview"
  | "offer"
  | "declined"

export type InternStatus = "planned" | "applied" | "attending"
export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger"

export interface Company {
  id: string
  name: string
  industry: Industry
  priority: Priority
  importance: number
  status: CompanyStatus
  esDeadline?: string
  note?: string
}

export interface CareerEvent {
  id: string
  companyId: string
  title: string
  start: string
  end: string
  time?: string
  type: "briefing" | "interview" | "test" | "deadline" | "intern"
  note?: string
}

export interface Internship {
  id: string
  rank: number
  program: string
  companyId: string
  priority: Priority
  status: InternStatus
  start: string
  end: string
  note?: string
}

// ---------- Meta ----------

export const industryMeta: Record<Industry, { ja: string; en: string }> = {
  maker: { ja: "メーカー", en: "Maker" },
  finance: { ja: "金融", en: "Finance" },
  consulting: { ja: "コンサル", en: "Consulting" },
  it: { ja: "IT", en: "IT" },
  other: { ja: "その他", en: "Other" },
}

export const companyStatusMeta: Record<CompanyStatus, { ja: string; en: string; tone: StatusTone }> = {
  planned: { ja: "応募予定", en: "Planned", tone: "neutral" },
  applied: { ja: "応募済", en: "Applied", tone: "info" },
  es_submitted: { ja: "ES提出中", en: "ES submitted", tone: "warning" },
  es_passed: { ja: "ES通過", en: "ES passed", tone: "success" },
  es_rejected: { ja: "ES不通過", en: "ES rejected", tone: "danger" },
  spi_taking: { ja: "SPI受験", en: "SPI taking", tone: "warning" },
  spi_passed: { ja: "SPI通過", en: "SPI passed", tone: "success" },
  spi_rejected: { ja: "SPI不通過", en: "SPI rejected", tone: "danger" },
  gd_scheduled: { ja: "GD予定", en: "GD scheduled", tone: "info" },
  gd_passed: { ja: "GD通過", en: "GD passed", tone: "success" },
  gd_rejected: { ja: "GD不通過", en: "GD rejected", tone: "danger" },
  first_interview_scheduled: { ja: "一次面接予定", en: "1st interview scheduled", tone: "info" },
  first_interview_passed: { ja: "一次面接通過", en: "1st interview passed", tone: "success" },
  second_interview_scheduled: { ja: "二次面接予定", en: "2nd interview scheduled", tone: "info" },
  second_interview_passed: { ja: "二次面接通過", en: "2nd interview passed", tone: "success" },
  final_interview_scheduled: { ja: "最終面接予定", en: "Final interview scheduled", tone: "info" },
  final_interview_passed: { ja: "最終面接通過", en: "Final interview passed", tone: "success" },
  waiting_result: { ja: "結果待ち", en: "Waiting result", tone: "warning" },
  internship_scheduled: { ja: "インターン参加予定", en: "Internship scheduled", tone: "info" },
  internship_attending: { ja: "インターン参加中", en: "Internship attending", tone: "warning" },
  internship_offer: { ja: "インターン決定", en: "Internship confirmed", tone: "success" },
  interview: { ja: "一次面接予定", en: "Interview", tone: "info" },
  offer: { ja: "内定", en: "Offer", tone: "success" },
  declined: { ja: "辞退", en: "Declined", tone: "neutral" },
}

export const internStatusMeta: Record<InternStatus, { ja: string; en: string; tone: "neutral" | "info" | "success" }> = {
  planned: { ja: "応募予定", en: "Planned", tone: "neutral" },
  applied: { ja: "応募済", en: "Applied", tone: "info" },
  attending: { ja: "参加予定", en: "Attending", tone: "success" },
}

export const priorityMeta: Record<Priority, { tone: "danger" | "warning" | "info" | "neutral" }> = {
  S: { tone: "danger" },
  A: { tone: "warning" },
  B: { tone: "info" },
  C: { tone: "neutral" },
}

// Static demo arrays are intentionally empty. Live data comes from FastAPI.
export const companies: Company[] = []
export const events: CareerEvent[] = []
export const internships: Internship[] = []

// ---------- Helpers ----------

export function parseLocalDate(dateIso: string) {
  const [year, month, day] = dateIso.split("-").map(Number)
  if (!year || !month || !day) return new Date(dateIso)
  return new Date(year, month - 1, day)
}

export function getToday() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

export const TODAY = getToday()

export function companyName(id: string) {
  return companies.find((company) => company.id === id)?.name ?? "-"
}

export function daysUntil(dateIso: string, from: Date = getToday()) {
  const date = parseLocalDate(dateIso)
  return Math.ceil((date.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))
}

export function formatDate(dateIso: string) {
  const date = parseLocalDate(dateIso)
  return `${date.getMonth() + 1}/${date.getDate()}`
}

export interface ActivityItem {
  id: string
  company: string
  text: string
  date: string
  tone: StatusTone
}

export const recentActivity: ActivityItem[] = []
