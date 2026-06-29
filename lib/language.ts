"use client"

import { useEffect, useState } from "react"

export type LanguageMode = "en" | "ja" | "ja-en"

type Copy = { en: string; ja: string }

const LANGUAGE_KEY = "careertrack_language"
const LANGUAGE_EVENT = "careertrack-language-change"
const DEFAULT_LANGUAGE: LanguageMode = "ja-en"

export const copy = {
  appSubtitle: { en: "Recruitment management system", ja: "就活管理システム" },
  menu: { en: "Menu", ja: "メニュー" },
  recruitment2026: { en: "2026 recruitment", ja: "2026年卒 就活" },
  recruitmentProgress: { en: "Selection phase in progress", ja: "選考フェーズ・進行中" },
  progress: { en: "Progress", ja: "進捗" },
  dashboard: { en: "Dashboard", ja: "ダッシュボード" },
  companies: { en: "Companies", ja: "企業一覧" },
  events: { en: "Events", ja: "イベント" },
  timeline: { en: "Timeline", ja: "タイムライン" },
  calendar: { en: "Calendar", ja: "カレンダー" },
  settings: { en: "Settings", ja: "設定" },
  loadingDashboard: { en: "Loading dashboard...", ja: "ダッシュボードを読み込み中..." },
  kpiCompanies: { en: "Companies", ja: "企業" },
  kpiEsReview: { en: "ES in review", ja: "ES確認中" },
  kpiInterviews: { en: "Interviews", ja: "面接" },
  kpiAwaiting: { en: "Awaiting", ja: "結果待ち" },
  kpiInternships: { en: "Internships", ja: "インターン" },
  kpiOffers: { en: "Offers", ja: "内定" },
  kpiDueSoon: { en: "Due <=7d", ja: "7日以内" },
  kpiToday: { en: "Today", ja: "今日" },
  recruitmentStatus: { en: "Recruitment status", ja: "選考状況" },
  recruitmentStatusBreakdown: { en: "Recruitment status breakdown", ja: "選考状況の内訳" },
  industries: { en: "Industries", ja: "業界" },
  byIndustry: { en: "By industry", ja: "業界別" },
  noIndustryData: { en: "No industry data yet.", ja: "業界データはまだありません。" },
  upcomingEvents: { en: "Upcoming events", ja: "今後のイベント" },
  upcomingSchedule: { en: "Upcoming events", ja: "今後の予定" },
  noUpcomingEvents: { en: "No upcoming events yet.", ja: "今後のイベントはまだありません。" },
  viewAll: { en: "View all", ja: "すべて見る" },
  account: { en: "Account", ja: "アカウント" },
  name: { en: "Name", ja: "氏名" },
  email: { en: "Email", ja: "メールアドレス" },
  graduationYear: { en: "Graduation year", ja: "卒業予定年" },
  password: { en: "Password", ja: "パスワード" },
  logout: { en: "Logout", ja: "ログアウト" },
  notifications: { en: "Notifications", ja: "通知設定" },
  appearance: { en: "Appearance", ja: "表示設定" },
  language: { en: "Language", ja: "言語" },
  system: { en: "System", ja: "システム情報" },
  interfaceLanguage: { en: "Interface language", ja: "表示言語" },
  theme: { en: "Theme", ja: "テーマ" },
  deadlineReminders: { en: "ES deadline reminders", ja: "ES締切リマインド" },
  interviewAlert: { en: "Interview day-before alert", ja: "面接前日アラート" },
  weeklySummary: { en: "Weekly summary email", ja: "週次サマリー" },
  highlightDeadlines: { en: "Highlight deadlines within 7 days", ja: "締切7日以内を強調" },
  signIn: { en: "Sign in", ja: "ログイン" },
  signInSubtitle: { en: "Sign in to your account to continue", ja: "アカウントにログインして続行" },
  signUp: { en: "Create account", ja: "アカウント作成" },
  signUpSubtitle: { en: "Create your account to start tracking", ja: "アカウントを作成して管理を開始" },
  rememberMe: { en: "Remember me", ja: "ログイン状態を保持" },
  forgotPassword: { en: "Forgot password?", ja: "パスワードを忘れた場合" },
  createOne: { en: "Create one", ja: "新規作成" },
  noAccount: { en: "Do not have an account?", ja: "アカウントをお持ちではありませんか？" },
  haveAccount: { en: "Already have an account?", ja: "すでにアカウントをお持ちですか？" },
  passwordHint: { en: "Password must be at least 8 characters.", ja: "パスワードは8文字以上で入力してください。" },
  termsAgree: { en: "I agree to the Terms and Privacy Policy.", ja: "利用規約とプライバシーポリシーに同意します。" },
} satisfies Record<string, Copy>

export function getLanguagePreference(): LanguageMode {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE
  const value = localStorage.getItem(LANGUAGE_KEY)
  return value === "en" || value === "ja" || value === "ja-en" ? value : DEFAULT_LANGUAGE
}

export function setLanguagePreference(language: LanguageMode) {
  if (typeof window === "undefined") return
  localStorage.setItem(LANGUAGE_KEY, language)
  window.dispatchEvent(new Event(LANGUAGE_EVENT))
}

export function useLanguagePreference() {
  const [language, setLanguage] = useState<LanguageMode>(DEFAULT_LANGUAGE)

  useEffect(() => {
    const syncLanguage = () => setLanguage(getLanguagePreference())

    syncLanguage()
    window.addEventListener(LANGUAGE_EVENT, syncLanguage)
    window.addEventListener("storage", syncLanguage)

    return () => {
      window.removeEventListener(LANGUAGE_EVENT, syncLanguage)
      window.removeEventListener("storage", syncLanguage)
    }
  }, [])

  return language
}

export function text(language: LanguageMode, value: Copy) {
  if (language === "ja") return value.ja
  return value.en
}

export function secondaryText(language: LanguageMode, value: Copy) {
  return language === "ja-en" ? value.ja : ""
}

export function bilingual(language: LanguageMode, value: Copy) {
  const secondary = secondaryText(language, value)
  return { primary: text(language, value), secondary }
}

export function formatLocalizedDate(value: string | Date, language: LanguageMode) {
  const date = typeof value === "string" ? parseIsoDate(value) : value
  if (Number.isNaN(date.getTime())) return "-"

  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()

  if (language === "ja") return `${year}年${month}月${day}日`
  if (language === "ja-en") return `${year}/${month}/${day}`
  return `${year}/${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}`
}

export function formatCalendarMonth(date: Date, language: LanguageMode) {
  return language === "ja" ? `${date.getFullYear()}年${date.getMonth() + 1}月` : `${date.getFullYear()}/${date.getMonth() + 1}`
}

export function formatCalendarWeek(date: Date, language: LanguageMode) {
  const week = Math.ceil(date.getDate() / 7)
  return language === "ja"
    ? `${date.getFullYear()}年${date.getMonth() + 1}月 第${week}週`
    : `${date.getFullYear()}/${date.getMonth() + 1} Week ${week}`
}

export function weekdayLabels(language: LanguageMode) {
  return language === "ja" ? ["日", "月", "火", "水", "木", "金", "土"] : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
}

function parseIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number)
  if (!year || !month || !day) return new Date(value)
  return new Date(year, month - 1, day)
}
