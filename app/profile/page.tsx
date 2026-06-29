"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Bell, Camera, Globe, LogOut, Palette, Shield, User } from "lucide-react"
import { PasswordChangeForm } from "@/components/password-change-form"
import { MobileNav, Sidebar, type ViewKey } from "@/components/sidebar"
import { Button } from "@/components/ui/button"
import { getCurrentUser, type User as AuthUser } from "@/lib/auth"
import { signOut } from "@/lib/mock-auth"
import { useRequireAuth } from "@/lib/use-require-auth"
import { copy, secondaryText, text, useLanguagePreference } from "@/lib/language"

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
  "w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/40 sm:w-64"

export default function ProfilePage() {
  const router = useRouter()
  const language = useLanguagePreference()
  useRequireAuth()
  const [view] = useState<ViewKey>("settings")
  const [user, setUser] = useState<AuthUser | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadUser() {
      try {
        const currentUser = await getCurrentUser()
        if (!cancelled) setUser(currentUser)
      } catch {
        if (!cancelled) router.replace("/auth/sign-in")
      }
    }

    loadUser()

    return () => {
      cancelled = true
    }
  }, [router])

  const handleNav = (nextView: ViewKey) => {
    if (nextView === "settings") return
    router.push("/")
  }

  const handleSignOut = () => {
    signOut()
    router.replace("/auth/sign-in")
  }

  const label = (value: { en: string; ja: string }) => ({
    label: text(language, value),
    subtitle: secondaryText(language, value),
  })
  const displayName = user?.name ?? "Loading..."
  const email = user?.email ?? ""
  const graduationYear = user?.graduation_year ? `${user.graduation_year}` : "2027"
  const avatarInitial = displayName.trim().charAt(0).toUpperCase() || "U"

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar active={view} onChange={handleNav} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-border bg-background/80 px-5 py-4 backdrop-blur md:px-8">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground md:text-2xl">{text(language, { en: "Profile", ja: "プロフィール" })}</h1>
            {secondaryText(language, { en: "Profile", ja: "プロフィール" }) && (
              <p className="text-xs text-muted-foreground">{secondaryText(language, { en: "Profile", ja: "プロフィール" })}</p>
            )}
          </div>
          <Button variant="outline" size="lg" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" />
            {text(language, { en: "Sign out", ja: "ログアウト" })}
          </Button>
        </header>

        <MobileNav active={view} onChange={handleNav} />

        <main className="min-w-0 flex-1 overflow-y-auto px-5 py-6 md:px-8">
          <div className="mx-auto max-w-2xl space-y-5">
            <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5">
              <div className="relative">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-xl font-semibold text-primary">
                  {avatarInitial}
                </div>
                <button
                  className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground"
                  aria-label="Change profile image"
                >
                  <Camera className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="min-w-0">
                <p className="text-base font-semibold text-foreground">{displayName}</p>
                <p className="truncate text-sm text-muted-foreground">{email}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {graduationYear} {text(language, { en: "graduation", ja: "卒業" })} · {text(language, copy.recruitmentProgress)}
                </p>
              </div>
            </div>

            <Section icon={User} title={text(language, { en: "Profile", ja: "プロフィール" })} subtitle={secondaryText(language, { en: "Profile", ja: "プロフィール" })}>
              <Row label={text(language, { en: "Display name", ja: "表示名" })}>
                <input value={displayName} readOnly className={inputCls} />
              </Row>
              <Row {...label(copy.email)}>
                <input value={email} readOnly className={inputCls} />
              </Row>
              <Row {...label(copy.graduationYear)}>
                <select value={graduationYear} disabled className={inputCls}>
                  <option>2027</option>
                  <option>2026</option>
                  <option>2028</option>
                </select>
              </Row>
            </Section>

            <Section icon={Shield} title={text(language, copy.password)} subtitle={secondaryText(language, copy.password)}>
              <PasswordChangeForm language={language} />
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
                <span className="text-sm text-muted-foreground">{text(language, copy.language)}</span>
              </Row>
            </Section>
          </div>
        </main>
      </div>
    </div>
  )
}
