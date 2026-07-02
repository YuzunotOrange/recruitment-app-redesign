const LOCAL_API_BASE_URL = "http://127.0.0.1:8000"
const PRODUCTION_API_BASE_URL = "https://recruitment-app-redesign.onrender.com"

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
  return null
}

export function setStoredAccessToken(_token: string) {
  clearStoredAccessToken()
}

export function clearStoredAccessToken() {
  if (typeof window === "undefined") return
  localStorage.removeItem("access_token")
}

async function parseErrorMessage(response: Response) {
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
  return message
}

async function rawRequest(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers)
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json")
  }

  return fetch(`${getApiBaseUrl()}${path}`, {
    ...options,
    credentials: "include",
    headers,
  })
}

export async function apiRequest<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  let response = await rawRequest(path, options)

  if (response.status === 401 && retry && path !== "/auth/login" && path !== "/auth/register" && path !== "/auth/refresh") {
    const refreshed = await rawRequest("/auth/refresh", { method: "POST" })
    if (refreshed.ok) response = await rawRequest(path, options)
    else clearStoredAccessToken()
  }

  if (!response.ok) {
    throw new ApiError(response.status, await parseErrorMessage(response))
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}
