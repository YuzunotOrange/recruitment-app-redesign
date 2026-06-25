"use client"

import { useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useApp } from "@/lib/app-provider"
import {
  AuthShell,
  Field,
  PasswordField,
  PrimaryButton,
  SocialButtons,
  Divider,
} from "@/components/auth/auth-ui"

export default function SignInPage() {
  const router = useRouter()
  const { signIn, isAuthenticated, ready } = useApp()

  useEffect(() => {
    if (ready && isAuthenticated) router.replace("/")
  }, [ready, isAuthenticated, router])

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    const email = String(data.get("email") || "")
    signIn(email ? { email } : undefined)
    router.replace("/")
  }

  return (
    <AuthShell
      title="Sign in"
      subtitle="おかえりなさい。アカウントにサインインしてください。"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field
          label="Email / メールアドレス"
          id="email"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          required
        />
        <div className="space-y-1.5">
          <PasswordField
            label="Password / パスワード"
            id="password"
            autoComplete="current-password"
          />
          <div className="flex justify-end">
            <Link
              href="/auth/forgot-password"
              className="text-xs font-medium text-accent hover:underline"
            >
              Forgot password? / パスワードを忘れた方
            </Link>
          </div>
        </div>

        <PrimaryButton>Sign In / サインイン</PrimaryButton>
      </form>

      <div className="my-5">
        <Divider label="or continue with" />
      </div>
      <SocialButtons />

      <p className="mt-7 text-center text-sm text-muted-foreground">
        {"Don't have an account? / アカウントをお持ちでない方　"}
        <Link
          href="/auth/sign-up"
          className="font-medium text-accent hover:underline"
        >
          Create an account
        </Link>
      </p>
    </AuthShell>
  )
}
