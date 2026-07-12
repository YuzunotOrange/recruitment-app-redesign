"use client"

import { useEffect, useState } from "react"

// Guards submit buttons against firing a native GET form submission before React
// hydration attaches the onSubmit handler (which would leak form fields into the URL).
export function useHydrated() {
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setHydrated(true)
  }, [])

  return hydrated
}
