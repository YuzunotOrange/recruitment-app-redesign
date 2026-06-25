"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react"

/* ----------------------------- Types ----------------------------- */

export type User = {
  name: string
  email: string
}

type Theme = "light" | "dark"

type AppContextValue = {
  /* auth (UI-only, no backend) */
  user: User | null
  isAuthenticated: boolean
  ready: boolean
  signIn: (user?: Partial<User>) => void
  signOut: () => void
  updateUser: (patch: Partial<User>) => void
  /* theme */
  theme: Theme
  toggleTheme: () => void
  setTheme: (t: Theme) => void
}

const AppContext = createContext<AppContextValue | null>(null)

const AUTH_KEY = "ct_auth_user"
const THEME_KEY = "ct_theme"

const DEFAULT_USER: User = {
  name: "佐藤 結衣",
  email: "yui.sato@example.com",
}

/* ----------------------------- Provider ----------------------------- */

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [theme, setThemeState] = useState<Theme>("light")
  const [ready, setReady] = useState(false)

  /* hydrate from localStorage */
  useEffect(() => {
    try {
      const rawUser = localStorage.getItem(AUTH_KEY)
      if (rawUser) setUser(JSON.parse(rawUser))

      const storedTheme = localStorage.getItem(THEME_KEY) as Theme | null
      const initial =
        storedTheme ??
        (window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light")
      setThemeState(initial)
    } catch {
      /* ignore */
    }
    setReady(true)
  }, [])

  /* apply theme class */
  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle("dark", theme === "dark")
    root.style.colorScheme = theme
  }, [theme])

  const signIn = useCallback((patch?: Partial<User>) => {
    const next: User = { ...DEFAULT_USER, ...patch }
    setUser(next)
    try {
      localStorage.setItem(AUTH_KEY, JSON.stringify(next))
    } catch {
      /* ignore */
    }
  }, [])

  const signOut = useCallback(() => {
    setUser(null)
    try {
      localStorage.removeItem(AUTH_KEY)
    } catch {
      /* ignore */
    }
  }, [])

  const updateUser = useCallback((patch: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev
      const next = { ...prev, ...patch }
      try {
        localStorage.setItem(AUTH_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
    try {
      localStorage.setItem(THEME_KEY, t)
    } catch {
      /* ignore */
    }
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark")
  }, [theme, setTheme])

  return (
    <AppContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        ready,
        signIn,
        signOut,
        updateUser,
        theme,
        toggleTheme,
        setTheme,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error("useApp must be used within AppProvider")
  return ctx
}
