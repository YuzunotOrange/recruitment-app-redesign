"use client"

import { useParams, useRouter } from "next/navigation"
import { CompanyNotebookView } from "@/components/views/company-notebook-view"
import { useRequireAuth } from "@/lib/use-require-auth"

export default function CompanyNotebookPage() {
  useRequireAuth()
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const companyId = Number(params.id)

  if (!Number.isFinite(companyId)) {
    return (
      <main className="min-h-screen bg-background p-6 text-foreground">
        <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Invalid company ID.
        </p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background px-4 py-6 md:px-8">
      <CompanyNotebookView companyId={companyId} onBack={() => router.push("/")} />
    </main>
  )
}
