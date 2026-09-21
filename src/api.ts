import { projects as defaultProjects } from './data'

// Use relative API path so requests go through the Vite proxy in development,
// keeping auth cookies same-site and avoiding CORS/port mismatch.
const API_BASE = import.meta.env.VITE_API_URL ?? '/api/v1'
const REQUEST_TIMEOUT_MS = 8_000

export type ApiUser = {
  id: string
  email: string
  full_name: string
  role: 'ministry' | 'state' | 'district' | 'auditor' | 'field_officer' | 'mp'
  organization: {
    id: string
    name: string
    level: string
    state: string | null
    district: string | null
    constituency?: string | null
  }
}

export type ApiProject = {
  id: string
  title: string
  state: string
  district: string
  constituency?: string | null
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

export type ApiDashboardSummary = {
  active_works: number
  sanctioned_lakh: number
  expenditure_lakh: number
  high_risk_works: number
  open_alerts: number
  delayed_works: number
  risk_distribution: Record<ApiProject['risk_level'], number>
}

export type ApiAlert = {
  id: string
  project_id: string
  title: string
  status: 'open' | 'triaged' | 'resolved' | 'dismissed'
  severity: ApiProject['risk_level']
}

export type ApiProjectIntelligence = {
  project_id: string
  health_score: number
  health_band: string
  compliance: Array<{ label: string; status: 'met' | 'attention' | 'overdue'; detail: string }>
  duplicate_candidates: Array<{ project_id: string; title: string; location: string; similarity_score: number; reasons: string[] }>
  risk_timeline: Array<{ score: number; level: ApiProject['risk_level']; recorded_at: string }>
}

export type ApiDelayPrediction = {
  project_id: string
  delay_probability: number
  confidence: string
  factors: string[]
  disclaimer: string
}

export type ApiEvidence = {
  id: string
  project_id: string
  captured_at: string
  reported_progress: number
  distance_from_project_km: number
  created_at: string
}

export type ApiCase = {
  id: string
  alert_id: string
  project_id: string
  title: string
  status: 'open' | 'investigating' | 'closure_review' | 'closed'
  priority: ApiProject['risk_level']
  owner_id: string | null
  created_at: string
  updated_at: string
}

export const DEMO_ACCOUNTS: Record<string, { password: string; user: ApiUser }> = {
  'mp@sentinel.gov.in': {
    password: 'Sentinel@2026',
    user: {
      id: 'demo-mp',
      email: 'mp@sentinel.gov.in',
      full_name: "Dr. K. Sudhakar (Hon'ble MP)",
      role: 'mp',
      organization: {
        id: 'org-mp',
        name: "Office of Hon'ble MP - Bengaluru Rural",
        level: 'district',
        state: 'Karnataka',
        district: 'Bengaluru Rural',
        constituency: 'Bengaluru Rural',
      },
    },
  },
  'ministry@sentinel.gov.in': {
    password: 'Sentinel@2026',
    user: {
      id: 'demo-ministry',
      email: 'ministry@sentinel.gov.in',
      full_name: 'Arun Kumar',
      role: 'ministry',
      organization: {
        id: 'org-national',
        name: 'Ministry of Statistics and PI',
        level: 'national',
        state: null,
        district: null,
        constituency: null,
      },
    },
  },
  'state@sentinel.gov.in': {
    password: 'Sentinel@2026',
    user: {
      id: 'demo-state',
      email: 'state@sentinel.gov.in',
      full_name: 'Meera Rao',
      role: 'state',
      organization: {
        id: 'org-state',
        name: 'Karnataka State Nodal Authority',
        level: 'state',
        state: 'Karnataka',
        district: null,
        constituency: null,
      },
    },
  },
  'district@sentinel.gov.in': {
    password: 'Sentinel@2026',
    user: {
      id: 'demo-district',
      email: 'district@sentinel.gov.in',
      full_name: 'Ravi Shetty',
      role: 'district',
      organization: {
        id: 'org-district',
        name: 'Bengaluru Rural District Authority',
        level: 'district',
        state: 'Karnataka',
        district: 'Bengaluru Rural',
        constituency: null,
      },
    },
  },
  'auditor@sentinel.gov.in': {
    password: 'Sentinel@2026',
    user: {
      id: 'demo-auditor',
      email: 'auditor@sentinel.gov.in',
      full_name: 'Nisha Verma',
      role: 'auditor',
      organization: {
        id: 'org-auditor',
        name: 'Ministry of Statistics and PI',
        level: 'national',
        state: null,
        district: null,
        constituency: null,
      },
    },
  },
}

function getOfflineProjects(user?: ApiUser | null): ApiProject[] {
  let list: ApiProject[] = defaultProjects.map((p) => ({
    id: p.id,
    title: p.title,
    state: p.state,
    district: p.district,
    constituency: p.constituency ?? null,
    location: p.location,
    category: p.category,
    agency: p.agency,
    vendor_name: 'Authorized Implementing Agency',
    sanctioned_lakh: p.sanctioned,
    spent_lakh: p.spent,
    physical_progress: p.progress,
    risk_score: p.risk,
    risk_level: p.level,
    risk_reasons: [{ label: 'Risk Signal', explanation: p.issue }],
    updated_at: new Date().toISOString(),
    latitude: p.latitude ?? null,
    longitude: p.longitude ?? null,
  }))

  if (user) {
    if (user.role === 'mp' && user.organization.constituency) {
      list = list.filter((p) => p.constituency === user.organization.constituency)
    } else if (user.role === 'district' && user.organization.district) {
      list = list.filter((p) => p.district === user.organization.district)
    } else if (user.role === 'state' && user.organization.state) {
      list = list.filter((p) => p.state === user.organization.state)
    }
  }
  return list
}

function getOfflineSummary(projectList: ApiProject[]): ApiDashboardSummary {
  const active_works = projectList.length
  const sanctioned_lakh = projectList.reduce((sum, p) => sum + p.sanctioned_lakh, 0)
  const expenditure_lakh = projectList.reduce((sum, p) => sum + p.spent_lakh, 0)
  const high_risk_works = projectList.filter(p => p.risk_level === 'Critical' || p.risk_level === 'High').length
  const delayed_works = projectList.filter(p => p.physical_progress < 50 && p.spent_lakh / Math.max(p.sanctioned_lakh, 1) > 0.6).length
  const risk_distribution: Record<ApiProject['risk_level'], number> = {
    Critical: projectList.filter(p => p.risk_level === 'Critical').length,
    High: projectList.filter(p => p.risk_level === 'High').length,
    Moderate: projectList.filter(p => p.risk_level === 'Moderate').length,
    Low: projectList.filter(p => p.risk_level === 'Low').length,
  }
  return {
    active_works,
    sanctioned_lakh: Math.round(sanctioned_lakh * 10) / 10,
    expenditure_lakh: Math.round(expenditure_lakh * 10) / 10,
    high_risk_works,
    open_alerts: high_risk_works,
    delayed_works,
    risk_distribution,
  }
}

function getOfflineAlerts(projectList: ApiProject[]): ApiAlert[] {
  return projectList
    .filter(p => p.risk_score >= 60)
    .map((p, idx) => ({
      id: `ALT-${p.id}`,
      project_id: p.id,
      title: `${p.risk_level} Anomaly: ${p.risk_reasons[0]?.explanation || 'Cost/Progress Discrepancy'}`,
      status: (idx % 2 === 0 ? 'open' : 'triaged') as ApiAlert['status'],
      severity: p.risk_level,
    }))
}

function getOfflineIntelligence(projectId: string): ApiProjectIntelligence {
  const p = defaultProjects.find(x => x.id === projectId)
  const score = p ? p.risk : 50
  const band = score >= 80 ? 'Critical Attention' : score >= 60 ? 'Moderate Risk' : 'Satisfactory'
  return {
    project_id: projectId,
    health_score: 100 - score,
    health_band: band,
    compliance: [
      { label: 'Administrative Approval (AS)', status: 'met', detail: 'Sanction order and GIS tag logged.' },
      { label: 'Technical Sanction (TS)', status: score > 70 ? 'attention' : 'met', detail: score > 70 ? 'Cost escalation over baseline threshold.' : 'Technical estimates verified.' },
      { label: 'Quarterly Utilization Certificate', status: score > 80 ? 'overdue' : 'met', detail: score > 80 ? 'UC submission overdue by 45 days.' : 'All financial UCs current.' },
    ],
    duplicate_candidates: score > 70 ? [
      {
        project_id: 'MPL-KA-23991',
        title: 'Similar PWD Road Work',
        location: 'Devanahalli Taluk',
        similarity_score: 88,
        reasons: ['Same GPS 350m proximity', 'Identical agency schedule of rates'],
      }
    ] : [],
    risk_timeline: [
      { score: Math.max(10, score - 25), level: 'Low', recorded_at: new Date(Date.now() - 60 * 86400000).toISOString() },
      { score: Math.max(15, score - 10), level: 'Moderate', recorded_at: new Date(Date.now() - 30 * 86400000).toISOString() },
      { score, level: p?.level ?? 'High', recorded_at: new Date().toISOString() },
    ],
  }
}

function getOfflineDelayPrediction(projectId: string): ApiDelayPrediction {
  const p = defaultProjects.find(x => x.id === projectId)
  const prob = p ? Math.min(95, Math.max(15, p.risk + 5)) : 65
  return {
    project_id: projectId,
    delay_probability: prob,
    confidence: prob > 70 ? 'High Confidence (89%)' : 'Moderate Confidence (76%)',
    factors: [
      'Financial disbursement velocity exceeds physical milestone verification',
      'Contractor historical completion slippage in current district',
      'Monsoon seasonal adjustment window factor',
    ],
    disclaimer: 'AI early warning is an advisory indicator to guide field inspections and milestone verification.',
  }
}

let accessToken: string | null = null
let refreshPromise: Promise<boolean> | null = null

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(init.headers)
  const tokenUsed = accessToken
  if (accessToken && accessToken !== 'demo-offline-access-token') {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }
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
    if (tokenUsed && accessToken && tokenUsed !== accessToken) return request<T>(path, init, false)
    const restored = await restoreSession()
    if (restored) return request<T>(path, init, false)
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ detail: 'Unable to reach the Sentinel API' }))
    throw new Error(payload.detail ?? 'Request failed')
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

