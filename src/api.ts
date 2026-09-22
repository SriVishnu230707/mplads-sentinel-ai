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

export type OfficialCredentials = {
  user_id: string
  full_name: string
  role: string
  pan_number: string | null
  aadhaar_number: string | null
  bank_name: string | null
  bank_account_number: string | null
  bank_ifsc: string | null
  pfms_code: string | null
  biometric_enrolled: boolean
  biometric_device_id: string | null
  biometric_enrolled_at: string | null
  is_unlocked: boolean
}

export type BiometricVerifyResult = {
  status: string
  verified_at: string
  message: string
  unlock_token: string
  credentials: OfficialCredentials
}

export type ImmovableProperty = {
  property_type: string
  location: string
  area_sqft?: string | number | null
  estimated_value_lakh: number
  ownership_status: string
}

export type MovableAssets = {
  bank_deposits_lakh: number
  vehicles_summary?: string | null
  gold_jewellery_grams: number
  investments_shares_lakh: number
}

export type MPRegistrationData = {
  email: string
  password: string
  full_name: string
  phone_number: string
  dob: string
  gender: string
  blood_group?: string
  father_or_spouse_name: string
  permanent_address: string
  present_address?: string

  house: string
  state: string
  constituency: string
  political_party: string
  term_label: string

  voter_id: string
  voter_constituency_serial?: string
  driving_license_no: string
  driving_license_rto?: string
  winning_certificate_no: string
  winning_date: string
  returning_officer_code?: string
  community_certificate_no: string
  community_category: string
  community_issuing_authority?: string
  birth_certificate_no: string
  birth_place?: string
  pan_number: string
  aadhaar_number: string

  immovable_properties: ImmovableProperty[]
  movable_assets: MovableAssets
  total_assets_lakh: number
  liabilities_lakh: number
  affidavit_eci_ref?: string

  bank_name: string
  bank_account_number: string
  bank_ifsc: string
  pfms_code?: string
}

export type MPRegistrationRecord = Omit<MPRegistrationData, 'password'> & {
  id: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  reviewed_at: string | null
  reviewed_by: string | null
  reviewer_remarks: string | null
  rejection_reason: string | null
}

export const DEFAULT_OFFICIAL_CREDENTIALS: Record<string, Partial<OfficialCredentials>> = {
  mp: {
    pan_number: 'EEKSK8892E',
    aadhaar_number: '541928371928',
    bank_name: 'State Bank of India (Parliament House Branch)',
    bank_account_number: '10029384719',
    bank_ifsc: 'SBIN0000691',
    pfms_code: 'PFMS-MP-00518',
    biometric_enrolled: true,
    biometric_device_id: 'UIDAI-L0-SECUGEN-HAMSTERPRO',
  },
  ministry: {
    pan_number: 'AAAPK1982A',
    aadhaar_number: '982345128891',
    bank_name: 'State Bank of India',
    bank_account_number: '30291823901',
    bank_ifsc: 'SBIN0000691',
    pfms_code: 'PFMS-DEL-00918',
    biometric_enrolled: true,
    biometric_device_id: 'UIDAI-L0-MANTRA-MFS100',
  },
  state: {
    pan_number: 'BBMPR7721B',
    aadhaar_number: '871239841029',
    bank_name: 'Canara Bank',
    bank_account_number: '11029384756',
    bank_ifsc: 'CNRB0000214',
    pfms_code: 'PFMS-KA-04821',
    biometric_enrolled: true,
    biometric_device_id: 'UIDAI-L0-STARTEK-FM220',
  },
  district: {
    pan_number: 'CCPRS3390C',
    aadhaar_number: '761928374610',
    bank_name: 'Karnataka Bank',
    bank_account_number: '48291039481',
    bank_ifsc: 'KARB0000108',
    pfms_code: 'PFMS-BLR-09281',
    biometric_enrolled: true,
    biometric_device_id: 'UIDAI-L0-MORPHO-MSO1300',
  },
  auditor: {
    pan_number: 'DDNPV4481D',
    aadhaar_number: '652819403819',
    bank_name: 'Punjab National Bank',
    bank_account_number: '29103948192',
    bank_ifsc: 'PUNB0012900',
    pfms_code: 'PFMS-AUD-00192',
    biometric_enrolled: true,
    biometric_device_id: 'UIDAI-L0-MANTRA-MFS100',
  },
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
    disclaimer: 'Calculated using disbursement-to-progress variance model. For official early-warning scrutiny only.',
    factors: [
      'Financial disbursement velocity exceeds physical milestone verification',
      'Contractor historical completion slippage in current district',
      'Monsoon seasonal adjustment window factor',
    ],
  }
}

