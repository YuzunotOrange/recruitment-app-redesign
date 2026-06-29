"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Bell, Globe, Info, LogOut, Palette, User } from "lucide-react"
import { PasswordChangeForm } from "@/components/password-change-form"
import { Button } from "@/components/ui/button"
import { getCurrentUser, logout, type User as AuthUser } from "@/lib/auth"
import { copy, secondaryText, setLanguagePreference, text, useLanguagePreference, type LanguageMode } from "@/lib/language"

function Toggle({ defaultOn = false }: { defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn)
  return (
    <button
      onClick={() => setOn((value) => !value)}
      role="switch"
      aria-checked={on}
      className={`relative h-6 w-11 rounded-full transition-colors ${on ? "bg-primary" : "bg-muted-foreground/30"}`}
    >
      <span
        className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-background shadow transition-transform ${
          on ? "translate-x-5" : "translate-x-0"
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

export function SettingsView() {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const language = useLanguagePreference()

  useEffect(() => {
    let active = true

    async function loadUser() {
      setLoading(true)

      try {
        const currentUser = await getCurrentUser()
        if (active) setUser(currentUser)
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
        <Row {...label(copy.deadlineReminders)}>
          <Toggle defaultOn />
        </Row>
        <Row {...label(copy.interviewAlert)}>
          <Toggle defaultOn />
        </Row>
        <Row {...label(copy.weeklySummary)}>
          <Toggle />
        </Row>
      </Section>

      <Section icon={Palette} title={text(language, copy.appearance)} subtitle={secondaryText(language, copy.appearance)}>
        <Row {...label(copy.theme)}>
          <select className={inputCls}>
            <option>Navy (Light)</option>
            <option>System</option>
          </select>
        </Row>
        <Row {...label(copy.highlightDeadlines)}>
          <Toggle defaultOn />
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
