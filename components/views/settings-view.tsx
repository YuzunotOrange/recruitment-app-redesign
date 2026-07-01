"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Bell, Globe, Info, LogOut, Palette, User } from "lucide-react"
import { PasswordChangeForm } from "@/components/password-change-form"
import { Button } from "@/components/ui/button"
import { apiRequest } from "@/lib/api"
import { getCurrentUser, logout, updateUserTheme, type User as AuthUser } from "@/lib/auth"
import { copy, secondaryText, setLanguagePreference, text, useLanguagePreference, type LanguageMode } from "@/lib/language"
import { requestNotificationRefresh } from "@/lib/notification-events"
import { setThemePreference, useThemePreference, type ThemeMode } from "@/lib/theme"

function Toggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      className={`relative h-6 w-11 rounded-full transition-colors disabled:opacity-60 ${
        checked ? "bg-primary" : "bg-muted-foreground/30"
      }`}
    >
      <span
        className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-background shadow transition-transform ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  )
}

function Section({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ElementType
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-5 py-4">
        <Icon className="h-4 w-4 text-accent" />
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      <div className="divide-y divide-border">{children}</div>
    </div>
  )
}

function Row({ label, subtitle, children }: { label: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-stretch gap-2 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

const inputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring disabled:opacity-70 sm:w-64"

const meta = [
  { k: "Version", v: "v3.2 Pro" },
  { k: "Created", v: "2026-06-16" },
  { k: "Updated", v: "2026-06-25" },
  { k: "Data source", v: "FastAPI + SQLite" },
]

type ReminderSettings = {
  es_deadline_enabled: boolean
  interview_enabled: boolean
  internship_enabled: boolean
  info_session_enabled: boolean
  offer_enabled: boolean
  weekly_summary_enabled: boolean
}

const defaultReminderSettings: ReminderSettings = {
  es_deadline_enabled: true,
  interview_enabled: true,
  internship_enabled: true,
  info_session_enabled: true,
  offer_enabled: true,
  weekly_summary_enabled: false,
}

export function SettingsView() {
  const router = useRouter()
  const theme = useThemePreference()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [reminderSettings, setReminderSettings] = useState<ReminderSettings>(defaultReminderSettings)
  const [loading, setLoading] = useState(true)
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsError, setSettingsError] = useState<string | null>(null)
  const language = useLanguagePreference()

  useEffect(() => {
    let active = true

    async function loadUser() {
      setLoading(true)

      try {
        const [currentUser, settings] = await Promise.all([
          getCurrentUser(),
          apiRequest<ReminderSettings>("/reminder-settings"),
        ])
        if (active) {
          setUser(currentUser)
          setReminderSettings({ ...defaultReminderSettings, ...settings })
        }
      } catch {
        if (active) {
          logout()
          router.replace("/auth/sign-in")
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    loadUser()

    return () => {
      active = false
    }
  }, [router])

  const handleLogout = () => {
    logout()
    router.replace("/auth/sign-in")
  }

  const updateReminderSetting = async (key: keyof ReminderSettings, value: boolean) => {
    const previous = reminderSettings
    const next = { ...reminderSettings, [key]: value }
    setReminderSettings(next)
    setSettingsSaving(true)
    setSettingsError(null)

    try {
      const saved = await apiRequest<ReminderSettings>("/reminder-settings", {
        method: "PUT",
        body: JSON.stringify({ [key]: value }),
      })
      setReminderSettings({ ...defaultReminderSettings, ...saved })
      requestNotificationRefresh()
    } catch (err) {
      setReminderSettings(previous)
      setSettingsError(err instanceof Error ? err.message : "Failed to save notification settings.")
    } finally {
      setSettingsSaving(false)
    }
  }

  const updateTheme = async (nextTheme: ThemeMode) => {
    const previous = theme
    setThemePreference(nextTheme)

    try {
      await updateUserTheme(nextTheme)
    } catch (err) {
      setThemePreference(previous)
      setSettingsError(err instanceof Error ? err.message : "Failed to save theme.")
    }
  }

  const displayName = user?.name ?? (loading ? "Loading..." : "")
  const email = user?.email ?? (loading ? "Loading..." : "")
  const graduationYear = user?.graduation_year ? String(user.graduation_year) : ""
  const label = (value: { en: string; ja: string }) => ({
    label: text(language, value),
    subtitle: secondaryText(language, value),
  })

  return (
    <div className="max-w-2xl space-y-4">
      <Section icon={User} title={text(language, copy.account)} subtitle={secondaryText(language, copy.account)}>
        <Row {...label(copy.name)}>
          <input value={displayName} readOnly className={inputCls} />
        </Row>
        <Row {...label(copy.email)}>
          <input value={email} readOnly className={inputCls} />
        </Row>
        <Row {...label(copy.graduationYear)}>
          <input value={graduationYear || "-"} readOnly className={inputCls} />
        </Row>
        <PasswordChangeForm language={language} />
        <div className="flex justify-end px-5 py-3.5">
          <Button variant="destructive" size="lg" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            {text(language, copy.logout)}
          </Button>
        </div>
      </Section>

      <Section icon={Bell} title={text(language, copy.notifications)} subtitle={secondaryText(language, copy.notifications)}>
        {settingsError && <p className="px-5 py-3 text-sm text-destructive">{settingsError}</p>}
        <Row label={text(language, { en: "ES deadline reminders", ja: "ES締切リマインド" })}>
          <Toggle
            checked={reminderSettings.es_deadline_enabled}
            disabled={loading || settingsSaving}
            onChange={(checked) => updateReminderSetting("es_deadline_enabled", checked)}
          />
        </Row>
        <Row label={text(language, { en: "Interview reminders", ja: "面接リマインド" })}>
          <Toggle
            checked={reminderSettings.interview_enabled}
            disabled={loading || settingsSaving}
            onChange={(checked) => updateReminderSetting("interview_enabled", checked)}
          />
        </Row>
        <Row label={text(language, { en: "Internship reminders", ja: "インターンリマインド" })}>
          <Toggle
            checked={reminderSettings.internship_enabled}
            disabled={loading || settingsSaving}
            onChange={(checked) => updateReminderSetting("internship_enabled", checked)}
          />
        </Row>
        <Row label={text(language, { en: "Info session reminders", ja: "説明会リマインド" })}>
          <Toggle
            checked={reminderSettings.info_session_enabled}
            disabled={loading || settingsSaving}
            onChange={(checked) => updateReminderSetting("info_session_enabled", checked)}
          />
        </Row>
        <Row label={text(language, { en: "Offer notifications", ja: "内定通知" })}>
          <Toggle
            checked={reminderSettings.offer_enabled}
            disabled={loading || settingsSaving}
            onChange={(checked) => updateReminderSetting("offer_enabled", checked)}
          />
        </Row>
        <Row {...label(copy.weeklySummary)}>
          <Toggle
            checked={reminderSettings.weekly_summary_enabled}
            disabled={loading || settingsSaving}
            onChange={(checked) => updateReminderSetting("weekly_summary_enabled", checked)}
          />
        </Row>
      </Section>

      <Section icon={Palette} title={text(language, copy.appearance)} subtitle={secondaryText(language, copy.appearance)}>
        <Row {...label(copy.theme)}>
          <select
            value={theme}
            onChange={(event) => updateTheme(event.target.value as ThemeMode)}
            className={inputCls}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="cyberpunk">Cyberpunk</option>
          </select>
        </Row>
        <Row {...label(copy.highlightDeadlines)}>
          <Toggle checked disabled onChange={() => undefined} />
        </Row>
      </Section>

      <Section icon={Globe} title={text(language, copy.language)} subtitle={secondaryText(language, copy.language)}>
        <Row {...label(copy.interfaceLanguage)}>
          <select
            value={language}
            onChange={(event) => setLanguagePreference(event.target.value as LanguageMode)}
            className={inputCls}
          >
            <option value="ja-en">English + Japanese</option>
            <option value="ja">Japanese</option>
            <option value="en">English</option>
          </select>
        </Row>
      </Section>

      <Section icon={Info} title={text(language, copy.system)} subtitle={secondaryText(language, copy.system)}>
        {meta.map((item) => (
          <Row key={item.k} label={item.k}>
            <span className="text-sm text-muted-foreground">{item.v}</span>
          </Row>
        ))}
      </Section>
    </div>
  )
}