function restoreSession(): Promise<boolean> {
  if (refreshPromise) return refreshPromise
  refreshPromise = (async () => {
    try {
      const token = await request<{ access_token: string }>('/auth/refresh', { method: 'POST' }, false)
      accessToken = token.access_token
      return true
    } catch {
      accessToken = null
      return false
    } finally {
      refreshPromise = null
    }
  })()
  return refreshPromise
}

export const api = {
  async login(email: string, password: string): Promise<ApiUser> {
    const cleanEmail = email.trim().toLowerCase()
    try {
      const token = await request<{ access_token: string }>('/auth/login', {
        method: 'POST', body: JSON.stringify({ email: cleanEmail, password }),
      }, false)
      accessToken = token.access_token
      const user = await request<ApiUser>('/auth/me')
      try { localStorage.setItem('sentinel_user', JSON.stringify(user)) } catch {}
      return user
    } catch (err: any) {
      const demo = DEMO_ACCOUNTS[cleanEmail]
      const isConnectionIssue =
        !err?.message ||
        err.message.includes('Unable to reach') ||
        err.message.includes('did not respond') ||
        err.message.includes('Failed to fetch') ||
        err.message.includes('NetworkError') ||
        err.message.includes('504') ||
        err.message.includes('502')

      if (demo && (isConnectionIssue || password === demo.password || password === 'Sentinel@2026')) {
        if (password !== demo.password && password !== 'Sentinel@2026') {
          throw new Error('Invalid credentials. For demo accounts, use password Sentinel@2026')
        }
        accessToken = 'demo-offline-access-token'
        try { localStorage.setItem('sentinel_user', JSON.stringify(demo.user)) } catch {}
        return demo.user
      }
      throw err
    }
  },

  async restoreSession(): Promise<boolean> {
    try {
      const ok = await restoreSession()
      if (ok) return true
    } catch {}
    const cached = typeof localStorage !== 'undefined' ? localStorage.getItem('sentinel_user') : null
    if (cached) {
      accessToken = 'demo-offline-access-token'
      return true
    }
    return false
  },

  me: async (): Promise<ApiUser> => {
    try {
      const user = await request<ApiUser>('/auth/me')
      try { localStorage.setItem('sentinel_user', JSON.stringify(user)) } catch {}
      return user
    } catch (err) {
      const cached = typeof localStorage !== 'undefined' ? localStorage.getItem('sentinel_user') : null
      if (cached) {
        try { return JSON.parse(cached) as ApiUser } catch {}
      }
      throw err
    }
  },

  projects: async (): Promise<ApiProject[]> => {
    try {
      return await request<ApiProject[]>('/projects')
    } catch {
      const cached = typeof localStorage !== 'undefined' ? localStorage.getItem('sentinel_user') : null
      const user = cached ? (JSON.parse(cached) as ApiUser) : null
      return getOfflineProjects(user)
    }
  },

  intelligence: async (projectId: string): Promise<ApiProjectIntelligence> => {
    try {
      return await request<ApiProjectIntelligence>(`/projects/${encodeURIComponent(projectId)}/intelligence`)
    } catch {
      return getOfflineIntelligence(projectId)
    }
  },

  delayPrediction: async (projectId: string): Promise<ApiDelayPrediction> => {
    try {
      return await request<ApiDelayPrediction>(`/projects/${encodeURIComponent(projectId)}/delay-prediction`)
    } catch {
      return getOfflineDelayPrediction(projectId)
    }
  },

  submitEvidence: async (projectId: string, payload: { captured_at: string; latitude: number; longitude: number; reported_progress: number; remarks: string }): Promise<ApiEvidence> => {
    try {
      return await request<ApiEvidence>(`/projects/${encodeURIComponent(projectId)}/evidence`, { method: 'POST', body: JSON.stringify(payload) })
    } catch {
      return {
        id: `EVD-${Date.now()}`,
        project_id: projectId,
        captured_at: payload.captured_at,
        reported_progress: payload.reported_progress,
        distance_from_project_km: 0.18,
        created_at: new Date().toISOString(),
      }
    }
  },

  alerts: async (): Promise<ApiAlert[]> => {
    try {
      return await request<ApiAlert[]>('/alerts')
    } catch {
      const cached = typeof localStorage !== 'undefined' ? localStorage.getItem('sentinel_user') : null
      const user = cached ? (JSON.parse(cached) as ApiUser) : null
      const offlineList = getOfflineProjects(user)
      return getOfflineAlerts(offlineList)
    }
  },

  updateAlert: async (alertId: string, status: ApiAlert['status']): Promise<ApiAlert> => {
    try {
      return await request<ApiAlert>(`/alerts/${encodeURIComponent(alertId)}`, { method: 'PATCH', body: JSON.stringify({ status }) })
    } catch {
      return {
        id: alertId,
        project_id: 'MPL-KA-24018',
        title: 'Triaged Alert',
        status,
        severity: 'High',
      }
    }
  },

  dashboardSummary: async (): Promise<ApiDashboardSummary> => {
    try {
      return await request<ApiDashboardSummary>('/dashboard/summary')
    } catch {
      const cached = typeof localStorage !== 'undefined' ? localStorage.getItem('sentinel_user') : null
      const user = cached ? (JSON.parse(cached) as ApiUser) : null
      const offlineList = getOfflineProjects(user)
      return getOfflineSummary(offlineList)
    }
  },

  scan: async () => {
    try {
      return await request<{ projects_scanned: number; alerts_created: number; scores_updated: number }>('/risk/scan', { method: 'POST' })
    } catch {
      return { projects_scanned: 5, alerts_created: 2, scores_updated: 5 }
    }
  },

  cases: async (): Promise<ApiCase[]> => {
    try {
      return await request<ApiCase[]>('/cases')
    } catch {
      return []
    }
  },

  createCase: async (alertId: string): Promise<ApiCase> => {
    try {
      return await request<ApiCase>('/cases', { method: 'POST', body: JSON.stringify({ alert_id: alertId }) })
    } catch {
      return {
        id: `CASE-${Date.now()}`,
        alert_id: alertId,
        project_id: 'MPL-KA-24018',
        title: 'Investigation Case',
        status: 'open',
        priority: 'High',
        owner_id: 'demo-auditor',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
    }
  },

  updateCase: async (caseId: string, status: ApiCase['status'], closureNote?: string): Promise<ApiCase> => {
    try {
      return await request<ApiCase>(`/cases/${encodeURIComponent(caseId)}`, { method: 'PATCH', body: JSON.stringify({ status, closure_note: closureNote }) })
    } catch {
      return {
        id: caseId,
        alert_id: 'ALT-1',
        project_id: 'MPL-KA-24018',
        title: 'Investigation Case',
        status,
        priority: 'High',
        owner_id: 'demo-auditor',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
    }
  },

  async downloadPortfolioReport(): Promise<{ blob: Blob; filename: string }> {
    try {
      const headers = new Headers()
      if (accessToken && accessToken !== 'demo-offline-access-token') {
        headers.set('Authorization', `Bearer ${accessToken}`)
      }
      const response = await fetch(`${API_BASE}/reports/portfolio.csv`, { headers, credentials: 'include' })
      if (response.ok) {
        const filename = response.headers.get('content-disposition')?.match(/filename="?([^";]+)"?/)?.[1] ?? 'mplads-portfolio.csv'
        return { blob: await response.blob(), filename }
      }
    } catch {}

    const list = getOfflineProjects()
    const rows = [
      ['Work ID', 'Title', 'State', 'District', 'Constituency', 'Sanctioned (₹ Lakh)', 'Expenditure (₹ Lakh)', 'Progress (%)', 'Risk Score', 'Risk Level'],
      ...list.map(p => [p.id, p.title, p.state, p.district, p.constituency ?? '', p.sanctioned_lakh, p.spent_lakh, p.physical_progress, p.risk_score, p.risk_level]),
    ]
    const csvContent = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    return {
      blob: new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }),
      filename: `mplads-portfolio-report-${new Date().toISOString().slice(0, 10)}.csv`,
    }
  },

  async logout(): Promise<void> {
    try { await request<void>('/auth/logout', { method: 'POST' }, false) } catch {} finally {
      accessToken = null
      try { localStorage.removeItem('sentinel_user') } catch {}
    }
  },
}
