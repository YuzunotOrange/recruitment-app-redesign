"use client"

import {
  LayoutDashboard,
  Building2,
  CalendarClock,
  GanttChartSquare,
  CalendarDays,
  Settings,
  GraduationCap,
} from "lucide-react"
import { cn } from "@/lib/utils"

export type ViewKey =
  | "dashboard"
  | "companies"
  | "events"
  | "timeline"
  | "calendar"
  | "settings"

const nav: { key: ViewKey; en: string; ja: string; icon: React.ElementType }[] = [
  { key: "dashboard", en: "Dashboard", ja: "ダッシュボード", icon: LayoutDashboard },
  { key: "companies", en: "Companies", ja: "企業一覧", icon: Building2 },
  { key: "events", en: "Events", ja: "イベント", icon: CalendarClock },
  { key: "timeline", en: "Timeline", ja: "タイムライン", icon: GanttChartSquare },
  { key: "calendar", en: "Calendar", ja: "カレンダー", icon: CalendarDays },
  { key: "settings", en: "Settings", ja: "設定", icon: Settings },
]

export function Sidebar({
  active,
  onChange,
}: {
  active: ViewKey
  onChange: (v: ViewKey) => void
}) {
  return (
    <aside className="hidden w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
          <GraduationCap className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-white">CareerTrack</p>
          <p className="text-[11px] text-sidebar-foreground/70">就活管理システム</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
        <p className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
          Menu
        </p>
        {nav.map((item) => {
          const isActive = active === item.key
          const Icon = item.icon
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
              <span className="flex-1 text-left font-medium">{item.en}</span>
              <span
                className={cn(
                  "text-[11px]",
                  isActive ? "text-sidebar-primary-foreground/80" : "text-sidebar-foreground/45",
                )}
              >
                {item.ja}
              </span>
            </button>
          )
        })}
      </nav>

      <div className="m-3 rounded-xl bg-sidebar-accent p-4">
        <p className="text-xs font-medium text-white">2026年卒 就活</p>
        <p className="mt-1 text-[11px] text-sidebar-foreground/70">
          選考フェーズ・進行中
        </p>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-sidebar/60">
          <div className="h-full w-[45%] rounded-full bg-sidebar-primary" />
        </div>
        <p className="mt-2 text-[11px] text-sidebar-foreground/70">進捗 45%</p>
      </div>
    </aside>
  )
}

export function MobileNav({
  active,
  onChange,
}: {
  active: ViewKey
  onChange: (v: ViewKey) => void
}) {
  return (
    <nav className="flex items-center gap-1 overflow-x-auto border-b border-border bg-sidebar px-2 py-2 md:hidden">
      {nav.map((item) => {
        const isActive = active === item.key
        const Icon = item.icon
        return (
          <button
            key={item.key}
            onClick={() => onChange(item.key)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium",
              isActive
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "text-sidebar-foreground/75",
            )}
          >
            <Icon className="h-4 w-4" />
            {item.en}
          </button>
        )
      })}
    </nav>
  )
}
