// ---------- Types ----------

export type Priority = "S" | "A" | "B" | "C"
export type Industry = "maker" | "finance" | "consulting" | "it" | "other"

export type CompanyStatus =
  | "planned" // 応募予定
  | "es_submitted" // ES提出中
  | "es_rejected" // ES不通過
  | "spi_rejected" // SPI不通過
  | "interview" // 一次面接予定
  | "offer" // 内定
  | "declined" // 辞退

export type InternStatus =
  | "planned" // 応募予定
  | "applied" // 応募済
  | "attending" // 参加予定

export interface Company {
  id: string
  name: string
  industry: Industry
  priority: Priority
  importance: number // 1-5 stars
  status: CompanyStatus
  esDeadline?: string // ISO date
  note?: string
}

export interface CareerEvent {
  id: string
  companyId: string
  title: string // イベント名
  start: string // ISO date
  end: string
  time?: string // 開始時刻
  type: "briefing" | "interview" | "test" | "deadline" | "intern"
  note?: string
}

export interface Internship {
  id: string
  rank: number // 優先順位
  program: string // プログラム名
  companyId: string
  priority: Priority
  status: InternStatus
  start: string
  end: string
  note?: string
}

// ---------- Meta (bilingual labels + colors) ----------

export const industryMeta: Record<Industry, { ja: string; en: string }> = {
  maker: { ja: "メーカー", en: "Maker" },
  finance: { ja: "金融", en: "Finance" },
  consulting: { ja: "コンサル", en: "Consulting" },
  it: { ja: "IT", en: "IT" },
  other: { ja: "その他", en: "Other" },
}

export const companyStatusMeta: Record<
  CompanyStatus,
  { ja: string; en: string; tone: "neutral" | "info" | "success" | "warning" | "danger" }
> = {
  planned: { ja: "応募予定", en: "Planned", tone: "neutral" },
  es_submitted: { ja: "ES提出中", en: "ES in review", tone: "warning" },
  es_rejected: { ja: "ES不通過", en: "ES rejected", tone: "danger" },
  spi_rejected: { ja: "SPI不通過", en: "SPI rejected", tone: "danger" },
  interview: { ja: "一次面接予定", en: "Interview", tone: "info" },
  offer: { ja: "内定", en: "Offer", tone: "success" },
  declined: { ja: "辞退", en: "Declined", tone: "neutral" },
}

export const internStatusMeta: Record<
  InternStatus,
  { ja: string; en: string; tone: "neutral" | "info" | "success" }
