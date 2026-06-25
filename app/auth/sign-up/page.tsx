"use client"

import { useState } from "react"
import Link from "next/link"
import { Eye, EyeOff } from "lucide-react"
import { AuthLayout } from "@/components/auth/auth-layout"
import { AuthField } from "@/components/auth/auth-field"
import { Button } from "@/components/ui/button"

export default function SignUpPage() {
  const [showPw, setShowPw] = useState(false)

  return (
    <AuthLayout
      title="アカウント作成"
      subtitle="Create your account to start tracking"
      footer={
        <>
          既にアカウントをお持ちですか？{" "}
          <Link href="/auth/sign-in" className="font-medium text-accent hover:underline">
            サインイン
          </Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        <AuthField label="お名前" ja="Name" placeholder="就活 太郎" autoComplete="name" />
        <AuthField
          label="メールアドレス"
          ja="Email"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
        />
        <AuthField
          label="パスワード"
          ja="Password"
          type={showPw ? "text" : "password"}
          placeholder="8文字以上"
          autoComplete="new-password"
          rightSlot={
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showPw ? "パスワードを隠す" : "パスワードを表示"}
            >
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          }
        />
        <p className="text-xs text-muted-foreground">
          パスワードは8文字以上で、英数字を含めてください。
        </p>
        <label className="flex items-start gap-2 text-sm text-muted-foreground">
          <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-border accent-primary" />
          <span>
            <Link href="#" className="font-medium text-accent hover:underline">
              利用規約
            </Link>{" "}
            および{" "}
            <Link href="#" className="font-medium text-accent hover:underline">
              プライバシーポリシー
            </Link>{" "}
            に同意します
          </span>
        </label>
        <Button type="submit" size="lg" className="w-full">
          アカウントを作成
        </Button>
      </form>
    </AuthLayout>
  )
}
