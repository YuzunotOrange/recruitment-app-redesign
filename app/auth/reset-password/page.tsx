"use client"

import type { FormEvent } from "react"
import { useEffect, useState } from "react"
import Link from "next/link"
import { Shield } from "lucide-react"
import { AuthLayout } from "@/components/auth/auth-layout"
import { AuthField } from "@/components/auth/auth-field"
import { Button } from "@/components/ui/button"
import { confirmPasswordReset } from "@/lib/auth"
import { useHydrated } from "@/lib/use-hydrated"

export default function ResetPasswordPage() {
  const hydrated = useHydrated()
  const [initialToken, setInitialToken] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    setInitialToken(new URLSearchParams(window.location.search).get("token") ?? "")
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setMessage(null)
    setIsSubmitting(true)
    try {
      const form = new FormData(event.currentTarget)
      const token = String(form.get("token") ?? "")
      const new_password = String(form.get("new_password") ?? "")
      const response = await confirmPasswordReset({ token, new_password })
      setMessage(response.message)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Password reset failed.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Set new password"
      subtitle="Use your reset token and choose a stronger password."
      footer={
        <Link href="/auth/sign-in" className="font-medium text-accent hover:underline">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-start gap-2 rounded-lg bg-accent/10 p-3 text-xs text-accent">
          <Shield className="mt-0.5 h-4 w-4 shrink-0" />
          <p>Password must be at least 8 characters and include both letters and numbers.</p>
        </div>
        <AuthField key={initialToken || "empty-token"} label="Reset token" ja="Reset token" name="token" defaultValue={initialToken} required />
        <AuthField label="New password" ja="New password" name="new_password" type="password" autoComplete="new-password" required />
        {message && <p className="text-sm text-muted-foreground">{message}</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" size="lg" className="w-full" disabled={!hydrated || isSubmitting}>
          Update password
        </Button>
      </form>
    </AuthLayout>
  )
}
