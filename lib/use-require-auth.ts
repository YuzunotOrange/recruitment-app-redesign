import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { getCurrentUserWithRetry } from "@/lib/auth"

export function useRequireAuth() {
  const router = useRouter()
  useEffect(() => {
    let cancelled = false

    async function verifyAuth() {
      try {
        await getCurrentUserWithRetry()
      } catch {
        if (!cancelled) router.replace("/auth/sign-in")
      }
    }

    verifyAuth()

    return () => {
      cancelled = true
    }
  }, [router])
}
