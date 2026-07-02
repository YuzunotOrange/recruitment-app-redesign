"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Eye, EyeOff } from "lucide-react"
import { AuthLayout } from "@/components/auth/auth-layout"
import { AuthField } from "@/components/auth/auth-field"
import { Button } from "@/components/ui/button"
import { getCurrentUserWithRetry, register } from "@/lib/auth"
import { copy, text, useLanguagePreference } from "@/lib/language"

export default function SignUpPage() {
  const router = useRouter()
  const language = useLanguagePreference()
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  return (
    <AuthLayout
      title={text(language, copy.signUp)}
      subtitle={text(language, copy.signUpSubtitle)}
      footer={
        <>
          {text(language, copy.haveAccount)}{" "}
          <Link href="/auth/sign-in" className="font-medium text-accent hover:underline">
            {text(language, copy.signIn)}
          </Link>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault()
          setError(null)
          setIsSubmitting(true)

          const form = new FormData(event.currentTarget)
          const name = String(form.get("name") ?? "")
          const email = String(form.get("email") ?? "")
          const password = String(form.get("password") ?? "")

          try {
            await register({ name, email, password, graduation_year: 2027 })
            await getCurrentUserWithRetry()
            router.replace("/")
          } catch (err) {
            setError(err instanceof Error ? err.message : "Sign up failed.")
          } finally {
            setIsSubmitting(false)
          }
        }}
      >
        <AuthField label="Name" ja="Name" name="name" placeholder="Yamada Taro" autoComplete="name" required />
        <AuthField label="Email" ja="Email" name="email" type="email" placeholder="you@example.com" autoComplete="email" required />
        <AuthField
          label="Password"
          ja="Password"
          name="password"
          type={showPw ? "text" : "password"}
          placeholder="letters and numbers"
          autoComplete="new-password"
          required
          rightSlot={
            <button
              type="button"
              onClick={() => setShowPw((value) => !value)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showPw ? "Hide password" : "Show password"}
            >
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          }
        />
        <p className="text-xs text-muted-foreground">{text(language, copy.passwordHint)}</p>
        <label className="flex items-start gap-2 text-sm text-muted-foreground">
          <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-border accent-primary" />
          <span>{text(language, copy.termsAgree)}</span>
        </label>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {text(language, copy.signUp)}
        </Button>
      </form>
    </AuthLayout>
  )
}
