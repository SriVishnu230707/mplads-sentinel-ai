// Keep the frontend and API on the same site in development so the HttpOnly
// refresh cookie survives reloads under modern third-party-cookie policies.
const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1'
const REQUEST_TIMEOUT_MS = 10_000

export type ApiUser = {
  id: string
  email: string
  full_name: string
  role: 'ministry' | 'state' | 'district' | 'auditor' | 'field_officer' | 'mp'
  organization: { id: string; name: string; level: string; state: string | null; district: string | null }
}

export type ApiProject = {
  id: string
  title: string
  state: string
  district: string
  location: string
  category: string
  agency: string
  vendor_name: string | null
  sanctioned_lakh: number
  spent_lakh: number
  physical_progress: number
  risk_score: number
  risk_level: 'Critical' | 'High' | 'Moderate' | 'Low'
  risk_reasons: Array<{ label: string; explanation: string }>
  updated_at: string
  latitude: number | null
  longitude: number | null
}

let accessToken: string | null = null

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(init.headers)
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
  if (init.body) headers.set('Content-Type', 'application/json')
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers,
      credentials: 'include',
      signal: init.signal ?? controller.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('The Sentinel API did not respond in time. Please try again.')
    }
    throw new Error('Unable to reach the Sentinel API. Confirm that the API server is running.')
  } finally {
    window.clearTimeout(timeout)
  }
  if (response.status === 401 && retry && path !== '/auth/login' && path !== '/auth/refresh') {
    const restored = await api.restoreSession()
    if (restored) return request<T>(path, init, false)
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ detail: 'Unable to reach the Sentinel API' }))
    throw new Error(payload.detail ?? 'Request failed')
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export const api = {
  async login(email: string, password: string): Promise<ApiUser> {
    const token = await request<{ access_token: string }>('/auth/login', {
      method: 'POST', body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
    }, false)
    accessToken = token.access_token
    return request<ApiUser>('/auth/me')
  },

  async restoreSession(): Promise<boolean> {
    try {
      const token = await request<{ access_token: string }>('/auth/refresh', { method: 'POST' }, false)
      accessToken = token.access_token
      return true
    } catch {
      accessToken = null
      return false
    }
  },

  me: () => request<ApiUser>('/auth/me'),
  projects: () => request<ApiProject[]>('/projects'),
  scan: () => request<{ projects_scanned: number; alerts_created: number; scores_updated: number }>('/risk/scan', { method: 'POST' }),

  async logout(): Promise<void> {
    try { await request<void>('/auth/logout', { method: 'POST' }, false) } finally { accessToken = null }
  },
}
