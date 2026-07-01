"use client"

import { useEffect, useState } from "react"

export type ThemeMode = "light" | "dark" | "cyberpunk"

const THEME_KEY = "careertrack-theme"
const DEFAULT_THEME: ThemeMode = "light"

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "light" || value === "dark" || value === "cyberpunk"
}

export function applyThemePreference(theme: ThemeMode) {
  if (typeof document === "undefined") return

  const root = document.documentElement
  root.dataset.theme = theme
  root.classList.toggle("dark", theme === "dark" || theme === "cyberpunk")
}

export function getThemePreference(): ThemeMode {
  if (typeof window === "undefined") return DEFAULT_THEME

  const stored = window.localStorage.getItem(THEME_KEY)
  return isThemeMode(stored) ? stored : DEFAULT_THEME
}

export function setThemePreference(theme: ThemeMode) {
  if (typeof window === "undefined") return

  window.localStorage.setItem(THEME_KEY, theme)
  applyThemePreference(theme)
  window.dispatchEvent(new CustomEvent<ThemeMode>("careertrack:theme-change", { detail: theme }))
}

export function useThemePreference() {
  const [theme, setTheme] = useState<ThemeMode>(DEFAULT_THEME)

  useEffect(() => {
    const current = getThemePreference()
    setTheme(current)
    applyThemePreference(current)

    const handleThemeChange = (event: Event) => {
      const next = (event as CustomEvent<ThemeMode>).detail
      if (isThemeMode(next)) setTheme(next)
    }

    window.addEventListener("careertrack:theme-change", handleThemeChange)
    return () => window.removeEventListener("careertrack:theme-change", handleThemeChange)
  }, [])

  return theme
}
