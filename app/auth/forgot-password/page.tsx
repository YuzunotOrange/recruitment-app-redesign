"use client"

import type { FormEvent } from "react"
import { useState } from "react"
import Link from "next/link"
import { Mail } from "lucide-react"
import { AuthLayout } from "@/components/auth/auth-layout"
import { AuthField } from "@/components/auth/auth-field"
import { Button } from "@/components/ui/button"
import { requestPasswordReset } from "@/lib/auth"
import { useHydrated } from "@/lib/use-hydrated"

export default function ForgotPasswordPage() {
  const hydrated = useHydrated()
  const [message, setMessage] = useState<string | null>(null)
  const [resetToken, setResetToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setMessage(null)
    setResetToken(null)
    setIsSubmitting(true)
    try {
      const form = new FormData(event.currentTarget)
      const email = String(form.get("email") ?? "")
      const response = await requestPasswordReset({ email })
      setMessage(response.message)
      if (response.reset_token) setResetToken(response.reset_token)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Password reset request failed.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Password reset"
      subtitle="Request a secure reset link for your account."
      footer={
        <Link href="/auth/sign-in" className="font-medium text-accent hover:underline">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-start gap-2 rounded-lg bg-accent/10 p-3 text-xs text-accent">
          <Mail className="mt-0.5 h-4 w-4 shrink-0" />
          <p>If the email exists, a reset token will be issued. Email delivery can be connected later.</p>
        </div>
        <AuthField label="Email" ja="Email" name="email" type="email" placeholder="you@example.com" autoComplete="email" required />
        {message && <p className="text-sm text-muted-foreground">{message}</p>}
        {resetToken && (
          <div className="rounded-lg border border-border bg-muted p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Development reset token</p>
            <p className="mt-1 break-all font-mono">{resetToken}</p>
            <Link href={"/auth/reset-password?token=" + encodeURIComponent(resetToken)} className="mt-2 inline-block font-medium text-accent hover:underline">
              Open reset form
            </Link>
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" size="lg" className="w-full" disabled={!hydrated || isSubmitting}>
          Send reset link
        </Button>
      </form>
    </AuthLayout>
  )
}
