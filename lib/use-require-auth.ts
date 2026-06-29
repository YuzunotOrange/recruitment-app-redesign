import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { getAccessToken, getCurrentUser } from "@/lib/auth"

export function useRequireAuth() {
  const router = useRouter()
  useEffect(() => {
    let cancelled = false

    async function verifyAuth() {
      if (!getAccessToken()) {
        router.replace("/auth/sign-in")
        return
      }

      try {
        await getCurrentUser()
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