> = {
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

// ---------- Seed data (from the Excel workbook) ----------

export const companies: Company[] = [
  { id: "c1", name: "ソニー", industry: "maker", priority: "A", importance: 4, status: "es_submitted", esDeadline: "2026-06-19" },
  { id: "c2", name: "ソニーグループ", industry: "maker", priority: "S", importance: 5, status: "es_rejected", esDeadline: "2026-06-05" },
  { id: "c3", name: "ソニーインタラクティブエンタテインメント", industry: "maker", priority: "A", importance: 3, status: "es_rejected", esDeadline: "2026-06-08" },
  { id: "c4", name: "ソニーグローバルソリューションズ", industry: "maker", priority: "A", importance: 3, status: "es_submitted", esDeadline: "2026-06-28" },
  { id: "c5", name: "日揮ホールディングス", industry: "maker", priority: "B", importance: 3, status: "es_submitted", esDeadline: "2026-06-12", note: "本選考の受付開始は9月頃予定" },
  { id: "c6", name: "日立製作所", industry: "maker", priority: "A", importance: 4, status: "es_rejected" },
  { id: "c7", name: "ブリヂストン", industry: "maker", priority: "B", importance: 3, status: "interview", esDeadline: "2026-06-19" },
  { id: "c8", name: "コマツ", industry: "maker", priority: "B", importance: 3, status: "declined" },
  { id: "c9", name: "三菱自動車", industry: "maker", priority: "B", importance: 4, status: "es_submitted", esDeadline: "2026-06-22" },
  { id: "c10", name: "荏原製作所", industry: "maker", priority: "A", importance: 3, status: "planned" },
  { id: "c11", name: "三井住友 SMBC", industry: "finance", priority: "A", importance: 4, status: "es_submitted", esDeadline: "2026-06-14" },
  { id: "c12", name: "三菱UFJ", industry: "finance", priority: "A", importance: 4, status: "es_submitted", esDeadline: "2026-06-19" },
  { id: "c13", name: "三菱信託銀行", industry: "finance", priority: "B", importance: 4, status: "planned" },
  { id: "c14", name: "アクセンチュア", industry: "consulting", priority: "S", importance: 5, status: "spi_rejected", esDeadline: "2026-05-21" },
  { id: "c15", name: "PwCコンサルティング", industry: "consulting", priority: "A", importance: 3, status: "es_submitted" },
  { id: "c16", name: "PwCアドバイザリー", industry: "consulting", priority: "B", importance: 3, status: "spi_rejected" },
  { id: "c17", name: "アビーム", industry: "consulting", priority: "A", importance: 4, status: "spi_rejected", esDeadline: "2026-06-06", note: "本選考は秋実施予定" },
  { id: "c18", name: "EYストラテジー", industry: "consulting", priority: "A", importance: 3, status: "spi_rejected" },
  { id: "c19", name: "デロイトトーマツサイバー", industry: "consulting", priority: "S", importance: 4, status: "es_submitted", esDeadline: "2026-07-02" },
  { id: "c20", name: "キャップジェミニ", industry: "consulting", priority: "A", importance: 3, status: "planned" },
]

export const events: CareerEvent[] = [
  { id: "e1", companyId: "c5", title: "説明会", start: "2026-06-24", end: "2026-06-24", time: "12:00", type: "briefing" },
  { id: "e2", companyId: "c7", title: "一次面接", start: "2026-06-29", end: "2026-06-29", time: "15:30", type: "interview" },
  { id: "e3", companyId: "c19", title: "ES締切", start: "2026-07-02", end: "2026-07-02", type: "deadline" },
  { id: "e4", companyId: "c11", title: "GD選考", start: "2026-07-06", end: "2026-07-06", time: "10:00", type: "test" },
  { id: "e5", companyId: "c12", title: "Webテスト締切", start: "2026-07-08", end: "2026-07-08", type: "deadline" },
]

export const internships: Internship[] = [
  { id: "i1", rank: 1, program: "AIサービス開発エンジニア", companyId: "c1", priority: "A", status: "planned", start: "2026-08-31", end: "2026-09-11" },
  { id: "i2", rank: 2, program: "AI活用クラウドサービス開発", companyId: "c1", priority: "A", status: "planned", start: "2026-08-31", end: "2026-09-11" },
  { id: "i3", rank: 3, program: "3days Internship", companyId: "c19", priority: "A", status: "planned", start: "2026-08-05", end: "2026-08-07" },
  { id: "i4", rank: 3, program: "3days Internship", companyId: "c19", priority: "A", status: "planned", start: "2026-08-19", end: "2026-08-21" },
  { id: "i5", rank: 3, program: "製品安全に関するグローバル法規", companyId: "c1", priority: "C", status: "planned", start: "2026-08-31", end: "2026-09-11" },
  { id: "i6", rank: 5, program: "リスクアナリスト編", companyId: "c11", priority: "A", status: "applied", start: "2026-08-17", end: "2026-08-19" },
  { id: "i7", rank: 5, program: "リスクアナリスト編", companyId: "c11", priority: "A", status: "applied", start: "2026-08-24", end: "2026-08-26" },
  { id: "i8", rank: 7, program: "DX体感", companyId: "c5", priority: "A", status: "applied", start: "2026-08-17", end: "2026-08-21" },
  { id: "i9", rank: 7, program: "DX体感", companyId: "c5", priority: "A", status: "applied", start: "2026-08-24", end: "2026-08-28" },
  { id: "i10", rank: 7, program: "DX体感", companyId: "c5", priority: "A", status: "applied", start: "2026-09-07", end: "2026-09-11" },
  { id: "i11", rank: 8, program: "理系1week", companyId: "c5", priority: "B", status: "applied", start: "2026-08-17", end: "2026-08-21" },
  { id: "i12", rank: 8, program: "理系1week", companyId: "c5", priority: "B", status: "applied", start: "2026-08-24", end: "2026-08-28" },
  { id: "i13", rank: 8, program: "理系1week", companyId: "c5", priority: "B", status: "applied", start: "2026-09-07", end: "2026-09-11" },
  { id: "i14", rank: 9, program: "ソリューションIT", companyId: "c7", priority: "B", status: "planned", start: "2026-08-24", end: "2026-09-04" },
  { id: "i15", rank: 10, program: "ITサービス企画（コーポレート）", companyId: "c7", priority: "B", status: "planned", start: "2026-08-24", end: "2026-09-04" },
  { id: "i16", rank: 11, program: "ITサービス企画（生産系）", companyId: "c7", priority: "B", status: "planned", start: "2026-08-24", end: "2026-09-04" },
  { id: "i17", rank: 12, program: "2days プログラム", companyId: "c5", priority: "B", status: "attending", start: "2026-08-06", end: "2026-08-07", note: "抽選で決定" },
  { id: "i18", rank: 12, program: "2days プログラム", companyId: "c5", priority: "B", status: "planned", start: "2026-09-09", end: "2026-09-10", note: "抽選で決定" },
  { id: "i19", rank: 12, program: "2days プログラム", companyId: "c5", priority: "B", status: "planned", start: "2026-09-15", end: "2026-09-16", note: "抽選で決定" },
]

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
  return companies.find((c) => c.id === id)?.name ?? "—"
}

export function daysUntil(dateIso: string, from: Date = getToday()) {
  const d = parseLocalDate(dateIso)
  const diff = Math.ceil((d.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))
  return diff
}

export function formatDate(dateIso: string) {
  const d = parseLocalDate(dateIso)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export interface ActivityItem {
  id: string
  company: string
  text: string
  date: string
  tone: "info" | "success" | "warning" | "danger" | "neutral"
}

export const recentActivity: ActivityItem[] = [
  { id: "a1", company: "デロイトトーマツサイバー", text: "ESを提出しました", date: "2026-06-24", tone: "warning" },
  { id: "a2", company: "日揮ホールディングス", text: "説明会の予定を追加", date: "2026-06-23", tone: "info" },
  { id: "a3", company: "ブリヂストン", text: "一次面接が確定", date: "2026-06-22", tone: "info" },
  { id: "a4", company: "三菱自動車", text: "ES締切が近づいています", date: "2026-06-21", tone: "warning" },
  { id: "a5", company: "アクセンチュア", text: "SPI不通過", date: "2026-06-20", tone: "danger" },
]
