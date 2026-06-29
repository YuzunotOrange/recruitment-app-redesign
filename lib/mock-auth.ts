import { getAccessToken, login, logout } from "@/lib/auth"

export function isAuthed(): boolean {
  return Boolean(getAccessToken())
}

export async function signIn(email: string, password: string) {
  return login({ email, password })
}

export function signOut() {
  logout()
}
