"use client"

import Link from "next/link"
import { Mail } from "lucide-react"
import { AuthLayout } from "@/components/auth/auth-layout"
import { Button } from "@/components/ui/button"

export default function ForgotPasswordPage() {
  return (
    <AuthLayout
      title="Password reset"
      subtitle="Password reset is not available in this MVP."
      footer={
        <Link href="/auth/sign-in" className="font-medium text-accent hover:underline">
          Back to sign in
        </Link>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start gap-2 rounded-lg bg-accent/10 p-3 text-xs text-accent">
          <Mail className="mt-0.5 h-4 w-4 shrink-0" />
          <p>Coming soon. No reset email will be sent from this version.</p>
        </div>
        <Button type="button" size="lg" className="w-full" disabled>
          Send reset link
        </Button>
      </div>
    </AuthLayout>
  )
}
