"use client"

import { useEffect } from "react"
import { applyThemePreference, getThemePreference } from "@/lib/theme"

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    applyThemePreference(getThemePreference())
  }, [])

  return <>{children}</>
}
