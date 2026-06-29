const LOCAL_API_BASE_URL = "http://127.0.0.1:8000"
const PRODUCTION_API_BASE_URL = "https://recruitment-app-redesign.onrender.com"
const TOKEN_KEY = "access_token"

function getApiBaseUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL
  if (configuredUrl) return configuredUrl.replace(/\/$/, "")

  if (typeof window !== "undefined" && window.location.hostname.endsWith(".vercel.app")) {
    return PRODUCTION_API_BASE_URL
  }

  return LOCAL_API_BASE_URL
}

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

type ApiValidationError = {
  loc?: unknown[]
  msg?: string
}

export function getStoredAccessToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(TOKEN_KEY)
}

export function setStoredAccessToken(token: string) {
  if (typeof window === "undefined") return
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearStoredAccessToken() {
  if (typeof window === "undefined") return
  localStorage.removeItem(TOKEN_KEY)
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredAccessToken()
  const headers = new Headers(options.headers)

  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json")
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`)
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...options,
    headers,
  })

  if (response.status === 401) {
    clearStoredAccessToken()
  }

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`
    try {
      const body = await response.json()
      if (typeof body.detail === "string") message = body.detail
      else if (Array.isArray(body.detail)) {
        message = body.detail
          .map((item: ApiValidationError) => {
            const path = Array.isArray(item.loc) ? item.loc.join(".") : "request"
            return item.msg ? `${path}: ${item.msg}` : path
          })
          .join("; ")
      }
    } catch {
      // Keep the default message when the response is not JSON.
    }
    throw new ApiError(response.status, message)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}
