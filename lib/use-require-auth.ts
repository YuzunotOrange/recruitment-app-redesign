import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { isAuthed } from "@/lib/mock-auth"

export function useRequireAuth() {
  const router = useRouter()
  useEffect(() => {
    if (!isAuthed()) router.replace("/auth/sign-in")
  }, [router])
}
