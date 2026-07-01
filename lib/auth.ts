import {
  apiRequest,
  clearStoredAccessToken,
  getStoredAccessToken,
  setStoredAccessToken,
} from "@/lib/api"
import { applyThemePreference, setThemePreference, type ThemeMode } from "@/lib/theme"

export interface User {
  id: number
  email: string
  name: string
  graduation_year: number | null
  theme?: ThemeMode
  created_at: string
  updated_at: string
}

export interface AuthResponse {
  access_token: string
  token_type: "bearer"
  user: User
}

export interface RegisterPayload {
  name: string
  email: string
  password: string
  graduation_year?: number | null
}

export interface LoginPayload {
  email: string
  password: string
}

export interface ChangePasswordPayload {
  current_password: string
  new_password: string
}

export async function register(payload: RegisterPayload): Promise<AuthResponse> {
  const response = await apiRequest<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  setStoredAccessToken(response.access_token)
  if (response.user.theme) setThemePreference(response.user.theme)
  return response
}

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const response = await apiRequest<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  setStoredAccessToken(response.access_token)
  if (response.user.theme) setThemePreference(response.user.theme)
  return response
}

export function logout() {
  clearStoredAccessToken()
}

export async function getCurrentUser(): Promise<User> {
  const user = await apiRequest<User>("/auth/me")
  if (user.theme) applyThemePreference(user.theme)
  return user
}

export async function updateUserTheme(theme: ThemeMode): Promise<User> {
  const user = await apiRequest<User>("/auth/me/theme", {
    method: "PATCH",
    body: JSON.stringify({ theme }),
  })
  if (user.theme) setThemePreference(user.theme)
  return user
}

export async function changePassword(payload: ChangePasswordPayload): Promise<{ message: string }> {
  return apiRequest<{ message: string }>("/auth/change-password", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function getAccessToken(): string | null {
  return getStoredAccessToken()
}
