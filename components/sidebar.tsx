"use client"

import {
  Building2,
  CalendarClock,
  CalendarDays,
  GanttChartSquare,
  GraduationCap,
  LayoutDashboard,
  ListTodo,
  Settings,
} from "lucide-react"
import { copy, secondaryText, text, useLanguagePreference } from "@/lib/language"
import { cn } from "@/lib/utils"

export type ViewKey = "dashboard" | "companies" | "events" | "tasks" | "timeline" | "calendar" | "settings"

const nav: { key: ViewKey; en: string; ja: string; icon: React.ElementType }[] = [
  { key: "dashboard", ...copy.dashboard, icon: LayoutDashboard },
  { key: "companies", ...copy.companies, icon: Building2 },
  { key: "events", ...copy.events, icon: CalendarClock },
  { key: "tasks", en: "Tasks", ja: "タスク", icon: ListTodo },
  { key: "timeline", ...copy.timeline, icon: GanttChartSquare },
  { key: "calendar", ...copy.calendar, icon: CalendarDays },
  { key: "settings", ...copy.settings, icon: Settings },
]

export function Sidebar({ active, onChange }: { active: ViewKey; onChange: (v: ViewKey) => void }) {
  const language = useLanguagePreference()

  return (
    <aside className="hidden w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="cyber-logo-ring flex h-9 w-9 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
          <GraduationCap className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-white">CareerTrack</p>
          <p className="text-[11px] text-sidebar-foreground/70">{text(language, copy.appSubtitle)}</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
        <p className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
          {text(language, copy.menu)}
        </p>
        {nav.map((item) => {
          const isActive = active === item.key
          const Icon = item.icon
          const secondary = secondaryText(language, item)

          return (
            <button
              key={item.key}
              onClick={() => onChange(item.key)}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-white",
              )}
            >
              <Icon className="h-[18px] w-[18px]" />
              <span className="flex-1 text-left font-medium">{text(language, item)}</span>
              {secondary && (
                <span
                  className={cn(
                    "text-[11px]",
                    isActive ? "text-sidebar-primary-foreground/80" : "text-sidebar-foreground/45",
                  )}
                >
                  {secondary}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      <div className="m-3 rounded-xl bg-sidebar-accent p-4">
        <p className="text-xs font-medium text-white">{text(language, copy.recruitment2026)}</p>
        <p className="mt-1 text-[11px] text-sidebar-foreground/70">{text(language, copy.recruitmentProgress)}</p>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-sidebar/60">
          <div className="h-full w-[45%] rounded-full bg-sidebar-primary" />
        </div>
        <p className="mt-2 text-[11px] text-sidebar-foreground/70">
          {text(language, copy.progress)} 45%
        </p>
      </div>
    </aside>
  )
}

export function MobileNav({ active, onChange }: { active: ViewKey; onChange: (v: ViewKey) => void }) {
  const language = useLanguagePreference()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-[9000] flex gap-1 overflow-x-auto border-t border-border bg-sidebar/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 shadow-[0_-12px_40px_rgba(0,0,0,0.24)] backdrop-blur md:hidden">
      {nav.map((item) => {
        const isActive = active === item.key
        const Icon = item.icon
        return (
          <button
            key={item.key}
            onClick={() => onChange(item.key)}
            className={cn(
              "flex min-h-12 min-w-[4.25rem] flex-col items-center justify-center gap-1 rounded-xl px-1.5 py-1 text-[10px] font-medium",
              isActive ? "bg-sidebar-primary text-sidebar-primary-foreground" : "text-sidebar-foreground/75",
            )}
          >
            <Icon className="h-5 w-5" />
            <span className="max-w-full truncate">{text(language, item)}</span>
          </button>
        )
      })}
    </nav>
  )
}
