import {
  apiRequest,
  clearStoredAccessToken,
  getStoredAccessToken,
  setStoredAccessToken,
} from "@/lib/api"

export interface User {
  id: number
  email: string
  name: string
  graduation_year: number | null
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
  return response
}

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const response = await apiRequest<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  setStoredAccessToken(response.access_token)
  return response
}

export function logout() {
  clearStoredAccessToken()
}

export async function getCurrentUser(): Promise<User> {
  return apiRequest<User>("/auth/me")
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
