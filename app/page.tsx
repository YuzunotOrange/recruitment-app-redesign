"use client"

import { useState } from "react"
import { Sidebar, MobileNav, type ViewKey } from "@/components/sidebar"
import { CyberTicker } from "@/components/cyber-ticker"
import { NotificationCenter } from "@/components/notification-center"
import { RightPanel } from "@/components/right-panel"
import { Dashboard } from "@/components/views/dashboard"
import { CompaniesView } from "@/components/views/companies-view"
import { EventsView } from "@/components/views/events-view"
import { TasksView } from "@/components/views/tasks-view"
import { StrategyView } from "@/components/views/strategy-view"
import { TimelineView } from "@/components/views/timeline-view"
import { CalendarView } from "@/components/views/calendar-view"
import { SettingsView } from "@/components/views/settings-view"
import { useRequireAuth } from "@/lib/use-require-auth"
import { copy, secondaryText, text, useLanguagePreference } from "@/lib/language"

const titles: Record<ViewKey, { en: string; ja: string }> = {
  dashboard: copy.dashboard,
  companies: copy.companies,
  events: copy.events,
  tasks: { en: "Tasks", ja: "タスク" },
  strategy: { en: "Strategy", ja: "応募戦略" },
  timeline: copy.timeline,
  calendar: copy.calendar,
  settings: copy.settings,
}

export default function Page() {
  useRequireAuth()
  const [view, setView] = useState<ViewKey>("dashboard")
  const language = useLanguagePreference()
  const secondaryTitle = secondaryText(language, titles[view])

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar active={view} onChange={setView} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur md:static md:px-8 md:py-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground md:text-2xl">{text(language, titles[view])}</h1>
            {secondaryTitle && <p className="text-xs text-muted-foreground">{secondaryTitle}</p>}
          </div>
          <NotificationCenter />
        </header>
        <CyberTicker />

        <div className="flex min-h-0 flex-1">
          <main className="min-w-0 flex-1 overflow-y-auto px-4 pb-28 pt-4 md:px-8 md:py-6">
            {view === "dashboard" && <Dashboard onNavigate={setView} />}
            {view === "companies" && <CompaniesView />}
            {view === "events" && <EventsView />}
            {view === "tasks" && <TasksView />}
            {view === "strategy" && <StrategyView />}
            {view === "timeline" && <TimelineView />}
            {view === "calendar" && <CalendarView />}
            {view === "settings" && <SettingsView />}
          </main>
          <RightPanel />
        </div>
        <MobileNav active={view} onChange={setView} />
      </div>
    </div>
  )
}