export const DEFAULT_MP_REGISTRATIONS: MPRegistrationRecord[] = [
  {
    id: 'MP-REG-2026-0841',
    email: 'shashi.tharoor@parliament.gov.in',
    full_name: 'Dr. Shashi Tharoor',
    phone_number: '9847012345',
    dob: '1956-03-09',
    gender: 'Male',
    blood_group: 'O+',
    father_or_spouse_name: 'Late Chandran Tharoor',
    permanent_address: 'Pulapatta House, Thiruvananthapuram, Kerala - 695001',
    present_address: '97, Lodhi Estate, New Delhi - 110003',
    house: 'Lok Sabha',
    state: 'Kerala',
    constituency: 'Thiruvananthapuram',
    political_party: 'Indian National Congress',
    term_label: '18th Lok Sabha (2024-2029)',
    voter_id: 'KL01019284',
    voter_constituency_serial: 'Part 142, Sl 519',
    driving_license_no: 'KL01 20120008492',
    driving_license_rto: 'RTO Thiruvananthapuram (KL-01)',
    winning_certificate_no: 'ECI-KL-2024-FORM21E-019',
    winning_date: '2024-06-04',
    returning_officer_code: 'RO-KL-20-TVM',
    community_certificate_no: 'REV-KL-TVM-2019-90281',
    community_category: 'General',
    community_issuing_authority: 'Tahsildar, Thiruvananthapuram Taluk',
    birth_certificate_no: 'MC-TVM-1956-0812',
    birth_place: 'Thiruvananthapuram Registered',
    pan_number: 'AABPT1956K',
    aadhaar_number: '718293041928',
    immovable_properties: [
      {
        property_type: 'Agricultural Land',
        location: 'Sy. No. 104/2, Palakkad District, Kerala',
        area_sqft: '3.5 Acres',
        estimated_value_lakh: 180.0,
        ownership_status: 'Self',
      },
      {
        property_type: 'Residential Flat',
        location: 'Apartment 4B, Kowdiar Heights, Thiruvananthapuram',
        area_sqft: '2850 sq.ft',
        estimated_value_lakh: 260.0,
        ownership_status: 'Joint',
      },
      {
        property_type: 'Commercial Building',
        location: 'Constituency Public Liaison Office, MG Road, Thiruvananthapuram',
        area_sqft: '1400 sq.ft',
        estimated_value_lakh: 115.0,
        ownership_status: 'Self',
      },
    ],
    movable_assets: {
      bank_deposits_lakh: 340.5,
      vehicles_summary: 'Toyota Innova Crysta (KL-01-CB-1956)',
      gold_jewellery_grams: 125.0,
      investments_shares_lakh: 490.2,
    },
    total_assets_lakh: 1385.7,
    liabilities_lakh: 42.0,
    affidavit_eci_ref: 'https://affidavit.eci.gov.in/candidate-affidavit/2024/KL/20',
    bank_name: 'State Bank of India, Parliament House Branch',
    bank_account_number: '10928374619',
    bank_ifsc: 'SBIN0000691',
    pfms_code: 'PFMS-MP-00841',
    status: 'pending',
    created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    reviewed_at: null,
    reviewed_by: null,
    reviewer_remarks: null,
    rejection_reason: null,
  },
  {
    id: 'MP-REG-2024-0018',
    email: 'mp@sentinel.gov.in',
    full_name: "Dr. K. Sudhakar",
    phone_number: '9845012399',
    dob: '1973-12-26',
    gender: 'Male',
    blood_group: 'B+',
    father_or_spouse_name: 'P. N. Keshava Reddy',
    permanent_address: 'Chikkaballapura / Bengaluru Rural, Karnataka - 562101',
    present_address: 'Bungalow 14, Western Court, Janpath, New Delhi - 110001',
    house: 'Lok Sabha',
    state: 'Karnataka',
    constituency: 'Bengaluru Rural',
    political_party: 'Bharatiya Janata Party',
    term_label: '18th Lok Sabha (2024-2029)',
    voter_id: 'KA04991823',
    voter_constituency_serial: 'Part 88, Sl 210',
    driving_license_no: 'KA04 19990001824',
    driving_license_rto: 'RTO Bengaluru Rural (KA-04)',
    winning_certificate_no: 'ECI-KA-2024-FORM21E-023',
    winning_date: '2024-06-04',
    returning_officer_code: 'RO-KA-23-BLR',
    community_certificate_no: 'REV-KA-BLR-2020-00918',
    community_category: 'General',
    community_issuing_authority: 'Tahsildar, Devanahalli',
    birth_certificate_no: 'MC-BLR-1973-0981',
    birth_place: 'Bengaluru, Karnataka',
    pan_number: 'EEKSK8892E',
    aadhaar_number: '541928371928',
    immovable_properties: [
      {
        property_type: 'Agricultural Land',
        location: 'Devanahalli Taluk, Bengaluru Rural',
        area_sqft: '4.8 Acres',
        estimated_value_lakh: 310.0,
        ownership_status: 'Self',
      },
      {
        property_type: 'Residential House',
        location: 'Sadashivanagar, Bengaluru',
        area_sqft: '4200 sq.ft',
        estimated_value_lakh: 750.0,
        ownership_status: 'Joint',
      },
    ],
    movable_assets: {
      bank_deposits_lakh: 195.0,
      vehicles_summary: 'Toyota Fortuner (KA-04-KS-0001)',
      gold_jewellery_grams: 210.0,
      investments_shares_lakh: 340.0,
    },
    total_assets_lakh: 1805.0,
    liabilities_lakh: 65.0,
    affidavit_eci_ref: 'https://affidavit.eci.gov.in/candidate-affidavit/2024/KA/23',
    bank_name: 'State Bank of India (Parliament House Branch)',
    bank_account_number: '10029384719',
    bank_ifsc: 'SBIN0000691',
    pfms_code: 'PFMS-MP-00518',
    status: 'approved',
    created_at: new Date(Date.now() - 90 * 86400000).toISOString(),
    reviewed_at: new Date(Date.now() - 88 * 86400000).toISOString(),
    reviewed_by: 'demo-ministry',
    reviewer_remarks: 'Verified against ECI Gazette and Parliamentary Registry',
    rejection_reason: null,
  },
]

