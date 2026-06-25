"use client"

import { useState } from "react"
import { Bell, Globe, Palette, User, Info } from "lucide-react"

function Toggle({ defaultOn = false }: { defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn)
  return (
    <button
      onClick={() => setOn((v) => !v)}
      role="switch"
      aria-checked={on}
      className={`relative h-6 w-11 rounded-full transition-colors ${on ? "bg-primary" : "bg-muted-foreground/30"}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-background shadow transition-transform ${
          on ? "translate-x-[22px]" : "translate-x-0.5"
        }`}
      />
    </button>
  )
}

function Section({
  icon: Icon,
  title,
  ja,
  children,
}: {
  icon: React.ElementType
  title: string
  ja: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-5 py-4">
        <Icon className="h-4 w-4 text-accent" />
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground">{ja}</p>
        </div>
      </div>
      <div className="divide-y divide-border">{children}</div>
    </div>
  )
}

function Row({ label, ja, children }: { label: string; ja: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{ja}</p>
      </div>
      {children}
    </div>
  )
}

const meta = [
  { k: "Version", v: "v3.2 Pro" },
  { k: "作成日 / Created", v: "2026-06-16" },
  { k: "最終更新日 / Updated", v: "2026-06-25" },
  { k: "データ / Data", v: "20社 · 5イベント · 19インターン" },
]

export function SettingsView() {
  return (
    <div className="max-w-2xl space-y-4">
      <Section icon={User} title="Profile" ja="プロフィール">
        <Row label="表示名" ja="Display name">
          <input
            defaultValue="就活ユーザー"
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          />
        </Row>
        <Row label="卒業予定年" ja="Graduation year">
          <select className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring">
            <option>2027年卒</option>
            <option>2026年卒</option>
            <option>2028年卒</option>
          </select>
        </Row>
      </Section>

      <Section icon={Bell} title="Notifications" ja="通知設定">
        <Row label="ES締切リマインド" ja="ES deadline reminders">
          <Toggle defaultOn />
        </Row>
        <Row label="面接前日アラート" ja="Interview day-before alert">
          <Toggle defaultOn />
        </Row>
        <Row label="週次サマリー" ja="Weekly summary email">
          <Toggle />
        </Row>
      </Section>

      <Section icon={Palette} title="Appearance" ja="表示設定">
        <Row label="テーマ" ja="Theme">
          <select className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring">
            <option>Navy (Light)</option>
            <option>System</option>
          </select>
        </Row>
        <Row label="締切7日以内を強調" ja="Highlight deadlines ≤7d">
          <Toggle defaultOn />
        </Row>
      </Section>

      <Section icon={Globe} title="Language" ja="言語">
        <Row label="表示言語" ja="Interface language">
          <select className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring">
            <option>日本語 + English</option>
            <option>日本語</option>
            <option>English</option>
          </select>
        </Row>
      </Section>

      <Section icon={Info} title="System" ja="システム情報">
        {meta.map((m) => (
          <Row key={m.k} label={m.k} ja="">
            <span className="text-sm text-muted-foreground">{m.v}</span>
          </Row>
        ))}
      </Section>
    </div>
  )
}
