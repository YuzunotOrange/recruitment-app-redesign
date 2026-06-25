"use client"

import { useState } from "react"
import { Sidebar, MobileNav, type ViewKey } from "@/components/sidebar"
import { Button } from "@/components/ui/button"
import { Bell, Globe, Palette, User, Shield, LogOut, Camera } from "lucide-react"

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

const inputCls =
  "rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/40"

export default function ProfilePage() {
  const [view] = useState<ViewKey>("settings")

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar active={view} onChange={() => {}} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-border bg-background/80 px-5 py-4 backdrop-blur md:px-8">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground md:text-2xl">Profile</h1>
            <p className="text-xs text-muted-foreground">プロフィール</p>
          </div>
          <Button variant="outline" size="lg">
            <LogOut className="h-4 w-4" />
            サインアウト
          </Button>
        </header>

        <MobileNav active={view} onChange={() => {}} />

        <main className="min-w-0 flex-1 overflow-y-auto px-5 py-6 md:px-8">
          <div className="mx-auto max-w-2xl space-y-5">
            {/* Avatar + identity */}
            <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5">
              <div className="relative">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-xl font-semibold text-primary">
                  就
                </div>
                <button
                  className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground"
                  aria-label="プロフィール画像を変更"
                >
                  <Camera className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="min-w-0">
                <p className="text-base font-semibold text-foreground">就活 太郎</p>
                <p className="truncate text-sm text-muted-foreground">taro@example.com</p>
                <p className="mt-1 text-xs text-muted-foreground">2027年卒 · 選考フェーズ進行中</p>
              </div>
            </div>

            <Section icon={User} title="Profile" ja="プロフィール">
              <Row label="表示名" ja="Display name">
                <input defaultValue="就活 太郎" className={inputCls} />
              </Row>
              <Row label="メールアドレス" ja="Email">
                <input defaultValue="taro@example.com" className={inputCls} />
              </Row>
              <Row label="卒業予定年" ja="Graduation year">
                <select className={inputCls}>
                  <option>2027年卒</option>
                  <option>2026年卒</option>
                  <option>2028年卒</option>
                </select>
              </Row>
            </Section>

            <Section icon={Shield} title="Password" ja="パスワード">
              <Row label="現在のパスワード" ja="Current password">
                <input type="password" placeholder="••••••••" className={inputCls} />
              </Row>
              <Row label="新しいパスワード" ja="New password">
                <input type="password" placeholder="8文字以上" className={inputCls} />
              </Row>
              <div className="flex justify-end px-5 py-3.5">
                <Button size="sm">パスワードを変更</Button>
              </div>
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
                <select className={inputCls}>
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
                <select className={inputCls}>
                  <option>日本語 + English</option>
                  <option>日本語</option>
                  <option>English</option>
                </select>
              </Row>
            </Section>

            <div className="flex justify-end gap-2 pb-4">
              <Button variant="ghost" size="lg">
                キャンセル
              </Button>
              <Button size="lg">変更を保存</Button>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
