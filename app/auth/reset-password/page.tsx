"use client"

import { useState } from "react"
import Link from "next/link"
import { Eye, EyeOff } from "lucide-react"
import { AuthLayout } from "@/components/auth/auth-layout"
import { AuthField } from "@/components/auth/auth-field"
import { Button } from "@/components/ui/button"

export default function ResetPasswordPage() {
  const [showPw, setShowPw] = useState(false)

  return (
    <AuthLayout
      title="新しいパスワード"
      subtitle="Set a new password for your account"
      footer={
        <Link href="/auth/sign-in" className="font-medium text-accent hover:underline">
          サインインに戻る
        </Link>
      }
    >
      <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        <AuthField
          label="新しいパスワード"
          ja="New password"
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
        <AuthField
          label="パスワード確認"
          ja="Confirm"
          type={showPw ? "text" : "password"}
          placeholder="もう一度入力"
          autoComplete="new-password"
        />
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">パスワード要件</p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            <li className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" /> 8文字以上
            </li>
            <li className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" /> 英字と数字を含む
            </li>
          </ul>
        </div>
        <Button type="submit" size="lg" className="w-full">
          パスワードを更新
        </Button>
      </form>
    </AuthLayout>
  )
}
