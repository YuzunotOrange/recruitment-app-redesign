"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Bell, BookOpen, BriefcaseBusiness, Camera, Code2, Globe, GraduationCap, Loader2, LogOut, Palette, Save, Shield, Target, User } from "lucide-react"
import { PasswordChangeForm } from "@/components/password-change-form"
import { MobileNav, Sidebar, type ViewKey } from "@/components/sidebar"
import { Button } from "@/components/ui/button"
import { apiRequest } from "@/lib/api"
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

const textareaCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40 sm:w-96"

type UserProfile = {
  user_id: number
  education: string | null
  major: string | null
  research_theme: string | null
  research_summary: string | null
  skills: string[]
  programming_languages: string[]
  frameworks: string[]
  projects: string[]
  internship_experience: string | null
  qualifications: string | null
  certifications: string | null
  interests: string | null
  preferred_industries: string | null
  preferred_jobs: string | null
  preferred_locations: string | null
  global_interest: string | null
  career_goal: string | null
  self_strengths: string | null
  self_weaknesses: string | null
  updated_at: string | null
}

type UserProfileForm = Omit<UserProfile, "user_id" | "updated_at">

const emptyProfileForm: UserProfileForm = {
  education: "",
  major: "",
  research_theme: "",
  research_summary: "",
  skills: [],
  programming_languages: [],
  frameworks: [],
  projects: [],
  internship_experience: "",
  qualifications: "",
  certifications: "",
  interests: "",
  preferred_industries: "",
  preferred_jobs: "",
  preferred_locations: "",
  global_interest: "",
  career_goal: "",
  self_strengths: "",
  self_weaknesses: "",
}

function listToInput(value: string[]) {
  return value.join(", ")
}

function inputToList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

function profileToForm(profile: UserProfile): UserProfileForm {
  return {
    education: profile.education ?? "",
    major: profile.major ?? "",
    research_theme: profile.research_theme ?? "",
    research_summary: profile.research_summary ?? "",
    skills: profile.skills ?? [],
    programming_languages: profile.programming_languages ?? [],
    frameworks: profile.frameworks ?? [],
    projects: profile.projects ?? [],
    internship_experience: profile.internship_experience ?? "",
    qualifications: profile.qualifications ?? "",
    certifications: profile.certifications ?? "",
    interests: profile.interests ?? "",
    preferred_industries: profile.preferred_industries ?? "",
    preferred_jobs: profile.preferred_jobs ?? "",
    preferred_locations: profile.preferred_locations ?? "",
    global_interest: profile.global_interest ?? "",
    career_goal: profile.career_goal ?? "",
    self_strengths: profile.self_strengths ?? "",
    self_weaknesses: profile.self_weaknesses ?? "",
  }
}

function profilePayload(form: UserProfileForm) {
  return Object.fromEntries(
    Object.entries(form).map(([key, value]) => [
      key,
      Array.isArray(value) ? value : typeof value === "string" && value.trim() ? value.trim() : null,
    ]),
  )
}

function TextAreaRow({
  label,
  subtitle,
  value,
  onChange,
  rows = 3,
}: {
  label: string
  subtitle?: string
  value: string
  onChange: (value: string) => void
  rows?: number
}) {
  return (
    <Row label={label} subtitle={subtitle}>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={rows} className={textareaCls} />
    </Row>
  )
}

function ListRow({
  label,
  subtitle,
  value,
  onChange,
}: {
  label: string
  subtitle?: string
  value: string[]
  onChange: (value: string[]) => void
}) {
  return (
    <Row label={label} subtitle={subtitle ?? "Comma separated"}>
      <input value={listToInput(value)} onChange={(event) => onChange(inputToList(event.target.value))} className={inputCls} />
    </Row>
  )
}