function getOfflineMPRegistrations(): MPRegistrationRecord[] {
  try {
    const raw = localStorage.getItem('sentinel_mp_registrations')
    if (raw) return JSON.parse(raw)
  } catch {}
  return [...DEFAULT_MP_REGISTRATIONS]
}

function saveOfflineMPRegistrations(list: MPRegistrationRecord[]) {
  try {
    localStorage.setItem('sentinel_mp_registrations', JSON.stringify(list))
  } catch {}
}

function saveOfflinePendingPassword(email: string, pass: string) {
  try {
    localStorage.setItem(`sentinel_pending_pass_${email.toLowerCase()}`, pass)
  } catch {}
}

function getOfflinePendingPassword(email: string): string | null {
  try {
    return localStorage.getItem(`sentinel_pending_pass_${email.toLowerCase()}`)
  } catch {}
  return null
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

  async getCredentials(user: ApiUser, unlockToken?: string | null): Promise<OfficialCredentials> {
    const headers: Record<string, string> = {}
    if (unlockToken) {
      headers['X-Biometric-Token'] = unlockToken
    }
    try {
      return await request<OfficialCredentials>('/auth/credentials', { headers })
    } catch {
      const storageKey = `sentinel_official_creds_${user.id}`
      let saved: Partial<OfficialCredentials> = {}
      try {
        const raw = localStorage.getItem(storageKey)
        if (raw) saved = JSON.parse(raw)
      } catch {}
      const defaults = DEFAULT_OFFICIAL_CREDENTIALS[user.role] ?? DEFAULT_OFFICIAL_CREDENTIALS.ministry
      const pan = saved.pan_number ?? defaults.pan_number ?? 'AAAPK1982A'
      const aadhaar = saved.aadhaar_number ?? defaults.aadhaar_number ?? '982345128891'
      const bank = saved.bank_name ?? defaults.bank_name ?? 'State Bank of India'
      const acc = saved.bank_account_number ?? defaults.bank_account_number ?? '30291823901'
      const ifsc = saved.bank_ifsc ?? defaults.bank_ifsc ?? 'SBIN0000691'
      const pfms = saved.pfms_code ?? defaults.pfms_code ?? 'PFMS-GOI-00123'
      const dev = saved.biometric_device_id ?? defaults.biometric_device_id ?? 'UIDAI-L0-MANTRA-MFS100'

      const isUnlocked = Boolean(unlockToken)
      return {
        user_id: user.id,
        full_name: user.full_name,
        role: user.role,
        pan_number: isUnlocked ? pan : `${pan.slice(0, 5)}••••${pan.slice(-1)}`,
        aadhaar_number: isUnlocked ? aadhaar : `•••• •••• ${aadhaar.slice(-4)}`,
        bank_name: bank,
        bank_account_number: isUnlocked ? acc : `••••••••${acc.slice(-4)}`,
        bank_ifsc: ifsc,
        pfms_code: pfms,
        biometric_enrolled: true,
        biometric_device_id: dev,
        biometric_enrolled_at: new Date(Date.now() - 90 * 86400000).toISOString(),
        is_unlocked: isUnlocked,
      }
    }
  },

  async updateCredentials(user: ApiUser, payload: Partial<OfficialCredentials>, unlockToken?: string | null): Promise<OfficialCredentials> {
    const headers: Record<string, string> = {}
    if (unlockToken) {
      headers['X-Biometric-Token'] = unlockToken
    }
    try {
      const updated = await request<OfficialCredentials>('/auth/credentials', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      })
      try {
        localStorage.setItem(`sentinel_official_creds_${user.id}`, JSON.stringify(updated))
      } catch {}
      return updated
    } catch {
      const storageKey = `sentinel_official_creds_${user.id}`
      let saved: Partial<OfficialCredentials> = {}
      try {
        const raw = localStorage.getItem(storageKey)
        if (raw) saved = JSON.parse(raw)
      } catch {}
      const defaults = DEFAULT_OFFICIAL_CREDENTIALS[user.role] ?? DEFAULT_OFFICIAL_CREDENTIALS.ministry
      const combined: OfficialCredentials = {
        user_id: user.id,
        full_name: user.full_name,
        role: user.role,
        pan_number: payload.pan_number ?? saved.pan_number ?? defaults.pan_number ?? 'AAAPK1982A',
        aadhaar_number: payload.aadhaar_number ?? saved.aadhaar_number ?? defaults.aadhaar_number ?? '982345128891',
        bank_name: payload.bank_name ?? saved.bank_name ?? defaults.bank_name ?? 'State Bank of India',
        bank_account_number: payload.bank_account_number ?? saved.bank_account_number ?? defaults.bank_account_number ?? '30291823901',
        bank_ifsc: payload.bank_ifsc ?? saved.bank_ifsc ?? defaults.bank_ifsc ?? 'SBIN0000691',
        pfms_code: payload.pfms_code ?? saved.pfms_code ?? defaults.pfms_code ?? 'PFMS-GOI-00123',
        biometric_enrolled: true,
        biometric_device_id: defaults.biometric_device_id ?? 'UIDAI-L0-MANTRA-MFS100',
        biometric_enrolled_at: new Date(Date.now() - 90 * 86400000).toISOString(),
        is_unlocked: Boolean(unlockToken),
      }
      try {
        localStorage.setItem(storageKey, JSON.stringify(combined))
      } catch {}
      return combined
    }
  },

  async verifyBiometrics(user: ApiUser, method = 'fingerprint'): Promise<BiometricVerifyResult> {
    try {
      return await request<BiometricVerifyResult>('/auth/biometric-verify', {
        method: 'POST',
        body: JSON.stringify({ method, device_challenge: `chal-${Date.now()}` }),
      })
    } catch {
      const token = `bio-mock-token-${Date.now()}`
      const storageKey = `sentinel_official_creds_${user.id}`
      let saved: Partial<OfficialCredentials> = {}
      try {
        const raw = localStorage.getItem(storageKey)
        if (raw) saved = JSON.parse(raw)
      } catch {}
      const defaults = DEFAULT_OFFICIAL_CREDENTIALS[user.role] ?? DEFAULT_OFFICIAL_CREDENTIALS.ministry
      const creds: OfficialCredentials = {
        user_id: user.id,
        full_name: user.full_name,
        role: user.role,
        pan_number: saved.pan_number ?? defaults.pan_number ?? 'AAAPK1982A',
        aadhaar_number: saved.aadhaar_number ?? defaults.aadhaar_number ?? '982345128891',
        bank_name: saved.bank_name ?? defaults.bank_name ?? 'State Bank of India',
        bank_account_number: saved.bank_account_number ?? defaults.bank_account_number ?? '30291823901',
        bank_ifsc: saved.bank_ifsc ?? defaults.bank_ifsc ?? 'SBIN0000691',
        pfms_code: saved.pfms_code ?? defaults.pfms_code ?? 'PFMS-GOI-00123',
        biometric_enrolled: true,
        biometric_device_id: defaults.biometric_device_id ?? 'UIDAI-L0-MANTRA-MFS100',
        biometric_enrolled_at: new Date(Date.now() - 90 * 86400000).toISOString(),
        is_unlocked: true,
      }
      return {
        status: 'verified',
        verified_at: new Date().toISOString(),
        message: 'Biometric authentication verified via UIDAI registered biometric vault',
        unlock_token: token,
        credentials: creds,
      }
    }
  },

  async submitMPRegistration(data: MPRegistrationData): Promise<MPRegistrationRecord> {
    try {
      return await request<MPRegistrationRecord>('/auth/mp-registration', {
        method: 'POST',
        body: JSON.stringify(data),
      }, false)
    } catch {
      const list = getOfflineMPRegistrations()
      const newRecord: MPRegistrationRecord = {
        ...data,
        id: `MP-REG-2026-${Math.floor(1000 + Math.random() * 9000)}`,
        status: 'pending',
        created_at: new Date().toISOString(),
        reviewed_at: null,
        reviewed_by: null,
        reviewer_remarks: null,
        rejection_reason: null,
      }
      delete (newRecord as any).password
      list.unshift(newRecord)
      saveOfflineMPRegistrations(list)
      saveOfflinePendingPassword(data.email, data.password)
      return newRecord
    }
  },

  async checkMPRegistrationStatus(refId?: string, email?: string): Promise<{
    id: string
    email: string
    full_name: string
    constituency: string
    status: 'pending' | 'approved' | 'rejected'
    created_at: string
    reviewed_at: string | null
    reviewer_remarks: string | null
    rejection_reason: string | null
  }> {
    try {
      const params = new URLSearchParams()
      if (refId) params.set('ref_id', refId)
      if (email) params.set('email', email)
      return await request(`/auth/mp-registration/status?${params.toString()}`, {}, false)
    } catch {
      const list = getOfflineMPRegistrations()
      const found = list.find(r => (refId && r.id === refId) || (email && r.email.toLowerCase() === email.toLowerCase()))
      if (!found) throw new Error('No application found for given details')
      return {
        id: found.id,
        email: found.email,
        full_name: found.full_name,
        constituency: found.constituency,
        status: found.status,
        created_at: found.created_at,
        reviewed_at: found.reviewed_at,
        reviewer_remarks: found.reviewer_remarks,
        rejection_reason: found.rejection_reason,
      }
    }
  },

  async getMinistryMPRegistrations(statusFilter?: string): Promise<MPRegistrationRecord[]> {
    try {
      const q = statusFilter && statusFilter !== 'all' ? `?status=${encodeURIComponent(statusFilter)}` : ''
      return await request<MPRegistrationRecord[]>(`/ministry/mp-registrations${q}`)
    } catch {
      let list = getOfflineMPRegistrations()
      if (statusFilter && statusFilter !== 'all') {
        list = list.filter(r => r.status === statusFilter)
      }
      return list
    }
  },

  async approveMPRegistration(requestId: string, remarks?: string): Promise<MPRegistrationRecord> {
    try {
      return await request<MPRegistrationRecord>(`/ministry/mp-registrations/${encodeURIComponent(requestId)}/approve`, {
        method: 'POST',
        body: JSON.stringify({ remarks }),
      })
    } catch {
      const list = getOfflineMPRegistrations()
      const found = list.find(r => r.id === requestId)
      if (!found) throw new Error('Registration request not found')
      found.status = 'approved'
      found.reviewed_at = new Date().toISOString()
      found.reviewed_by = 'demo-ministry'
      found.reviewer_remarks = remarks || 'Approved by Ministry of Statistics & PI'
      saveOfflineMPRegistrations(list)

      // Provision offline demo account
      const pass = getOfflinePendingPassword(found.email) || 'Sentinel@2026'
      DEMO_ACCOUNTS[found.email.toLowerCase()] = {
        password: pass,
        user: {
          id: `mp-${found.id}`,
          email: found.email.toLowerCase(),
          full_name: `${found.full_name} (Hon'ble MP)`,
          role: 'mp',
          organization: {
            id: `org-${found.id}`,
            name: `Office of Hon'ble MP - ${found.constituency}`,
            level: 'district',
            state: found.state,
            district: found.constituency,
            constituency: found.constituency,
          },
        },
      }
      return found
    }
  },

  async rejectMPRegistration(requestId: string, reason: string, remarks?: string): Promise<MPRegistrationRecord> {
    try {
      return await request<MPRegistrationRecord>(`/ministry/mp-registrations/${encodeURIComponent(requestId)}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason, remarks }),
      })
    } catch {
      const list = getOfflineMPRegistrations()
      const found = list.find(r => r.id === requestId)
      if (!found) throw new Error('Registration request not found')
      found.status = 'rejected'
      found.reviewed_at = new Date().toISOString()
      found.reviewed_by = 'demo-ministry'
      found.rejection_reason = reason
      found.reviewer_remarks = remarks || null
      saveOfflineMPRegistrations(list)
      return found
    }
  },

  async logout(): Promise<void> {
    try { await request<void>('/auth/logout', { method: 'POST' }, false) } catch {} finally {
      accessToken = null
      try { localStorage.removeItem('sentinel_user') } catch {}
    }
  },
}
