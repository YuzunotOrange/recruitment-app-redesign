const DEFAULT_BACKEND_API_BASE_URL = "https://recruitment-app-redesign.onrender.com"

type RouteContext = {
  params: Promise<{ path?: string[] }> | { path?: string[] }
}

function getBackendApiBaseUrl() {
  const configured = process.env.BACKEND_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL
  return (configured ?? DEFAULT_BACKEND_API_BASE_URL).replace(/\/$/, "")
}

function copyRequestHeaders(request: Request) {
  const headers = new Headers(request.headers)
  headers.delete("host")
  headers.delete("content-length")
  return headers
}

function copyResponseHeaders(upstream: Response) {
  const headers = new Headers(upstream.headers)
  headers.delete("content-encoding")
  headers.delete("content-length")
  headers.delete("transfer-encoding")
  headers.delete("set-cookie")

  const cookieHeaders = (upstream.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ?? []
  for (const cookie of cookieHeaders) {
    headers.append("set-cookie", cookie)
  }

  const fallbackCookie = upstream.headers.get("set-cookie")
  if (cookieHeaders.length === 0 && fallbackCookie) {
    headers.append("set-cookie", fallbackCookie)
  }

  return headers
}

async function proxy(request: Request, context: RouteContext) {
  const params = await context.params
  const path = params.path?.join("/") ?? ""
  const incomingUrl = new URL(request.url)
  const targetUrl = new URL(getBackendApiBaseUrl() + "/" + path)
  targetUrl.search = incomingUrl.search

  const method = request.method.toUpperCase()
  const upstream = await fetch(targetUrl, {
    method,
    headers: copyRequestHeaders(request),
    body: method === "GET" || method === "HEAD" ? undefined : await request.arrayBuffer(),
    redirect: "manual",
  })

  return new Response(upstream.status === 204 || upstream.status === 304 ? null : upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: copyResponseHeaders(upstream),
  })
}

export async function GET(request: Request, context: RouteContext) {
  return proxy(request, context)
}

export async function POST(request: Request, context: RouteContext) {
  return proxy(request, context)
}

export async function PUT(request: Request, context: RouteContext) {
  return proxy(request, context)
}

export async function PATCH(request: Request, context: RouteContext) {
  return proxy(request, context)
}

export async function DELETE(request: Request, context: RouteContext) {
  return proxy(request, context)
}