export default function ProfilePage() {
  const router = useRouter()
  const language = useLanguagePreference()
  useRequireAuth()
  const [view] = useState<ViewKey>("settings")
  const [user, setUser] = useState<AuthUser | null>(null)
  const [profile, setProfile] = useState<UserProfileForm>(emptyProfileForm)
  const [profileLoading, setProfileLoading] = useState(true)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMessage, setProfileMessage] = useState<string | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadUser() {
      try {
        const [currentUser, currentProfile] = await Promise.all([
          getCurrentUser(),
          apiRequest<UserProfile>("/profile"),
        ])
        if (!cancelled) {
          setUser(currentUser)
          setProfile(profileToForm(currentProfile))
          setProfileLoading(false)
        }
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

  const handleSignOut = async () => {
    await signOut()
    router.replace("/auth/sign-in")
  }

  const saveProfile = async () => {
    setProfileSaving(true)
    setProfileError(null)
    setProfileMessage(null)
    try {
      const updated = await apiRequest<UserProfile>("/profile", {
        method: "PUT",
        body: JSON.stringify(profilePayload(profile)),
      })
      setProfile(profileToForm(updated))
      setProfileMessage("Profile saved.")
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Failed to save profile.")
    } finally {
      setProfileSaving(false)
    }
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

            <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-foreground">User Profile Engine</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your profile will later be used by AI Research, Strategy, Advisor, ES, and Interview support.
                </p>
                {profileMessage && <p className="mt-2 text-sm text-success">{profileMessage}</p>}
                {profileError && <p className="mt-2 text-sm text-destructive">{profileError}</p>}
              </div>
              <Button variant="default" size="lg" onClick={saveProfile} disabled={profileSaving || profileLoading}>
                {profileSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Profile
              </Button>
            </div>

            <Section icon={GraduationCap} title="Academic" subtitle="Education and major">
              <TextAreaRow label="Education" value={profile.education ?? ""} onChange={(value) => setProfile((current) => ({ ...current, education: value }))} rows={2} />
              <TextAreaRow label="Major" value={profile.major ?? ""} onChange={(value) => setProfile((current) => ({ ...current, major: value }))} rows={2} />
            </Section>

            <Section icon={BookOpen} title="Research" subtitle="Research theme and summary">
              <TextAreaRow label="Research theme" value={profile.research_theme ?? ""} onChange={(value) => setProfile((current) => ({ ...current, research_theme: value }))} />
              <TextAreaRow label="Research summary" value={profile.research_summary ?? ""} onChange={(value) => setProfile((current) => ({ ...current, research_summary: value }))} rows={4} />
            </Section>

            <Section icon={Code2} title="Skills" subtitle="JSON arrays are saved through comma-separated inputs">
              <ListRow label="Skills" value={profile.skills} onChange={(value) => setProfile((current) => ({ ...current, skills: value }))} />
              <ListRow label="Programming Languages" value={profile.programming_languages} onChange={(value) => setProfile((current) => ({ ...current, programming_languages: value }))} />
              <ListRow label="Frameworks" value={profile.frameworks} onChange={(value) => setProfile((current) => ({ ...current, frameworks: value }))} />
            </Section>

            <Section icon={BriefcaseBusiness} title="Projects" subtitle="Development projects and experience">
              <ListRow label="Projects" value={profile.projects} onChange={(value) => setProfile((current) => ({ ...current, projects: value }))} />
              <TextAreaRow label="Internship Experience" value={profile.internship_experience ?? ""} onChange={(value) => setProfile((current) => ({ ...current, internship_experience: value }))} />
              <TextAreaRow label="Qualifications" value={profile.qualifications ?? ""} onChange={(value) => setProfile((current) => ({ ...current, qualifications: value }))} />
              <TextAreaRow label="Certifications" value={profile.certifications ?? ""} onChange={(value) => setProfile((current) => ({ ...current, certifications: value }))} />
            </Section>

            <Section icon={Target} title="Career Goal" subtitle="Interests and future direction">
              <TextAreaRow label="Interests" value={profile.interests ?? ""} onChange={(value) => setProfile((current) => ({ ...current, interests: value }))} />
              <TextAreaRow label="Career Goal" value={profile.career_goal ?? ""} onChange={(value) => setProfile((current) => ({ ...current, career_goal: value }))} />
              <TextAreaRow label="Global Interest" value={profile.global_interest ?? ""} onChange={(value) => setProfile((current) => ({ ...current, global_interest: value }))} />
            </Section>

            <Section icon={Globe} title="Preferred Industry / Job" subtitle="Target fields and locations">
              <TextAreaRow label="Preferred Industries" value={profile.preferred_industries ?? ""} onChange={(value) => setProfile((current) => ({ ...current, preferred_industries: value }))} />
              <TextAreaRow label="Preferred Jobs" value={profile.preferred_jobs ?? ""} onChange={(value) => setProfile((current) => ({ ...current, preferred_jobs: value }))} />
              <TextAreaRow label="Preferred Locations" value={profile.preferred_locations ?? ""} onChange={(value) => setProfile((current) => ({ ...current, preferred_locations: value }))} />
            </Section>

            <Section icon={Shield} title="Strengths / Weaknesses" subtitle="Self-analysis for ES and interviews">
              <TextAreaRow label="Strengths" value={profile.self_strengths ?? ""} onChange={(value) => setProfile((current) => ({ ...current, self_strengths: value }))} />
              <TextAreaRow label="Weaknesses" value={profile.self_weaknesses ?? ""} onChange={(value) => setProfile((current) => ({ ...current, self_weaknesses: value }))} />
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
