"use client"

import { useState } from "react"
import { Search, Plus } from "lucide-react"
import { Sidebar, MobileNav, type ViewKey } from "@/components/sidebar"
import { RightPanel } from "@/components/right-panel"
import { Dashboard } from "@/components/views/dashboard"
import { CompaniesView } from "@/components/views/companies-view"
import { EventsView } from "@/components/views/events-view"
import { TimelineView } from "@/components/views/timeline-view"
import { CalendarView } from "@/components/views/calendar-view"
import { SettingsView } from "@/components/views/settings-view"
import { useRequireAuth } from "@/lib/use-require-auth"

const titles: Record<ViewKey, { en: string; ja: string }> = {
  dashboard: { en: "Dashboard", ja: "ダッシュボード" },
  companies: { en: "Companies", ja: "企業一覧" },
  events: { en: "Events", ja: "イベント" },
  timeline: { en: "Timeline", ja: "選考タイムライン" },
  calendar: { en: "Calendar", ja: "カレンダー" },
  settings: { en: "Settings", ja: "設定" },
}

export default function Page() {
  useRequireAuth()
  const [view, setView] = useState<ViewKey>("dashboard")

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar active={view} onChange={setView} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-border bg-background/80 px-5 py-4 backdrop-blur md:px-8">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground md:text-2xl">
              {titles[view].en}
            </h1>
            <p className="text-xs text-muted-foreground">{titles[view].ja}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground sm:flex">
              <Search className="h-4 w-4" />
              <input
                placeholder="検索 / Search…"
                className="w-32 bg-transparent text-foreground outline-none placeholder:text-muted-foreground lg:w-44"
              />
            </div>
            <button className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">追加</span>
            </button>
          </div>
        </header>

        <MobileNav active={view} onChange={setView} />

        <div className="flex min-h-0 flex-1">
          <main className="min-w-0 flex-1 overflow-y-auto px-5 py-6 md:px-8">
            {view === "dashboard" && <Dashboard onNavigate={setView} />}
            {view === "companies" && <CompaniesView />}
            {view === "events" && <EventsView />}
            {view === "timeline" && <TimelineView />}
            {view === "calendar" && <CalendarView />}
            {view === "settings" && <SettingsView />}
          </main>
          <RightPanel />
        </div>
      </div>
    </div>
  )
}
