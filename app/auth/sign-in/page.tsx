"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Eye, EyeOff } from "lucide-react"
import { AuthLayout } from "@/components/auth/auth-layout"
import { AuthField } from "@/components/auth/auth-field"
import { Button } from "@/components/ui/button"
import { signIn } from "@/lib/mock-auth"
import { getCurrentUserWithRetry } from "@/lib/auth"
import { copy, text, useLanguagePreference } from "@/lib/language"

export default function SignInPage() {
  const router = useRouter()
  const language = useLanguagePreference()
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  return (
    <AuthLayout
      title={text(language, copy.signIn)}
      subtitle={text(language, copy.signInSubtitle)}
      footer={
        <>
          {text(language, copy.noAccount)}{" "}
          <Link href="/auth/sign-up" className="font-medium text-accent hover:underline">
            {text(language, copy.createOne)}
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
          const email = String(form.get("email") ?? "")
          const password = String(form.get("password") ?? "")

          try {
            await signIn(email, password)
            await getCurrentUserWithRetry()
            router.replace("/")
          } catch (err) {
            setError(err instanceof Error ? err.message : "Sign in failed.")
          } finally {
            setIsSubmitting(false)
          }
        }}
      >
        <AuthField label="Email" ja="Email" name="email" type="email" placeholder="you@example.com" autoComplete="email" required />
        <AuthField
          label="Password"
          ja="Password"
          name="password"
          type={showPw ? "text" : "password"}
          placeholder="********"
          autoComplete="current-password"
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
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Secure cookie session</span>
          <Link href="/auth/forgot-password" className="text-sm font-medium text-accent hover:underline">
            {text(language, copy.forgotPassword)}
          </Link>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {text(language, copy.signIn)}
        </Button>
      </form>
    </AuthLayout>
  )
}
