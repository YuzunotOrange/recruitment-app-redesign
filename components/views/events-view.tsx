"use client"

import { useState } from "react"
import { CalendarClock, GraduationCap } from "lucide-react"
import {
  events,
  internships,
  companyName,
  formatDate,
  daysUntil,
  internStatusMeta,
} from "@/lib/data"
import { StatusBadge, PriorityBadge } from "@/components/status-badge"

const eventTypeMeta: Record<string, { ja: string; tone: "info" | "warning" | "danger" | "neutral" | "success" }> = {
  briefing: { ja: "説明会", tone: "info" },
  interview: { ja: "面接", tone: "info" },
  test: { ja: "選考", tone: "warning" },
  deadline: { ja: "締切", tone: "danger" },
  intern: { ja: "インターン", tone: "success" },
}

function EventsTab() {
  const sorted = [...events].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left text-xs text-muted-foreground">
              <th className="px-4 py-3 font-medium">企業名</th>
              <th className="px-4 py-3 font-medium">イベント</th>
              <th className="px-4 py-3 font-medium">開始日</th>
              <th className="px-4 py-3 font-medium">終了日</th>
              <th className="px-4 py-3 font-medium">開始時刻</th>
              <th className="px-4 py-3 font-medium">残り</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sorted.map((e) => {
              const meta = eventTypeMeta[e.type]
              const d = daysUntil(e.start)
              return (
                <tr key={e.id} className="transition-colors hover:bg-muted/40">
                  <td className="px-4 py-3 font-medium text-foreground">{companyName(e.companyId)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge tone={meta.tone}>{e.title}</StatusBadge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(e.start)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(e.end)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{e.time ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={d <= 7 ? "font-medium text-destructive" : "text-muted-foreground"}>
                      {d < 0 ? "終了" : d === 0 ? "本日" : `${d}日`}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function InternTab() {
  const sorted = [...internships].sort((a, b) => a.rank - b.rank || a.start.localeCompare(b.start))
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left text-xs text-muted-foreground">
              <th className="px-4 py-3 font-medium">順位</th>
              <th className="px-4 py-3 font-medium">プログラム名</th>
              <th className="px-4 py-3 font-medium">企業名</th>
              <th className="px-4 py-3 font-medium">優先度</th>
              <th className="px-4 py-3 font-medium">ステータス</th>
              <th className="px-4 py-3 font-medium">日程</th>
              <th className="px-4 py-3 font-medium">備考</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sorted.map((i) => {
              const meta = internStatusMeta[i.status]
              return (
                <tr key={i.id} className="transition-colors hover:bg-muted/40">
                  <td className="px-4 py-3">
                    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-muted px-1.5 text-xs font-semibold text-foreground">
                      {i.rank}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">{i.program}</td>
                  <td className="px-4 py-3 text-muted-foreground">{companyName(i.companyId)}</td>
                  <td className="px-4 py-3">
                    <PriorityBadge priority={i.priority} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge tone={meta.tone}>{meta.ja}</StatusBadge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground tabular-nums">
                    {formatDate(i.start)} – {formatDate(i.end)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{i.note ?? "—"}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function EventsView() {
  const [tab, setTab] = useState<"events" | "intern">("events")
  return (
    <div className="space-y-4">
      <div className="flex gap-1.5">
        <button
          onClick={() => setTab("events")}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            tab === "events"
              ? "bg-primary text-primary-foreground"
              : "bg-card text-muted-foreground ring-1 ring-border hover:text-foreground"
          }`}
        >
          <CalendarClock className="h-4 w-4" />
          選考イベント
        </button>
        <button
          onClick={() => setTab("intern")}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            tab === "intern"
              ? "bg-primary text-primary-foreground"
              : "bg-card text-muted-foreground ring-1 ring-border hover:text-foreground"
          }`}
        >
          <GraduationCap className="h-4 w-4" />
          インターン
        </button>
      </div>
      {tab === "events" ? <EventsTab /> : <InternTab />}
    </div>
  )
}
