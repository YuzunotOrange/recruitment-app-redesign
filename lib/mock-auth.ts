import { login, logout } from "@/lib/auth"

export function isAuthed(): boolean {
  return true
}

export async function signIn(email: string, password: string) {
  return login({ email, password })
}

export async function signOut() {
  await logout()
}
