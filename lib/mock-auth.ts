const KEY = "mock-auth"

export function isAuthed(): boolean {
  if (typeof window === "undefined") return false
  return localStorage.getItem(KEY) === "1"
}

export function signIn() {
  if (typeof window === "undefined") return
  localStorage.setItem(KEY, "1")
}

export function signOut() {
  if (typeof window === "undefined") return
  localStorage.removeItem(KEY)
}
