"use client"

import Link from "next/link"
import { Shield } from "lucide-react"
import { AuthLayout } from "@/components/auth/auth-layout"
import { Button } from "@/components/ui/button"

export default function ResetPasswordPage() {
  return (
    <AuthLayout
      title="Set new password"
      subtitle="Password reset is not available in this MVP."
      footer={
        <Link href="/auth/sign-in" className="font-medium text-accent hover:underline">
          Back to sign in
        </Link>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start gap-2 rounded-lg bg-accent/10 p-3 text-xs text-accent">
          <Shield className="mt-0.5 h-4 w-4 shrink-0" />
          <p>Coming soon. Passwords cannot be changed from this page yet.</p>
        </div>
        <Button type="button" size="lg" className="w-full" disabled>
          Update password
        </Button>
      </div>
    </AuthLayout>
  )
}
