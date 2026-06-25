"use client"

import Link from "next/link"
import { Mail } from "lucide-react"
import { AuthLayout } from "@/components/auth/auth-layout"
import { AuthField } from "@/components/auth/auth-field"
import { Button } from "@/components/ui/button"

export default function ForgotPasswordPage() {
  return (
    <AuthLayout
      title="パスワードリセット"
      subtitle="Enter your email to receive a reset link"
      footer={
        <Link href="/auth/sign-in" className="font-medium text-accent hover:underline">
          サインインに戻る
        </Link>
      }
    >
      <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        <AuthField
          label="メールアドレス"
          ja="Email"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
        />
        <div className="flex items-start gap-2 rounded-lg bg-accent/10 p-3 text-xs text-accent">
          <Mail className="mt-0.5 h-4 w-4 shrink-0" />
          <p>入力したアドレスにリセット用リンクを送信します。メールボックスをご確認ください。</p>
        </div>
        <Button type="submit" size="lg" className="w-full">
          リセットリンクを送信
        </Button>
      </form>
    </AuthLayout>
  )
}
