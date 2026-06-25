"use client"

import { useMemo, useState } from "react"
import { Filter } from "lucide-react"
import {
  companies,
  events,
  industryMeta,
  companyStatusMeta,
  daysUntil,
  formatDate,
  type Industry,
} from "@/lib/data"
import { StatusBadge, PriorityBadge, Stars } from "@/components/status-badge"

const industryTabs: { key: Industry | "all"; ja: string; en: string }[] = [
  { key: "all", ja: "すべて", en: "All" },
  { key: "maker", ja: "メーカー", en: "Maker" },
  { key: "finance", ja: "金融", en: "Finance" },
  { key: "consulting", ja: "コンサル", en: "Consulting" },
]

function nextEvent(companyId: string) {
  return [...events]
    .filter((e) => e.companyId === companyId && daysUntil(e.start) >= 0)
    .sort((a, b) => daysUntil(a.start) - daysUntil(b.start))[0]
}

export function CompaniesView() {
  const [tab, setTab] = useState<Industry | "all">("all")

  const rows = useMemo(
    () => (tab === "all" ? companies : companies.filter((c) => c.industry === tab)),
    [tab],
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {industryTabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === t.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground ring-1 ring-border hover:text-foreground"
              }`}
            >
              {t.ja}
              <span className="ml-1.5 text-xs opacity-60">
                {t.key === "all" ? companies.length : companies.filter((c) => c.industry === t.key).length}
              </span>
            </button>
          ))}
        </div>
        <button className="inline-flex items-center gap-1.5 rounded-lg bg-card px-3 py-1.5 text-sm text-muted-foreground ring-1 ring-border hover:text-foreground">
          <Filter className="h-4 w-4" />
          フィルター
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">企業名 / Company</th>
                <th className="px-4 py-3 font-medium">業界</th>
                <th className="px-4 py-3 font-medium">優先度</th>
                <th className="px-4 py-3 font-medium">重要度</th>
                <th className="px-4 py-3 font-medium">ステータス</th>
                <th className="px-4 py-3 font-medium">次の予定</th>
                <th className="px-4 py-3 font-medium">ES締切</th>
                <th className="px-4 py-3 font-medium">備考</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((c) => {
                const ev = nextEvent(c.id)
                const statusMeta = companyStatusMeta[c.status]
                const dueSoon = c.esDeadline && daysUntil(c.esDeadline) >= 0 && daysUntil(c.esDeadline) <= 7
                return (
                  <tr key={c.id} className="transition-colors hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <span className="font-medium text-foreground">{c.name}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{industryMeta[c.industry].ja}</td>
                    <td className="px-4 py-3">
                      <PriorityBadge priority={c.priority} />
                    </td>
                    <td className="px-4 py-3">
                      <Stars count={c.importance} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={statusMeta.tone}>{statusMeta.ja}</StatusBadge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {ev ? `${ev.title} (${formatDate(ev.start)})` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {c.esDeadline ? (
                        <span className={dueSoon ? "font-medium text-destructive" : "text-muted-foreground"}>
                          {formatDate(c.esDeadline)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 max-w-[200px] truncate text-muted-foreground" title={c.note}>
                      {c.note ?? "—"}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
