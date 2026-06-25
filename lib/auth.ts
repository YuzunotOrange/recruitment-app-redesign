const TOKEN_KEY = "mock-auth"
const API_BASE = ""

export type CurrentUser = {
  name: string
  email: string
  graduationYear: string
}

function getToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(TOKEN_KEY)
}

export function clearToken() {
  if (typeof window === "undefined") return
  localStorage.removeItem(TOKEN_KEY)
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = getToken()
  if (!token) return null

  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (res.status === 401) return null
  if (!res.ok) return null

  const data = await res.json().catch(() => null)
  if (!data) return null

  return {
    name: data.name ?? "",
    email: data.email ?? "",
    graduationYear: data.graduationYear ?? "",
  }
}

export async function logout(): Promise<void> {
  const token = getToken()
  if (!token) {
    clearToken()
    return
  }

  try {
    await fetch(`${API_BASE}/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    })
  } finally {
    clearToken()
  }
}
