"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Eye, EyeOff } from "lucide-react"
import { AuthLayout } from "@/components/auth/auth-layout"
import { AuthField } from "@/components/auth/auth-field"
import { Button } from "@/components/ui/button"
import { signIn } from "@/lib/mock-auth"

export default function SignInPage() {
  const router = useRouter()
  const [showPw, setShowPw] = useState(false)

  return (
    <AuthLayout
      title="サインイン"
      subtitle="Sign in to your account to continue"
      footer={
        <>
          アカウントをお持ちでないですか？{" "}
          <Link href="/auth/sign-up" className="font-medium text-accent hover:underline">
            新規登録
          </Link>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          signIn()
          router.push("/")
        }}
      >
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
          placeholder="••••••••"
          autoComplete="current-password"
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
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" className="h-4 w-4 rounded border-border accent-primary" />
            ログイン状態を保持
          </label>
          <Link href="/auth/forgot-password" className="text-sm font-medium text-accent hover:underline">
            パスワードをお忘れですか？
          </Link>
        </div>
        <Button type="submit" size="lg" className="w-full">
          サインイン
        </Button>
      </form>
    </AuthLayout>
  )
}
