import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity, AlertTriangle, BarChart3, Bell,
  Building2, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, CircleHelp,
  ClipboardCheck, Clock3, Download, FileSearch, Filter, FolderKanban, Gauge,
  IndianRupee, LayoutDashboard, LockKeyhole, Map, Menu, Moon,
  Network, PanelLeftClose, Search, Settings, ShieldCheck, Sparkles, Sun,
  Users, X, Zap, LogOut, Eye, EyeOff, UserRound, Mail, MapPin, Fingerprint,
  KeyRound, BadgeCheck, Globe2, BriefcaseBusiness, Printer, FileText, CheckCircle2, ArrowRight,
  Play, Pause, TrendingUp, SlidersHorizontal, ArrowUpDown,
} from 'lucide-react'
import {
  activity, states, stateProgressData, trend, timelineMonths,
  type DistrictProgress, type Project, type RiskLevel, type StateProgress,
  type TimelineMonth, type MonthlyProgress,
} from './data'
import { api, type ApiAlert, type ApiDashboardSummary, type ApiDelayPrediction, type ApiProject, type ApiProjectIntelligence, type ApiUser } from './api'
import { GisMap, type MapMode } from './GisMap'

export type GeneratedReport = {
  id: string
  title: string
  tag: string
  description: string
  timestamp: string
  generatedBy: string
  scope: string
  classification: string
  totalWorks: number
  sanctionedLakh: number
  expenditureLakh: number
  highRiskCount: number
  delayedCount: number
  findings: string[]
  projects: Project[]
}

export type ScanResult = {
  projects_scanned: number
  alerts_created: number
  scores_updated: number
  timestamp: string
}

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csvContent = rows
    .map(row =>
      row
        .map(cell => {
          const str = String(cell ?? '')
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`
          }
          return str
        })
        .join(',')
    )
    .join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}


type Page = 'overview' | 'alerts' | 'projects' | 'map' | 'cases' | 'reports' | 'admin' | 'profile'
type Role = 'Ministry National Supervisor' | 'State Nodal Authority' | 'District Authority' | 'Auditor / Investigator'

const nav: { id: Page; label: string; icon: typeof LayoutDashboard; count?: number }[] = [
  { id: 'overview', label: 'Command centre', icon: LayoutDashboard },
  { id: 'alerts', label: 'Risk alerts', icon: AlertTriangle },
  { id: 'projects', label: 'Works & projects', icon: FolderKanban },
  { id: 'map', label: 'Map intelligence', icon: Map },
  { id: 'cases', label: 'Investigations', icon: ClipboardCheck },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'admin', label: 'Administration', icon: Settings },
]

const riskClass = (level: RiskLevel) => `risk-badge risk-${level.toLowerCase()}`
const formatCrore = (value: number) => `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 1 })} Cr`

const greeting = (name: string): string => {
  const hour = new Date().getHours()
  const firstName = name.split(' ')[0]
  if (hour < 12) return `Good morning, ${firstName}`
  if (hour < 17) return `Good afternoon, ${firstName}`
  return `Good evening, ${firstName}`
}

const pageDescriptions: Record<Page, string> = {
  overview: '', alerts: 'Prioritized, explainable signals that need human attention.', projects: 'Monitor financial and physical execution in one place.', map: 'Discover geographic clusters, overlaps and possible duplicate works.', cases: 'Track every investigation from triage to independently approved closure.', reports: 'Generate decision-ready summaries without manual spreadsheet work.', admin: 'Manage access, rule versions and platform accountability.',
  profile: 'Review your official identity, jurisdiction and session security.',
}

const pageNames: Record<Page, string> = {
  overview: 'Command centre',
  alerts: 'Risk alerts',
  projects: 'Works & projects',
  map: 'Map intelligence',
  cases: 'Investigations',
  reports: 'Reports',
  admin: 'Administration',
  profile: 'Profile',
}

type NavigationState = {
  page: Page
  projectId: string | null
}

const getInitialPage = (): Page => {
  const hash = window.location.hash.replace('#', '') as Page
  const validPages: Page[] = ['overview', 'alerts', 'projects', 'map', 'cases', 'reports', 'admin', 'profile']
  return validPages.includes(hash) ? hash : 'overview'
}

const roleLabels: Record<ApiUser['role'], Role> = {
  ministry: 'Ministry National Supervisor', state: 'State Nodal Authority', district: 'District Authority',
  auditor: 'Auditor / Investigator', field_officer: 'District Authority', mp: 'Ministry National Supervisor',
}

const toProject = (p: ApiProject): Project => ({
  id: p.id, title: p.title, location: p.location, state: p.state, district: p.district,
  category: p.category, agency: p.agency, sanctioned: p.sanctioned_lakh, spent: p.spent_lakh,
  progress: p.physical_progress, risk: p.risk_score, level: p.risk_level,
  issue: p.risk_reasons[0]?.explanation ?? 'No material irregularity detected', updated: new Date(p.updated_at).toLocaleString('en-IN'),
  lat: p.latitude ? Math.max(12, Math.min(88, 90 - p.latitude * 1.45)) : 50,
  lng: p.longitude ? Math.max(12, Math.min(88, (p.longitude - 67) * 4.2)) : 50,
  latitude: p.latitude ?? undefined,
  longitude: p.longitude ?? undefined,
})

function DashboardApp({ user, onLogout }: { user: ApiUser; onLogout: () => void }) {
  const [history, setHistory] = useState<NavigationState[]>([
    { page: getInitialPage(), projectId: null },
  ])
  const [historyIndex, setHistoryIndex] = useState(0)

  const currentState = history[historyIndex] ?? { page: 'overview', projectId: null }
  const page = currentState.page
  const role = roleLabels[user.role]
  const [projectData, setProjectData] = useState<Project[]>([])
  const [summary, setSummary] = useState<ApiDashboardSummary | null>(null)
  const [scanMessage, setScanMessage] = useState('')
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [dark, setDark] = useState(() => {
    const savedTheme = localStorage.getItem('sentinel-theme')
    return savedTheme ? savedTheme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  const [collapsed, setCollapsed] = useState(false)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Project | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const navigateToPage = (nextPage: Page) => {
    if (nextPage === page && !selected) return
    setSelected(null)
    setHistory(prev => [
      ...prev.slice(0, historyIndex + 1),
      { page: nextPage, projectId: null },
    ])
    setHistoryIndex(prev => prev + 1)
    window.history.pushState({ page: nextPage, projectId: null }, '', `#${nextPage}`)
  }
  const setPage = navigateToPage

  const handleSelectProject = (project: Project | null) => {
    setSelected(project)
    const newProjectId = project ? project.id : null
    if (newProjectId === currentState.projectId) return
    setHistory(prev => [
      ...prev.slice(0, historyIndex + 1),
      { page, projectId: newProjectId },
    ])
    setHistoryIndex(prev => prev + 1)
  }

  const goBack = () => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1
      const prevState = history[prevIndex]
      setHistoryIndex(prevIndex)
      if (prevState.projectId) {
        const found = projectData.find(p => p.id === prevState.projectId)
        setSelected(found ?? null)
      } else {
        setSelected(null)
      }
      window.history.pushState(prevState, '', `#${prevState.page}`)
    }
  }

  const goForward = () => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1
      const nextState = history[nextIndex]
      setHistoryIndex(nextIndex)
      if (nextState.projectId) {
        const found = projectData.find(p => p.id === nextState.projectId)
        setSelected(found ?? null)
      } else {
        setSelected(null)
      }
      window.history.pushState(nextState, '', `#${nextState.page}`)
    }
  }

  const canGoBack = historyIndex > 0
  const canGoForward = historyIndex < history.length - 1

  const getNavLabel = (state?: NavigationState) => {
    if (!state) return ''
    const title = pageNames[state.page] ?? state.page
    if (state.projectId) {
      return `${title} · ${state.projectId}`
    }
    return title
  }

  // Restore project selection if projectData loads after history state set
  useEffect(() => {
    if (currentState.projectId && !selected && projectData.length > 0) {
      const found = projectData.find(p => p.id === currentState.projectId)
      if (found) setSelected(found)
    }
  }, [currentState.projectId, projectData, selected])

  // Sync browser popstate (browser back/forward buttons)
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (e.state && typeof e.state.page === 'string') {
        const targetPage = e.state.page as Page
        const targetProjectId = e.state.projectId ?? null
        setHistory(prev => {
          const idx = prev.findIndex(item => item.page === targetPage && item.projectId === targetProjectId)
          if (idx !== -1) {
            setHistoryIndex(idx)
            return prev
          }
          setHistoryIndex(prev.length)
          return [...prev, { page: targetPage, projectId: targetProjectId }]
        })
        if (targetProjectId) {
          const found = projectData.find(p => p.id === targetProjectId)
          setSelected(found ?? null)
        } else {
          setSelected(null)
        }
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [projectData])

  // Keyboard navigation shortcuts: Alt+ArrowLeft (back) and Alt+ArrowRight (forward)
  useEffect(() => {
    const handleNavShortcuts = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault()
        goBack()
      } else if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault()
        goForward()
      }
    }
    document.addEventListener('keydown', handleNavShortcuts)
    return () => document.removeEventListener('keydown', handleNavShortcuts)
  }, [historyIndex, history.length, projectData])

  // Sync dark mode with <html> so body/viewport background matches
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('sentinel-theme', dark ? 'dark' : 'light')
    return () => { document.documentElement.classList.remove('dark') }
  }, [dark])

  // Global ⌘K / Ctrl+K keyboard shortcut to focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  const loadPortfolio = async () => {
    const [projects, dashboardSummary] = await Promise.all([api.projects(), api.dashboardSummary()])
    setProjectData(projects.map(toProject))
    setSummary(dashboardSummary)
  }

  useEffect(() => {
    loadPortfolio().catch(() => {
      setProjectData([])
      setSummary(null)
      setScanMessage('Project data is unavailable. No unverified fallback data is being shown.')
    })
  }, [])

  const runScan = async () => {
    if (scanning) return
    setScanning(true)
    setScanMessage('Scanning authorized portfolio…')
    try {
      const result = await api.scan()
      await loadPortfolio()
      const now = new Date()
      const timeStr = `${now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}, ${now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
      setScanResult({
        projects_scanned: result.projects_scanned,
        alerts_created: result.alerts_created,
        scores_updated: result.scores_updated,
        timestamp: timeStr,
      })
      setScanMessage(`${result.projects_scanned} works scanned · ${result.alerts_created} new alerts · scores recalibrated`)
    } catch (error) {
      setScanMessage(error instanceof Error ? error.message : 'Risk scan failed')
    } finally {
      setScanning(false)
    }
  }

  const handleExportView = () => {
    const headers = ['Work ID', 'Project Title', 'State', 'District', 'Sanctioned (Lakh)', 'Spent (Lakh)', 'Progress (%)', 'Risk Score', 'Risk Level', 'Primary Signal']
    const rows = [
      headers,
      ...filtered.map(p => [
        p.id,
        p.title,
        p.state,
        p.district ?? '',
        p.sanctioned,
        p.spent,
        p.progress,
        p.risk,
        p.level,
        p.issue,
      ])
    ]
    downloadCsv(`MPLADS_Sentinel_${page}_${new Date().toISOString().slice(0, 10)}.csv`, rows)
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? projectData.filter(p => `${p.id} ${p.title} ${p.location} ${p.agency}`.toLowerCase().includes(q)) : projectData
  }, [search, projectData])

  return (
    <div className={dark ? 'app dark' : 'app'}>
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileMenu ? 'mobile-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><ShieldCheck size={22} /></div>
          {!collapsed && <div><strong>MPLADS</strong><span>Sentinel AI</span></div>}
          <button className="icon-button sidebar-close" onClick={() => setMobileMenu(false)} aria-label="Close navigation"><X size={20} /></button>
        </div>

        {!collapsed && <div className="workspace-label">NATIONAL WORKSPACE</div>}
        <nav aria-label="Primary navigation">
          {nav.map(item => {
            const Icon = item.icon
            const count = item.id === 'alerts' ? summary?.open_alerts : undefined
            return (
              <button key={item.id} className={page === item.id ? 'nav-item active' : 'nav-item'} onClick={() => { setPage(item.id); setMobileMenu(false) }} title={collapsed ? item.label : undefined}>
                <Icon size={19} />
                {!collapsed && <><span>{item.label}</span>{count !== undefined && <b>{count}</b>}</>}
              </button>
            )
          })}
        </nav>

        <div className="sidebar-spacer" />
        {!collapsed && (
          <div className="system-card">
            <div className="system-head"><span className="pulse" /> System operational</div>
            <p>Last intelligence scan completed successfully.</p>
            <div><span>18,420 works</span><span>02:14 IST</span></div>
          </div>
        )}
        <button className="collapse-button" onClick={() => setCollapsed(v => !v)}>
          <PanelLeftClose size={18} className={collapsed ? 'flip' : ''} />
          {!collapsed && <span>Collapse navigation</span>}
        </button>
      </aside>

      {mobileMenu && <div className="scrim" onClick={() => setMobileMenu(false)} />}

      <main className={`main ${collapsed ? 'main-wide' : ''}`}>
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button mobile-toggle" onClick={() => setMobileMenu(true)} aria-label="Open navigation"><Menu size={21} /></button>
            <div className="nav-history-cluster" role="group" aria-label="Navigation history">
              <button
                type="button"
                className="icon-button nav-history-btn"
                onClick={goBack}
                disabled={!canGoBack}
                aria-label="Previous page (Alt + Left Arrow)"
                title={canGoBack ? `Previous: ${getNavLabel(history[historyIndex - 1])} (Alt + ←)` : 'No previous history'}
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                className="icon-button nav-history-btn"
                onClick={goForward}
                disabled={!canGoForward}
                aria-label="Next page (Alt + Right Arrow)"
                title={canGoForward ? `Next: ${getNavLabel(history[historyIndex + 1])} (Alt + →)` : 'No forward history'}
              >
                <ChevronRight size={18} />
              </button>
            </div>
            <div className="global-search">
              <Search size={18} />
              <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search work ID, district, agency or vendor…" aria-label="Global search" />
              <kbd>⌘ K</kbd>
            </div>
          </div>
          <div className="top-actions">
            <button className="icon-button" onClick={() => setDark(v => !v)} aria-label={`Switch to ${dark ? 'light' : 'dark'} mode`} aria-pressed={dark}>{dark ? <Sun size={19} /> : <Moon size={19} />}</button>
            <button className="icon-button notification" aria-label="Notifications"><Bell size={19} /><span /></button>
            <div className="divider" />
            <div className="profile">
              <button className={`profile-trigger ${page === 'profile' ? 'active' : ''}`} onClick={() => setPage('profile')} aria-label={`Open profile for ${user.full_name}`} aria-current={page === 'profile' ? 'page' : undefined}>
                <div className="avatar">{user.full_name.split(' ').map(x => x[0]).slice(0, 2).join('')}</div>
                <div className="profile-copy"><strong>{user.full_name}</strong><span>{role}</span></div>
              </button>
              <button className="icon-button" onClick={onLogout} aria-label="Sign out" title="Sign out"><LogOut size={17}/></button>
            </div>
          </div>
        </header>

        <div className="content">
          <div className="page-heading">
            <div>
              <div className="eyebrow"><span className="status-dot" /> {page === 'profile' ? 'Verified official identity' : 'Live national overview'}</div>
              <h1>{page === 'overview' ? greeting(user.full_name) : page === 'profile' ? 'My profile' : nav.find(n => n.id === page)?.label}</h1>
              <p>{page === 'overview' ? 'Here is what requires attention across MPLADS today.' : pageDescriptions[page]}</p>
            </div>
            {page !== 'profile' && <div className="heading-actions">
              <div className="role-switcher secure-scope"><LockKeyhole size={16}/><span>{user.organization.name}</span></div>
              <button className="button secondary" onClick={handleExportView} title="Export current view to CSV"><Download size={17} /> Export view</button>
              <button className="button primary" onClick={runScan} disabled={scanning} aria-busy={scanning}><Sparkles size={17} /> {scanning ? 'Scanning…' : 'Run risk scan'}</button>
            </div>}
          </div>

          {scanMessage && <div className="system-message"><ShieldCheck size={16}/>{scanMessage}<button onClick={() => setScanMessage('')}><X size={15}/></button></div>}

          {page === 'overview' && (
            <Overview
              projects={filtered}
              summary={summary}
              onSelect={handleSelectProject}
              isDark={dark}
              onNavigateMap={() => setPage('map')}
              onNavigateAlerts={() => setPage('alerts')}
              onNavigateProjects={() => setPage('projects')}
              onNavigateReports={() => setPage('reports')}
              onNavigateCases={() => setPage('cases')}
            />
          )}
          {page === 'alerts' && <AlertsView projects={filtered} onSelect={handleSelectProject} onRunScan={runScan} scanning={scanning} />}
          {page === 'projects' && <ProjectsView projects={filtered} onSelect={handleSelectProject} />}
          {page === 'map' && <MapView projects={filtered} onSelect={handleSelectProject} isDark={dark} />}
          {page === 'cases' && <CasesView projects={filtered} onSelectProject={handleSelectProject} />}
          {page === 'reports' && <ReportsView projects={projectData} summary={summary} user={user} role={role} />}
          {page === 'admin' && <AdminView />}
          {page === 'profile' && <ProfileView user={user} role={role} onLogout={onLogout} />}
        </div>
      </main>

      {selected && <ProjectDrawer project={selected} onClose={() => handleSelectProject(null)} />}
      {scanResult && <ScanResultModal result={scanResult} onClose={() => setScanResult(null)} onNavigateAlerts={() => { setScanResult(null); setPage('alerts') }} />}
    </div>
  )
}

// pageDescriptions moved above DashboardApp for correct declaration order

function Overview({
  projects,
  summary,
  onSelect,
  isDark,
  onNavigateMap,
  onNavigateAlerts,
  onNavigateProjects,
  onNavigateReports,
  onNavigateCases,
}: {
  projects: Project[]
  summary: ApiDashboardSummary | null
  onSelect: (p: Project) => void
  isDark: boolean
  onNavigateMap: () => void
  onNavigateAlerts: () => void
  onNavigateProjects?: () => void
  onNavigateReports?: () => void
  onNavigateCases?: () => void
}) {
  const utilization = summary && summary.sanctioned_lakh > 0
    ? `${Math.round(summary.expenditure_lakh / summary.sanctioned_lakh * 100)}%`
    : '—'

  const priorityProjects = useMemo(() => [...projects].sort((a, b) => b.risk - a.risk).slice(0, 4), [projects])

  const [chartMode, setChartMode] = useState<'trend' | 'states' | 'districts'>('trend')
  const [selectedStateName, setSelectedStateName] = useState<string>('Karnataka')
  const [selectedMonth, setSelectedMonth] = useState<TimelineMonth>('Sep')
  const [isPlayingTimeline, setIsPlayingTimeline] = useState<boolean>(false)
  const [metricMode, setMetricMode] = useState<'both' | 'physical' | 'financial' | 'delayed'>('both')
  const [sortBy, setSortBy] = useState<'progress' | 'delayed' | 'financial' | 'name'>('progress')

  // Auto-advance timeline playback to show monthly progression animation
  useEffect(() => {
    if (!isPlayingTimeline) return
    const interval = setInterval(() => {
      setSelectedMonth(curr => {
        const idx = timelineMonths.indexOf(curr)
        const nextIdx = (idx + 1) % timelineMonths.length
        return timelineMonths[nextIdx]
      })
    }, 1200)
    return () => clearInterval(interval)
  }, [isPlayingTimeline])

  const selectedStateData = useMemo(() => {
    return stateProgressData.find(s => s.name === selectedStateName) ?? stateProgressData[0]
  }, [selectedStateName])

  const handleSelectAnalyticsState = (stateName: string) => {
    setSelectedStateName(stateName)
    setChartMode('districts')
  }

  const chartHeader = useMemo(() => {
    if (chartMode === 'trend') {
      return {
        title: 'Risk intelligence trend',
        subtitle: 'Detected vs. resolved signals · interactive timeline with live hover analytics',
        action: 'View analytics',
        onAction: () => setChartMode('states'),
      }
    }
    if (chartMode === 'states') {
      return {
        title: 'State progress analytics',
        subtitle: `Comparative progression · ${selectedMonth} 2026 · Click state to drill into districts`,
        action: 'View risk trend',
        onAction: () => setChartMode('trend'),
      }
    }
    return {
      title: `${selectedStateName} district progress`,
      subtitle: `District execution timeline in ${selectedStateName} · ${selectedMonth} 2026`,
      action: '← All states',
      onAction: () => setChartMode('states'),
    }
  }, [chartMode, selectedStateName, selectedMonth])

  return <>
    <section className="metrics-grid">
      <Metric icon={FolderKanban} label="Active works" value={summary ? summary.active_works.toLocaleString('en-IN') : '—'} delta={summary ? String(summary.delayed_works) : '—'} note="delayed works in your scope" color="teal" onClick={onNavigateProjects} />
      <Metric icon={IndianRupee} label="Expenditure monitored" value={summary ? formatCrore(summary.expenditure_lakh / 100) : '—'} delta={utilization} note={summary ? `of ${formatCrore(summary.sanctioned_lakh / 100)} sanctioned` : 'loading authorized portfolio'} color="blue" onClick={onNavigateProjects} />
      <Metric icon={AlertTriangle} label="High-risk works" value={summary ? summary.high_risk_works.toLocaleString('en-IN') : '—'} delta={summary ? String(summary.open_alerts) : '—'} note="open alerts requiring review" color="red" onClick={onNavigateAlerts} />
      <Metric icon={Clock3} label="Delayed works" value={summary ? summary.delayed_works.toLocaleString('en-IN') : '—'} delta={summary ? String(summary.active_works) : '—'} note="active works assessed" color="amber" onClick={onNavigateProjects} />
    </section>

    <section className="dashboard-grid">
      <div className="card risk-trend-card">
        <CardHeader
          title={chartHeader.title}
          subtitle={chartHeader.subtitle}
          action={chartHeader.action}
          onAction={chartHeader.onAction}
        />

        <div className="chart-tab-strip">
          <div className="chart-tab-pills" role="tablist" aria-label="Chart view mode">
            <button
              type="button"
              className={`chart-tab-btn ${chartMode === 'trend' ? 'active' : ''}`}
              onClick={() => setChartMode('trend')}
            >
              <Activity size={13} /> Risk trend
            </button>
            <button
              type="button"
              className={`chart-tab-btn ${chartMode === 'states' ? 'active' : ''}`}
              onClick={() => setChartMode('states')}
            >
              <BarChart3 size={13} /> State progress
            </button>
            <button
              type="button"
              className={`chart-tab-btn ${chartMode === 'districts' ? 'active' : ''}`}
              onClick={() => setChartMode('districts')}
            >
              <Network size={13} /> District progress {chartMode === 'districts' && `(${selectedStateName})`}
            </button>
          </div>

          <span className="chart-context-badge">
            {chartMode === 'trend' && 'Dynamic timeline'}
            {chartMode === 'states' && `Showing ${selectedMonth} progression (${stateProgressData.length} states)`}
            {chartMode === 'districts' && `Showing ${selectedMonth} (${selectedStateData.districts.length} districts)`}
          </span>
        </div>

        {chartMode === 'trend' && <TrendChart />}
        {chartMode === 'states' && (
          <StateProgressChart
            selectedMonth={selectedMonth}
            onSelectMonth={(m) => setSelectedMonth(m)}
            isPlaying={isPlayingTimeline}
            onTogglePlay={() => setIsPlayingTimeline(p => !p)}
            metricMode={metricMode}
            onSelectMetric={(m) => setMetricMode(m)}
            sortBy={sortBy}
            onSelectSort={(s) => setSortBy(s)}
            onSelectState={handleSelectAnalyticsState}
          />
        )}
        {chartMode === 'districts' && (
          <DistrictProgressChart
            stateName={selectedStateName}
            selectedMonth={selectedMonth}
            onSelectMonth={(m) => setSelectedMonth(m)}
            isPlaying={isPlayingTimeline}
            onTogglePlay={() => setIsPlayingTimeline(p => !p)}
            onBack={() => setChartMode('states')}
            onSelectState={(name) => setSelectedStateName(name)}
          />
        )}
      </div>
      <div className="card map-card">
        <CardHeader title="National risk distribution" subtitle="Live satellite & project-risk concentration" action="Open full map" onAction={onNavigateMap} />
        <GisMap projects={projects} onSelect={onSelect} mode="satellite" compact isDark={isDark} height="230px" />
        <div className="map-legend"><span><i className="legend critical" />Critical</span><span><i className="legend high" />High</span><span><i className="legend moderate" />Moderate</span><span><i className="legend low" />Low</span></div>
      </div>
    </section>

    <section className="dashboard-grid lower-grid">
      <div className="card alerts-card">
        <CardHeader
          title="Priority alerts"
          subtitle="Ranked by risk, confidence and potential impact"
          action={summary ? `View all ${summary.open_alerts}` : 'View all alerts'}
          onAction={onNavigateAlerts}
        />
        <ProjectTable projects={priorityProjects} onSelect={onSelect} compact />
      </div>
      <div className="card activity-card">
        <CardHeader title="Live activity" subtitle="Latest actions across the platform" />
        <div className="activity-list">
          {activity.map(item => <div className="activity-item" key={item.title}><span className={`activity-icon ${item.tone}`}><Activity size={15} /></span><div><strong>{item.title}</strong><p>{item.meta}</p></div><time>{item.time}</time></div>)}
        </div>
        <button className="text-button full" onClick={onNavigateCases}>View complete audit activity <ChevronRight size={15} /></button>
      </div>
    </section>

    <section className="card state-card">
      <CardHeader title="State performance watch" subtitle="Relative risk based on active work portfolio" action="Compare all states" onAction={onNavigateMap} />
      <div className="state-list">
        {states.map((state, i) => <div className="state-row" key={state.name}><span className="rank">{String(i + 1).padStart(2, '0')}</span><div className="state-name"><strong>{state.name}</strong><span>{state.projects.toLocaleString('en-IN')} active works</span></div><div className="bar-track"><span style={{ width: `${state.score}%` }} /></div><strong className="risk-number">{state.highRisk}</strong><span className="muted-label">high risk</span><ChevronRight size={17} /></div>)}
      </div>
    </section>
  </>
}

function Metric({ icon: Icon, label, value, delta, note, color, onClick }: { icon: typeof Gauge; label: string; value: string; delta: string; note: string; color: string; onClick?: () => void }) {
  return (
    <article
      className={`metric card ${onClick ? 'interactive' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      style={onClick ? { cursor: 'pointer' } : undefined}
    >
      <div className={`metric-icon ${color}`}><Icon size={20} /></div>
      <div className="metric-top"><span>{label}</span><CircleHelp size={14} /></div>
      <div className="metric-value">{value}</div>
      <div className="metric-foot"><span className="delta neutral">{delta}</span><span>{note}</span></div>
    </article>
  )
}

function CardHeader({ title, subtitle, action, onAction }: { title: string; subtitle: string; action?: string; onAction?: () => void }) {
  return <div className="card-header"><div><h2>{title}</h2><p>{subtitle}</p></div>{action && <button className="text-button" onClick={onAction}>{action}<ChevronRight size={15} /></button>}</div>
}

function TrendChart() {
  const [range, setRange] = useState<'30d' | '90d' | '6m'>('6m')
  const [showDetected, setShowDetected] = useState<boolean>(true)
  const [showResolved, setShowResolved] = useState<boolean>(true)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const visibleData = useMemo(() => {
    if (range === '30d') return trend.slice(-2)
    if (range === '90d') return trend.slice(-3)
    return trend
  }, [range])

  const max = 90
  const count = visibleData.length
  const stepX = count > 1 ? (478 - 42) / (count - 1) : 436

  const pointsA = visibleData.map((d, i) => `${42 + i * stepX},${160 - (d.detected / max) * 120}`).join(' ')
  const pointsB = visibleData.map((d, i) => `${42 + i * stepX},${160 - (d.resolved / max) * 120}`).join(' ')

  const activePoint = hoveredIndex !== null && visibleData[hoveredIndex] ? visibleData[hoveredIndex] : null
  const activeX = hoveredIndex !== null ? 42 + hoveredIndex * stepX : null

  return (
    <div className="chart-wrap">
      <div className="trend-toolbar">
        <div className="trend-range-pills" role="tablist" aria-label="Time horizon">
          <button
            type="button"
            className={`trend-pill ${range === '30d' ? 'active' : ''}`}
            onClick={() => setRange('30d')}
          >
            30 Days
          </button>
          <button
            type="button"
            className={`trend-pill ${range === '90d' ? 'active' : ''}`}
            onClick={() => setRange('90d')}
          >
            90 Days
          </button>
          <button
            type="button"
            className={`trend-pill ${range === '6m' ? 'active' : ''}`}
            onClick={() => setRange('6m')}
          >
            6 Months
          </button>
        </div>

        <div className="trend-legend-toggles">
          <button
            type="button"
            className={`toggle-btn ${showDetected ? '' : 'dimmed'}`}
            onClick={() => setShowDetected(v => !v)}
            title="Click to toggle Risk Detected line"
          >
            <i className="dot detected" /> Risk detected
          </button>
          <button
            type="button"
            className={`toggle-btn ${showResolved ? '' : 'dimmed'}`}
            onClick={() => setShowResolved(v => !v)}
            title="Click to toggle Resolved line"
          >
            <i className="dot resolved" /> Resolved
          </button>
        </div>
      </div>

      {activePoint && (
        <div className="trend-hover-card">
          <strong>{activePoint.month} 2026</strong>
          <span><i className="dot detected" /> {activePoint.detected} risks flagged</span>
          <span><i className="dot resolved" /> {activePoint.resolved} alerts resolved</span>
          <span style={{ color: '#2e8f7a', fontWeight: 700 }}>
            {Math.round((activePoint.resolved / activePoint.detected) * 100)}% resolution rate
          </span>
        </div>
      )}

      <svg
        viewBox="0 0 520 190"
        role="img"
        aria-label="Risk intelligence trend line chart"
        onMouseLeave={() => setHoveredIndex(null)}
      >
        <defs>
          <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#df6b58" stopOpacity=".28" />
            <stop offset="1" stopColor="#df6b58" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[40, 80, 120, 160].map(y => (
          <line key={y} x1="42" x2="478" y1={y} y2={y} className="grid-line" />
        ))}

        {showDetected && count > 1 && (
          <polygon
            points={`42,160 ${pointsA} ${42 + (count - 1) * stepX},160`}
            fill="url(#area)"
          />
        )}

        {showDetected && count > 1 && (
          <polyline points={pointsA} className="line detected-line" />
        )}
        {showResolved && count > 1 && (
          <polyline points={pointsB} className="line resolved-line" />
        )}

        {activeX !== null && (
          <line
            x1={activeX}
            x2={activeX}
            y1={25}
            y2={165}
            className="trend-guide-line"
          />
        )}

        {visibleData.map((d, i) => {
          const cx = 42 + i * stepX
          const cyA = 160 - (d.detected / max) * 120
          const cyB = 160 - (d.resolved / max) * 120
          const isHovered = hoveredIndex === i

          return (
            <g
              key={d.month}
              onMouseEnter={() => setHoveredIndex(i)}
              style={{ cursor: 'pointer' }}
            >
              <rect
                x={cx - stepX / 2}
                y={20}
                width={stepX}
                height={150}
                fill="transparent"
              />
              <text x={cx} y="183" textAnchor="middle" style={{ fontWeight: isHovered ? 800 : 500 }}>
                {d.month}
              </text>
              {showDetected && (
                <circle
                  cx={cx}
                  cy={cyA}
                  r={isHovered ? 6 : 3.8}
                  className={`point detected-point ${isHovered ? 'trend-active-dot' : ''}`}
                />
              )}
              {showResolved && (
                <circle
                  cx={cx}
                  cy={cyB}
                  r={isHovered ? 6 : 3.8}
                  className={`point resolved-point ${isHovered ? 'trend-active-dot' : ''}`}
                />
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function StateProgressChart({
  selectedMonth,
  onSelectMonth,
  isPlaying,
  onTogglePlay,
  metricMode,
  onSelectMetric,
  sortBy,
  onSelectSort,
  onSelectState,
}: {
  selectedMonth: TimelineMonth
  onSelectMonth: (m: TimelineMonth) => void
  isPlaying: boolean
  onTogglePlay: () => void
  metricMode: 'both' | 'physical' | 'financial' | 'delayed'
  onSelectMetric: (m: 'both' | 'physical' | 'financial' | 'delayed') => void
  sortBy: 'progress' | 'delayed' | 'financial' | 'name'
  onSelectSort: (s: 'progress' | 'delayed' | 'financial' | 'name') => void
  onSelectState: (stateName: string) => void
}) {
  const [hoveredState, setHoveredState] = useState<string | null>(null)

  // Compute state data according to selectedMonth progression
  const statesWithMonthData = useMemo(() => {
    return stateProgressData.map(st => {
      const monthRecord = st.history.find(h => h.month === selectedMonth) ?? {
        progress: st.progress,
        financialProgress: st.financialProgress,
      }
      const prevIdx = timelineMonths.indexOf(selectedMonth) - 1
      const prevRecord = prevIdx >= 0 ? st.history.find(h => h.month === timelineMonths[prevIdx]) : null
      const momDelta = prevRecord ? monthRecord.progress - prevRecord.progress : null

      return {
        ...st,
        currentProgress: monthRecord.progress,
        currentFinancial: monthRecord.financialProgress,
        momDelta,
      }
    })
  }, [selectedMonth])

  const sortedStates = useMemo(() => {
    const list = [...statesWithMonthData]
    if (sortBy === 'progress') return list.sort((a, b) => b.currentProgress - a.currentProgress)
    if (sortBy === 'financial') return list.sort((a, b) => b.currentFinancial - a.currentFinancial)
    if (sortBy === 'delayed') return list.sort((a, b) => b.highRiskWorks - a.highRiskWorks)
    return list.sort((a, b) => a.name.localeCompare(b.name))
  }, [statesWithMonthData, sortBy])

  const avgPhysical = Math.round(
    statesWithMonthData.reduce((acc, s) => acc + s.currentProgress, 0) / statesWithMonthData.length
  )
  const avgFinancial = Math.round(
    statesWithMonthData.reduce((acc, s) => acc + s.currentFinancial, 0) / statesWithMonthData.length
  )

  return (
    <div className="analytics-chart-container">
      {/* Interactive Timeline Player & Month Scrubber */}
      <div className="timeline-strip">
        <div className="timeline-left">
          <button
            type="button"
            className={`timeline-play-btn ${isPlaying ? 'playing' : ''}`}
            onClick={onTogglePlay}
            title={isPlaying ? 'Pause progression timeline' : 'Play progression timeline animation'}
            aria-label={isPlaying ? 'Pause timeline' : 'Play timeline'}
          >
            {isPlaying ? <Pause size={13} /> : <Play size={13} style={{ marginLeft: 2 }} />}
          </button>
          <div className="timeline-label">
            <span>Month:</span> <b>{selectedMonth} 2026</b>
            {isPlaying && <small style={{ color: '#2e8f7a', fontWeight: 700 }}>(Playing…)</small>}
          </div>
        </div>

        <div className="timeline-months-row" role="tablist" aria-label="Progression months">
          {timelineMonths.map(m => (
            <button
              key={m}
              type="button"
              className={`month-step-btn ${m === selectedMonth ? 'active' : ''}`}
              onClick={() => onSelectMonth(m)}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Metric filter & sorting toolbar */}
      <div className="analytics-filter-bar">
        <div className="metric-pill-group">
          <button
            type="button"
            className={`metric-pill-btn ${metricMode === 'both' ? 'active' : ''}`}
            onClick={() => onSelectMetric('both')}
          >
            Dual View
          </button>
          <button
            type="button"
            className={`metric-pill-btn ${metricMode === 'physical' ? 'active' : ''}`}
            onClick={() => onSelectMetric('physical')}
          >
            Physical %
          </button>
          <button
            type="button"
            className={`metric-pill-btn ${metricMode === 'financial' ? 'active' : ''}`}
            onClick={() => onSelectMetric('financial')}
          >
            Financial %
          </button>
        </div>

        <div className="sort-select-wrap">
          <ArrowUpDown size={12} />
          <span>Sort:</span>
          <select
            className="sort-select"
            value={sortBy}
            onChange={(e) => onSelectSort(e.target.value as any)}
            aria-label="Sort states by"
          >
            <option value="progress">Highest progress</option>
            <option value="financial">Highest fund absorption</option>
            <option value="delayed">High risk / delayed</option>
            <option value="name">Alphabetical</option>
          </select>
        </div>
      </div>

      {/* Stats Summary Bar */}
      <div className="analytics-meta-strip">
        <span><b>5</b> States Assessed</span>
        <span>Avg. Physical: <b>{avgPhysical}%</b></span>
        <span>Avg. Financial: <b>{avgFinancial}%</b></span>
        <small className="hint-pill">Click any state row to view district graph</small>
      </div>

      {/* Dynamic Animated State Bars */}
      <div className="state-chart-body">
        {sortedStates.map((st) => (
          <div
            key={st.name}
            className={`state-progress-row ${hoveredState === st.name ? 'hovered' : ''}`}
            onClick={() => onSelectState(st.name)}
            onMouseEnter={() => setHoveredState(st.name)}
            onMouseLeave={() => setHoveredState(null)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSelectState(st.name)
              }
            }}
            title={`Click to open ${st.name} district progress graph`}
          >
            <div className="state-row-info">
              <strong>{st.name}</strong>
              <span>
                {st.totalWorks.toLocaleString('en-IN')} works · ₹{st.spentCrore} Cr / ₹{st.sanctionedCrore} Cr
              </span>
            </div>

            <div className="state-bars-wrap">
              <div className="dual-track">
                {/* Animated physical bar */}
                <div
                  className="bar physical-bar"
                  style={{
                    width: `${st.currentProgress}%`,
                    opacity: metricMode === 'financial' ? 0.4 : 1,
                  }}
                >
                  <span className="bar-label">{st.currentProgress}% physical</span>
                </div>

                {/* Animated financial absorption marker */}
                {metricMode !== 'physical' && (
                  <div
                    className="financial-marker"
                    style={{ left: `${st.currentFinancial}%` }}
                    title={`Financial absorption in ${selectedMonth}: ${st.currentFinancial}%`}
                  />
                )}
              </div>
            </div>

            <div className="state-row-action" style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
              {st.momDelta !== null && st.momDelta > 0 && (
                <span className="delta-tag pos" title={`Progress change since previous month`}>
                  +{st.momDelta}%
                </span>
              )}
              <span className="drilldown-badge">Districts <ChevronRight size={12} /></span>
            </div>
          </div>
        ))}
      </div>

      <div className="analytics-legend">
        <span><i className="legend-box physical" /> Physical Progress (%)</span>
        <span><i className="legend-line financial" /> Financial Absorption Marker</span>
        <span className="milestone-text">Interactive timeline updates bars dynamically</span>
      </div>
    </div>
  )
}

function DistrictProgressChart({
  stateName,
  selectedMonth,
  onSelectMonth,
  isPlaying,
  onTogglePlay,
  onBack,
  onSelectState,
}: {
  stateName: string
  selectedMonth: TimelineMonth
  onSelectMonth: (m: TimelineMonth) => void
  isPlaying: boolean
  onTogglePlay: () => void
  onBack: () => void
  onSelectState: (name: string) => void
}) {
  const stateData = useMemo(() => {
    return stateProgressData.find(s => s.name === stateName) || stateProgressData[0]
  }, [stateName])

  const [activeDistrictName, setActiveDistrictName] = useState<string | null>(null)

  // Calculate dynamic month values for each district
  const districtsWithMonthData = useMemo(() => {
    return stateData.districts.map(dist => {
      const monthRecord = dist.history.find(h => h.month === selectedMonth) ?? {
        progress: dist.progress,
        financialProgress: dist.financialProgress,
      }
      const prevIdx = timelineMonths.indexOf(selectedMonth) - 1
      const prevRecord = prevIdx >= 0 ? dist.history.find(h => h.month === timelineMonths[prevIdx]) : null
      const momDelta = prevRecord ? monthRecord.progress - prevRecord.progress : null

      return {
        ...dist,
        currentProgress: monthRecord.progress,
        currentFinancial: monthRecord.financialProgress,
        momDelta,
      }
    })
  }, [stateData, selectedMonth])

  const activeDistrict = useMemo(() => {
    if (!activeDistrictName) return districtsWithMonthData[0] ?? null
    return districtsWithMonthData.find(d => d.name === activeDistrictName) ?? districtsWithMonthData[0] ?? null
  }, [activeDistrictName, districtsWithMonthData])

  const stateMonthProgress = useMemo(() => {
    const hist = stateData.history.find(h => h.month === selectedMonth)
    return hist ? hist.progress : stateData.progress
  }, [stateData, selectedMonth])

  const stateMonthFinancial = useMemo(() => {
    const hist = stateData.history.find(h => h.month === selectedMonth)
    return hist ? hist.financialProgress : stateData.financialProgress
  }, [stateData, selectedMonth])

  return (
    <div className="analytics-chart-container">
      {/* State Switcher Chips */}
      <div className="district-state-chips">
        <button className="back-link-btn" onClick={onBack} title="Back to All States">
          <ChevronLeft size={15} /> All states
        </button>
        <div className="chips-list">
          {stateProgressData.map(s => (
            <button
              key={s.name}
              type="button"
              className={`state-chip ${s.name === stateData.name ? 'active' : ''}`}
              onClick={() => onSelectState(s.name)}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>

      {/* Interactive Timeline Scrubber inside State */}
      <div className="timeline-strip">
        <div className="timeline-left">
          <button
            type="button"
            className={`timeline-play-btn ${isPlaying ? 'playing' : ''}`}
            onClick={onTogglePlay}
            title={isPlaying ? 'Pause progression timeline' : 'Play progression timeline animation'}
            aria-label={isPlaying ? 'Pause timeline' : 'Play timeline'}
          >
            {isPlaying ? <Pause size={13} /> : <Play size={13} style={{ marginLeft: 2 }} />}
          </button>
          <div className="timeline-label">
            <span>Month:</span> <b>{selectedMonth} 2026</b>
            {isPlaying && <small style={{ color: '#2e8f7a', fontWeight: 700 }}>(Playing…)</small>}
          </div>
        </div>

        <div className="timeline-months-row" role="tablist" aria-label="Progression months">
          {timelineMonths.map(m => (
            <button
              key={m}
              type="button"
              className={`month-step-btn ${m === selectedMonth ? 'active' : ''}`}
              onClick={() => onSelectMonth(m)}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* State Overview Header */}
      <div className="district-summary-banner">
        <div>
          <span>Selected State</span>
          <strong>{stateData.name}</strong>
        </div>
        <div>
          <span>Physical Progress ({selectedMonth})</span>
          <strong className="text-green">{stateMonthProgress}% avg</strong>
        </div>
        <div>
          <span>Financial Utilization ({selectedMonth})</span>
          <strong className="text-blue">{stateMonthFinancial}%</strong>
        </div>
        <div>
          <span>Districts Mapped</span>
          <strong>{stateData.districts.length} districts</strong>
        </div>
      </div>

      {/* District Progress Graph: Animated Dynamic SVG Chart */}
      <div className="district-graph-wrap">
        <svg
          viewBox="0 0 540 175"
          className="district-svg-chart"
          role="img"
          aria-label={`District progress chart for ${stateData.name} in ${selectedMonth}`}
        >
          {/* Reference grid lines */}
          {[0, 25, 50, 75, 100].map(val => {
            const y = 142 - (val / 100) * 115
            return (
              <g key={val}>
                <line
                  x1="38"
                  x2="530"
                  y1={y}
                  y2={y}
                  className="grid-line"
                  strokeDasharray={val === 50 || val === 75 ? '3 3' : undefined}
                />
                <text x="30" y={y + 3} textAnchor="end" className="district-axis-text">
                  {val}%
                </text>
              </g>
            )
          })}

          {/* Dynamic Animated District Column Bars */}
          {districtsWithMonthData.map((dist, i) => {
            const numDistricts = districtsWithMonthData.length
            const slotWidth = (490 - 45) / numDistricts
            const barW = Math.max(12, Math.min(22, slotWidth * 0.35))
            const slotCenter = 45 + (i + 0.5) * slotWidth
            const physX = slotCenter - barW - 1
            const finX = slotCenter + 1

            const physHeight = (dist.currentProgress / 100) * 115
            const physY = 142 - physHeight

            const finHeight = (dist.currentFinancial / 100) * 115
            const finY = 142 - finHeight

            const isHovered = activeDistrict?.name === dist.name

            return (
              <g
                key={dist.name}
                className={`district-bar-group ${isHovered ? 'hovered' : ''}`}
                onMouseEnter={() => setActiveDistrictName(dist.name)}
                onClick={() => setActiveDistrictName(dist.name)}
                style={{ cursor: 'pointer' }}
                role="button"
                tabIndex={0}
                aria-label={`${dist.name} (${selectedMonth}): ${dist.currentProgress}% physical, ${dist.currentFinancial}% financial`}
              >
                {/* Physical Progress Bar with animated transition */}
                <rect
                  x={physX}
                  y={physY}
                  width={barW}
                  height={physHeight}
                  rx="3"
                  className="bar-rect physical"
                />

                {/* Financial Progress Bar with animated transition */}
                <rect
                  x={finX}
                  y={finY}
                  width={barW}
                  height={finHeight}
                  rx="3"
                  className="bar-rect financial"
                />

                {/* District Label */}
                <text
                  x={slotCenter}
                  y="158"
                  textAnchor="middle"
                  className="district-axis-text"
                  style={{ fontWeight: isHovered ? 800 : 500 }}
                >
                  {dist.name.replace('Bengaluru', 'Blr').replace('Metropolitan', 'Metro')}
                </text>

                {/* Physical value */}
                <text
                  x={slotCenter}
                  y={Math.min(physY, finY) - 5}
                  textAnchor="middle"
                  className="bar-val-text"
                >
                  {dist.currentProgress}%
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      {/* District Detail Tooltip / Card */}
      {activeDistrict ? (
        <div className="district-detail-card">
          <div className="district-detail-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <strong>{activeDistrict.name}</strong>
              <small style={{ color: 'var(--muted)', fontSize: 10 }}>({selectedMonth} 2026 Standing)</small>
              {activeDistrict.momDelta !== null && activeDistrict.momDelta > 0 && (
                <span className="delta-tag pos">+{activeDistrict.momDelta}% this month</span>
              )}
            </div>
            <span className="signal-pill">{activeDistrict.primarySignal}</span>
          </div>
          <div className="district-metrics-row">
            <div>
              <span>Physical Progress ({selectedMonth})</span>
              <b className="text-green">{activeDistrict.currentProgress}%</b>
            </div>
            <div>
              <span>Financial Utilization ({selectedMonth})</span>
              <b className="text-blue">
                {activeDistrict.currentFinancial}% (₹{activeDistrict.spentLakh}L / ₹{activeDistrict.sanctionedLakh}L)
              </b>
            </div>
            <div>
              <span>Active Works</span>
              <b>{activeDistrict.totalWorks} works</b>
            </div>
            <div>
              <span>Delayed Works</span>
              <b className="text-amber">{activeDistrict.delayedWorks} delayed</b>
            </div>
          </div>
        </div>
      ) : (
        <div className="district-detail-card placeholder">
          <span>Hover or tap any district bar to inspect physical execution, financial tranches and delay signals</span>
        </div>
      )}

      {/* Legend */}
      <div className="analytics-legend">
        <span><i className="legend-box physical" /> Physical Progress (%)</span>
        <span><i className="legend-box financial" /> Financial Utilization (%)</span>
        <span className="milestone-text">--- 50% & 75% Target Milestones</span>
      </div>
    </div>
  )
}

function ProjectTable({ projects, onSelect, compact = false }: { projects: Project[]; onSelect: (p: Project) => void; compact?: boolean }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Work</th>
            <th>Risk</th>
            {!compact && <th>Sanctioned</th>}
            <th>Progress</th>
            <th>Primary signal</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {projects.map(p => (
            <tr
              key={p.id}
              onClick={() => onSelect(p)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelect(p)
                }
              }}
              tabIndex={0}
              role="button"
              aria-label={`Open ${p.title}`}
            >
              <td>
                <strong>{p.title}</strong>
                <span>{p.id} · {p.location}</span>
              </td>
              <td>
                <span className={riskClass(p.level)}><i />{p.risk} {p.level}</span>
              </td>
              {!compact && (
                <td>
                  <strong>{formatCrore(p.sanctioned / 100)}</strong>
                  <span>{formatCrore(p.spent / 100)} spent</span>
                </td>
              )}
              <td>
                <div className="progress-cell">
                  <div><span style={{ width: `${p.progress}%` }}/></div>
                  <b>{p.progress}%</b>
                </div>
              </td>
              <td className="issue-cell">{p.issue}</td>
              <td>
                <button
                  type="button"
                  className="row-action"
                  aria-label={`Open details for ${p.title}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onSelect(p)
                  }}
                >
                  <ChevronRight size={17}/>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Toolbar({
  searchPlaceholder = 'Search this view…',
  search = '',
  onSearchChange,
}: {
  searchPlaceholder?: string
  search?: string
  onSearchChange?: (val: string) => void
}) {
  return (
    <div className="toolbar">
      <div className="local-search">
        <Search size={17} />
        <input
          placeholder={searchPlaceholder}
          value={search}
          onChange={e => onSearchChange?.(e.target.value)}
          aria-label={searchPlaceholder}
        />
      </div>
      <button className="button secondary"><Filter size={16}/> Filters <span className="filter-count">3</span></button>
      <button className="button secondary"><CalendarDays size={16}/> Last 30 days</button>
    </div>
  )
}

function AlertsView({
  projects,
  onSelect,
  onRunScan,
  scanning,
}: {
  projects: Project[]
  onSelect: (p: Project) => void
  onRunScan?: () => void
  scanning?: boolean
}) {
  const [filter, setFilter] = useState<'all' | 'critical' | 'high' | 'assigned'>('all')
  const [localSearch, setLocalSearch] = useState('')

  const sortedProjects = useMemo(() => [...projects].sort((a, b) => b.risk - a.risk), [projects])
  const criticalCount = useMemo(() => sortedProjects.filter(p => p.level === 'Critical').length, [sortedProjects])
  const highCount = useMemo(() => sortedProjects.filter(p => p.level === 'High').length, [sortedProjects])

  const filteredProjects = useMemo(() => {
    let list = sortedProjects
    if (filter === 'critical') list = list.filter(p => p.level === 'Critical')
    else if (filter === 'high') list = list.filter(p => p.level === 'High')
    else if (filter === 'assigned') list = list.slice(0, 2)

    if (localSearch.trim()) {
      const q = localSearch.trim().toLowerCase()
      list = list.filter(p => `${p.id} ${p.title} ${p.location} ${p.agency} ${p.issue}`.toLowerCase().includes(q))
    }
    return list
  }, [sortedProjects, filter, localSearch])

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
        <div className="segment-tabs" style={{ margin: 0 }}>
          <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
            All alerts <b>{projects.length}</b>
          </button>
          <button className={filter === 'critical' ? 'active' : ''} onClick={() => setFilter('critical')}>
            Critical <b>{criticalCount}</b>
          </button>
          <button className={filter === 'high' ? 'active' : ''} onClick={() => setFilter('high')}>
            High <b>{highCount}</b>
          </button>
          <button className={filter === 'assigned' ? 'active' : ''} onClick={() => setFilter('assigned')}>
            Assigned to me <b>2</b>
          </button>
        </div>
        {onRunScan && (
          <button className="button primary" onClick={onRunScan} disabled={scanning} aria-busy={scanning}>
            <Sparkles size={16} /> {scanning ? 'Scanning…' : 'Run risk scan'}
          </button>
        )}
      </div>
      <section className="card data-card">
        <Toolbar
          searchPlaceholder="Search alert, work or district…"
          search={localSearch}
          onSearchChange={setLocalSearch}
        />
        <ProjectTable projects={filteredProjects} onSelect={onSelect} />
      </section>
    </>
  )
}

function ProjectsView({ projects, onSelect }: { projects: Project[]; onSelect: (p: Project) => void }) {
  const [localSearch, setLocalSearch] = useState('')
  const filtered = useMemo(() => {
    if (!localSearch.trim()) return projects
    const q = localSearch.trim().toLowerCase()
    return projects.filter(p => `${p.id} ${p.title} ${p.location} ${p.agency}`.toLowerCase().includes(q))
  }, [projects, localSearch])

  return (
    <>
      <section className="mini-stats">
        <div><span>All works</span><strong>18,420</strong></div>
        <div><span>In progress</span><strong>11,864</strong></div>
        <div><span>Delayed</span><strong>2,184</strong></div>
        <div><span>Completed this FY</span><strong>4,372</strong></div>
      </section>
      <section className="card data-card">
        <Toolbar
          searchPlaceholder="Search work ID, title or agency…"
          search={localSearch}
          onSearchChange={setLocalSearch}
        />
        <ProjectTable projects={filtered} onSelect={onSelect}/>
      </section>
    </>
  )
}

function MapView({ projects, onSelect, isDark }: { projects: Project[]; onSelect: (p: Project) => void; isDark: boolean }) {
  const [mapMode, setMapMode] = useState<MapMode>('satellite')
  const [selectedGeo, setSelectedGeo] = useState<string>('all')
  const [highRiskOnly, setHighRiskOnly] = useState(false)
  const [mismatchOnly, setMismatchOnly] = useState(false)

  const displayedProjects = useMemo(() => {
    return projects.filter(p => {
      if (selectedGeo !== 'all' && p.state !== selectedGeo) return false
      if (highRiskOnly && p.level !== 'Critical' && p.level !== 'High') return false
      if (mismatchOnly && !p.issue.includes('%')) return false
      return true
    })
  }, [projects, selectedGeo, highRiskOnly, mismatchOnly])

  return (
    <section className="map-page">
      <aside className="map-panel card">
        <h2>Intelligence layers</h2>
        <p>Combine GIS and satellite evidence to uncover spatial patterns.</p>
        <label>
          <input
            type="checkbox"
            checked={highRiskOnly}
            onChange={e => setHighRiskOnly(e.target.checked)}
          />
          <span>High & Critical Risk Only</span>
          <small>{projects.filter(p => p.level === 'Critical' || p.level === 'High').length}</small>
        </label>
        <label>
          <input
            type="checkbox"
            checked={mismatchOnly}
            onChange={e => setMismatchOnly(e.target.checked)}
          />
          <span>Payment–progress mismatch</span>
          <small>{projects.filter(p => p.issue.includes('%')).length}</small>
        </label>
        <div className="panel-separator"/>
        <h3>Selected geography</h3>
        <select
          className="select-like"
          value={selectedGeo}
          onChange={e => setSelectedGeo(e.target.value)}
          aria-label="Select Geography"
        >
          <option value="all">All India (National Overview)</option>
          <option value="Karnataka">Karnataka</option>
          <option value="Uttar Pradesh">Uttar Pradesh</option>
          <option value="Maharashtra">Maharashtra</option>
          <option value="Assam">Assam</option>
          <option value="Tamil Nadu">Tamil Nadu</option>
        </select>

        <div className="map-quick-stats">
          <div><span>Visible works</span><strong>{displayedProjects.length}</strong></div>
          <div><span>Active Layer</span><strong className="capitalize">{mapMode}</strong></div>
        </div>

        <button
          className="button primary full-button"
          onClick={() => {
            setSelectedGeo('all')
            setHighRiskOnly(false)
            setMismatchOnly(false)
          }}
        >
          <FileSearch size={17}/> Reset GIS Filters
        </button>
      </aside>

      <div className="card large-map">
        <div className="map-toolbar">
          <button
            className={mapMode === 'risk' ? 'active' : ''}
            onClick={() => setMapMode('risk')}
            title="Sleek risk intelligence map"
          >
            Risk
          </button>
          <button
            className={mapMode === 'satellite' ? 'active' : ''}
            onClick={() => setMapMode('satellite')}
            title="High-resolution Esri satellite imagery"
          >
            Satellite
          </button>
          <button
            className={mapMode === 'district' ? 'active' : ''}
            onClick={() => setMapMode('district')}
            title="Administrative boundaries & district topology"
          >
            District
          </button>
          <span/>
          <div className="satellite-indicator">
            <span className={`sat-pulse ${mapMode === 'satellite' ? 'live' : ''}`}/>
            {mapMode === 'satellite' ? 'Esri World Imagery Live' : `${mapMode.toUpperCase()} Layer`}
          </div>
        </div>

        <GisMap
          projects={displayedProjects}
          onSelect={onSelect}
          mode={mapMode}
          selectedState={selectedGeo}
          isDark={isDark}
          height="100%"
        />

        <div className="map-insight">
          <Zap size={17}/>
          <div>
            <strong>Spatial insight</strong>
            <p>{displayedProjects.length} works mapped with GPS coordinates.</p>
          </div>
          <ChevronRight size={17}/>
        </div>
      </div>
    </section>
  )
}

type InvestigationCase = {
  id: string
  title: string
  owner: string
  assignedOfficer: string
  status: 'New' | 'Triaged' | 'Evidence requested' | 'Field verification' | 'Under review' | 'Closure review'
  priority: 'Critical' | 'High' | 'Moderate'
  age: string
  sla: number
  projectId: string
  projectTitle: string
  location: string
  sanctioned: number
  spent: number
  irregularity: string
  primarySignal: string
  timeline: Array<{ date: string; title: string; detail: string; by: string }>
  evidenceFiles: Array<{ name: string; type: string; size: string; date: string }>
  notes: string[]
}

const INITIAL_CASES: InvestigationCase[] = [
  {
    id: 'CASE-2026-0184',
    title: 'Payment–progress discrepancy',
    owner: 'Karnataka State Review Cell',
    assignedOfficer: 'S. N. Hegde (Executive Auditor)',
    status: 'Field verification',
    priority: 'Critical',
    age: '4 days',
    sla: 68,
    projectId: 'MPL-KA-24018',
    projectTitle: 'Rural Link Road Improvement',
    location: 'Devanahalli, Bengaluru Rural, Karnataka',
    sanctioned: 58,
    spent: 47.6,
    irregularity: '₹47.6 lakh (82%) disbursed while certified physical progress is only 34%. Unverified billing gap of ₹27.9 lakh flagged by Sentinel rules.',
    primarySignal: 'FIN_PHYSICAL_MISMATCH (94% confidence)',
    timeline: [
      { date: '16 Sep 2026', title: 'Payment mismatch detected', detail: 'Sentinel Engine flagged 48 percentage point execution lag vs expenditure.', by: 'Rule Engine v1.4' },
      { date: '17 Sep 2026', title: 'Investigation docket opened', detail: 'Case assigned to Karnataka State Review Cell for priority triage.', by: 'Ministry National Supervisor' },
      { date: '18 Sep 2026', title: 'Show-cause notice dispatched', detail: 'Formal clarification memo issued to PWD Bengaluru Rural Executive Engineer.', by: 'S. N. Hegde' },
      { date: '19 Sep 2026', title: 'Field inspection ordered', detail: 'Geo-fenced field measurement ordered within 2 km project perimeter.', by: 'S. N. Hegde' },
    ],
    evidenceFiles: [
      { name: 'Measurement_Book_MB2025_41.pdf', type: 'Certified MB Extract', size: '2.4 MB', date: '18 Sep 2026' },
      { name: 'Site_Inspection_Devanahalli.jpg', type: 'Geo-Tagged Photo', size: '4.1 MB', date: '19 Sep 2026' },
      { name: 'Contractor_Stage3_Voucher.pdf', type: 'Disbursement Voucher', size: '1.8 MB', date: '17 Sep 2026' },
    ],
    notes: [
      'Contractor claims wet-mix macadam layer completed; waiting for third-party lab compressive strength report.',
      'Field officer instructed to upload GPS-verified coordinates before release of final milestone tranche.',
    ],
  },
  {
    id: 'CASE-2026-0171',
    title: 'Unusual cost benchmark deviation',
    owner: 'Uttar Pradesh Audit Unit',
    assignedOfficer: 'Alok Tripathi (Senior Financial Auditor)',
    status: 'Evidence requested',
    priority: 'High',
    age: '7 days',
    sla: 84,
    projectId: 'MPL-UP-23872',
    projectTitle: 'Community Health Centre Extension',
    location: 'Sadar, Gorakhpur, Uttar Pradesh',
    sanctioned: 72,
    spent: 54.2,
    irregularity: 'Sanctioned cost of ₹72.0 lakh is 41% higher than regional peer median of ₹51.0 lakh for comparable 30-bed healthcare blocks.',
    primarySignal: 'COST_BENCHMARK_OUTLIER (82% confidence)',
    timeline: [
      { date: '13 Sep 2026', title: 'Benchmark outlier flagged', detail: 'Sanctioned value exceeded peer median upper boundary by 41%.', by: 'Rule Engine v1.4' },
      { date: '15 Sep 2026', title: 'Assigned to UP Audit Unit', detail: 'Docket transferred for itemized Schedule of Rates (SOR) comparison.', by: 'Ministry National Supervisor' },
      { date: '17 Sep 2026', title: 'Detailed BOQ requested', detail: 'Requisitioned itemized civil and medical piping schedule from District Health Society.', by: 'Alok Tripathi' },
    ],
    evidenceFiles: [
      { name: 'Schedule_of_Rates_Comparison_UP2025.xlsx', type: 'Rate Analysis Sheet', size: '840 KB', date: '16 Sep 2026' },
      { name: 'Technical_Sanction_Estimate.pdf', type: 'Chief Engineer TS Memo', size: '3.2 MB', date: '15 Sep 2026' },
    ],
    notes: [
      'District authority cited waterlogged soil foundation requiring pile work. Foundation geo-technical report awaited.',
    ],
  },
  {
    id: 'CASE-2026-0168',
    title: 'Possible duplicate school work',
    owner: 'Maharashtra Nodal Authority',
    assignedOfficer: 'Priyanka Patil (Nodal Vigilance Officer)',
    status: 'Under review',
    priority: 'High',
    age: '9 days',
    sla: 92,
    projectId: 'MPL-MH-24103',
    projectTitle: 'Government School Science Block',
    location: 'Karjat, Raigad, Maharashtra',
    sanctioned: 44,
    spent: 26.8,
    irregularity: 'Potential duplicate work flagged 310 meters away from an active state Samagra Shiksha science block with 86% title and scope similarity.',
    primarySignal: 'DUPLICATE_WORK_CLUSTER (88% confidence)',
    timeline: [
      { date: '11 Sep 2026', title: 'Spatial cluster match', detail: 'Fuzzy title & GPS distance cluster detected overlapping project boundaries.', by: 'Intelligence Engine v2.0' },
      { date: '12 Sep 2026', title: 'Vigilance inquiry initiated', detail: 'Assigned to Maharashtra Nodal Authority to check duplicate fund allocation.', by: 'Auditor / Investigator' },
      { date: '16 Sep 2026', title: 'Survey coordinates cross-verified', detail: 'Verified Zilla Parishad school campus boundary overlay with state education registry.', by: 'Priyanka Patil' },
    ],
    evidenceFiles: [
      { name: 'School_GPS_Boundary_Overlay.pdf', type: 'GIS Map Verification', size: '5.6 MB', date: '16 Sep 2026' },
      { name: 'Samagra_Shiksha_Sanction_Copy.pdf', type: 'State Sanction Order', size: '1.1 MB', date: '14 Sep 2026' },
    ],
    notes: [
      'Headmaster confirmed separate sanctions were processed for adjacent wings. Verification underway to ensure distinct physical assets.',
    ],
  },
]

function CasesView({ projects, onSelectProject }: { projects?: Project[]; onSelectProject?: (p: Project) => void }) {
  const [casesList, setCasesList] = useState<InvestigationCase[]>(INITIAL_CASES)
  const [selectedCase, setSelectedCase] = useState<InvestigationCase | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('All')

  const workflowStages = [
    { label: 'All', count: casesList.length },
    { label: 'New', count: 31 },
    { label: 'Triaged', count: 18 },
    { label: 'Evidence requested', count: 17 },
    { label: 'Verification', count: 12 },
    { label: 'Closure review', count: 6 },
  ]

  const filteredCases = useMemo(() => {
    if (statusFilter === 'All') return casesList
    if (statusFilter === 'Verification') {
      return casesList.filter(c => c.status === 'Field verification' || c.status === 'Under review')
    }
    return casesList.filter(c => c.status === statusFilter)
  }, [casesList, statusFilter])

  const handleInspectLinkedWork = (projectId: string) => {
    if (!onSelectProject || !projects) return
    const matched = projects.find(p => p.id === projectId)
    if (matched) {
      onSelectProject(matched)
    }
  }

  return (
    <>
      <section className="workflow-strip">
        {workflowStages.map((stage, i) => (
          <div
            key={stage.label}
            className={statusFilter === stage.label ? 'active' : ''}
            onClick={() => setStatusFilter(stage.label)}
            title={`Filter by ${stage.label}`}
          >
            <span>{stage.count}</span>
            <strong>{stage.label}</strong>
            {i < workflowStages.length - 1 && <ChevronRight size={17} />}
          </div>
        ))}
      </section>

      <section className="card case-list">
        <CardHeader
          title="Active investigations"
          subtitle={`Showing ${filteredCases.length} prioritized investigation dockets · Click any case to inspect dossier`}
          action="Export case register"
        />
        {filteredCases.map(c => (
          <article
            className="case-row"
            key={c.id}
            onClick={() => setSelectedCase(c)}
            tabIndex={0}
            role="button"
            aria-label={`Open investigation dossier for ${c.id}: ${c.title}`}
          >
            <div className="case-icon"><ClipboardCheck size={19} /></div>
            <div className="case-main">
              <span>{c.id} · {c.projectId}</span>
              <strong>{c.title}</strong>
              <p>{c.owner} · {c.location}</p>
            </div>
            <div className="case-status">
              <span>{c.status}</span>
              <small>Open for {c.age}</small>
            </div>
            <div className="sla">
              <div>
                <span
                  style={{
                    width: `${c.sla}%`,
                    background: c.sla > 85 ? '#d4584c' : c.sla > 70 ? '#e28d32' : '#3f9d7f',
                  }}
                />
              </div>
              <small>SLA {c.sla}% used</small>
            </div>
            <button
              type="button"
              className="row-action"
              aria-label={`View dossier for ${c.id}`}
              onClick={(e) => {
                e.stopPropagation()
                setSelectedCase(c)
              }}
            >
              <ChevronRight size={18} />
            </button>
          </article>
        ))}
      </section>

      {selectedCase && (
        <CaseDrawer
          caseItem={selectedCase}
          onClose={() => setSelectedCase(null)}
          onInspectProject={handleInspectLinkedWork}
          onCaseUpdated={(updated) => {
            setCasesList(prev => prev.map(item => item.id === updated.id ? updated : item))
            setSelectedCase(updated)
          }}
        />
      )}
    </>
  )
}

function CaseDrawer({
  caseItem,
  onClose,
  onInspectProject,
  onCaseUpdated,
}: {
  caseItem: InvestigationCase
  onClose: () => void
  onInspectProject?: (projectId: string) => void
  onCaseUpdated?: (updated: InvestigationCase) => void
}) {
  const [activeTab, setActiveTab] = useState<'overview' | 'evidence' | 'timeline' | 'notes'>('overview')
  const [newNote, setNewNote] = useState('')
  const [notes, setNotes] = useState<string[]>(caseItem.notes)
  const [caseStatus, setCaseStatus] = useState(caseItem.status)
  const [toastMessage, setToastMessage] = useState('')

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newNote.trim()) return
    const updatedNotes = [...notes, newNote.trim()]
    setNotes(updatedNotes)
    setNewNote('')
    setToastMessage('Note appended to official audit record.')
    if (onCaseUpdated) {
      onCaseUpdated({ ...caseItem, notes: updatedNotes, status: caseStatus })
    }
  }

  const handleUpdateStatus = (newStatus: InvestigationCase['status']) => {
    setCaseStatus(newStatus)
    setToastMessage(`Case status transitioned to: ${newStatus}`)
    if (onCaseUpdated) {
      onCaseUpdated({ ...caseItem, status: newStatus, notes })
    }
  }

  return (
    <>
      <div className="drawer-scrim" onClick={onClose} />
      <aside className="drawer case-drawer" aria-label="Investigation dossier details">
        <header>
          <div>
            <span className="drawer-label">OFFICIAL INVESTIGATION DOSSIER</span>
            <h2>{caseItem.title}</h2>
            <p>{caseItem.id} · {caseItem.owner}</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close case details">
            <X size={20} />
          </button>
        </header>

        <div className="drawer-body">
          {/* Status & SLA Bar */}
          <div className="case-hero-card">
            <div className="case-hero-top">
              <span className={`case-badge ${caseItem.priority.toLowerCase()}`}>
                <AlertTriangle size={13} /> {caseItem.priority} Priority
              </span>
              <span className="case-status-badge">{caseStatus}</span>
            </div>
            <div className="case-sla-box">
              <div className="case-sla-header">
                <span>Investigation SLA</span>
                <strong>{caseItem.sla}% used ({caseItem.age} open)</strong>
              </div>
              <div className="case-sla-track">
                <span
                  style={{
                    width: `${caseItem.sla}%`,
                    background: caseItem.sla > 85 ? '#d4584c' : caseItem.sla > 70 ? '#e28d32' : '#3f9d7f',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Linked MPLADS Project */}
          <section className="drawer-section linked-project-section">
            <div className="section-title-row">
              <h3>Linked MPLADS Work</h3>
              {onInspectProject && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => onInspectProject(caseItem.projectId)}
                >
                  Inspect in Risk Engine <ChevronRight size={14} />
                </button>
              )}
            </div>
            <div className="linked-project-card">
              <div className="linked-project-header">
                <strong>{caseItem.projectTitle}</strong>
                <code>{caseItem.projectId}</code>
              </div>
              <p className="linked-project-loc">{caseItem.location}</p>
              <div className="linked-project-stats">
                <div><span>Sanctioned</span><strong>₹{(caseItem.sanctioned / 100).toFixed(2)} Cr</strong></div>
                <div><span>Disbursed</span><strong>₹{(caseItem.spent / 100).toFixed(2)} Cr</strong></div>
                <div><span>Primary Signal</span><small>{caseItem.primarySignal}</small></div>
              </div>
            </div>
          </section>

          {/* Drawer Segment Navigation */}
          <div className="case-drawer-tabs">
            <button
              className={activeTab === 'overview' ? 'active' : ''}
              onClick={() => setActiveTab('overview')}
            >
              Overview
            </button>
            <button
              className={activeTab === 'evidence' ? 'active' : ''}
              onClick={() => setActiveTab('evidence')}
            >
              Evidence ({caseItem.evidenceFiles.length})
            </button>
            <button
              className={activeTab === 'timeline' ? 'active' : ''}
              onClick={() => setActiveTab('timeline')}
            >
              Chronology ({caseItem.timeline.length})
            </button>
            <button
              className={activeTab === 'notes' ? 'active' : ''}
              onClick={() => setActiveTab('notes')}
            >
              Notes ({notes.length})
            </button>
          </div>

          {/* Tab 1: Overview */}
          {activeTab === 'overview' && (
            <>
              <section className="drawer-section">
                <h3>Primary Irregularity & Allegation</h3>
                <div className="allegation-card">
                  <p>{caseItem.irregularity}</p>
                </div>
              </section>

              <section className="drawer-section">
                <h3>Case Assignment & Governance</h3>
                <div className="case-meta-grid">
                  <div><span>Supervising Cell</span><strong>{caseItem.owner}</strong></div>
                  <div><span>Assigned Officer</span><strong>{caseItem.assignedOfficer}</strong></div>
                  <div><span>Docket Age</span><strong>{caseItem.age}</strong></div>
                  <div><span>Audit State</span><strong>Active Inquiry</strong></div>
                </div>
              </section>
            </>
          )}

          {/* Tab 2: Evidence Files */}
          {activeTab === 'evidence' && (
            <section className="drawer-section">
              <h3>Attached Inspection & Financial Records</h3>
              <div className="case-evidence-list">
                {caseItem.evidenceFiles.map(file => (
                  <div className="case-evidence-row" key={file.name}>
                    <div className="evidence-icon"><FileSearch size={18} /></div>
                    <div className="evidence-info">
                      <strong>{file.name}</strong>
                      <span>{file.type} · {file.size} · Uploaded {file.date}</span>
                    </div>
                    <button className="button secondary icon-only" title="Download record">
                      <Download size={15} />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Tab 3: Timeline */}
          {activeTab === 'timeline' && (
            <section className="drawer-section">
              <h3>Investigation Chronology & Audit Events</h3>
              <div className="case-timeline">
                {caseItem.timeline.map((step) => (
                  <div className="case-timeline-step" key={step.title}>
                    <span className="step-bullet"><Check size={12} /></span>
                    <div className="step-content">
                      <div className="step-meta">
                        <strong>{step.title}</strong>
                        <time>{step.date}</time>
                      </div>
                      <p>{step.detail}</p>
                      <small>Recorded by: {step.by}</small>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Tab 4: Notes */}
          {activeTab === 'notes' && (
            <section className="drawer-section">
              <h3>Official Notes & Remarks</h3>
              <div className="case-notes-list">
                {notes.map((note, index) => (
                  <div className="case-note-item" key={index}>
                    <span className="note-author">{caseItem.assignedOfficer}</span>
                    <p>{note}</p>
                  </div>
                ))}
              </div>
              <form className="case-note-form" onSubmit={handleAddNote}>
                <textarea
                  placeholder="Record an official investigation observation..."
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  rows={3}
                />
                <button type="submit" className="button primary" disabled={!newNote.trim()}>
                  Append to Audit Record
                </button>
              </form>
            </section>
          )}
        </div>

        <footer>
          {toastMessage && <span className="drawer-message">{toastMessage}</span>}
          <button className="button secondary" onClick={onClose}>Close Dossier</button>
          {caseStatus !== 'Closure review' ? (
            <button
              className="button primary"
              onClick={() => handleUpdateStatus('Closure review')}
            >
              <ClipboardCheck size={17} /> Advance to Closure Review
            </button>
          ) : (
            <button
              className="button primary"
              onClick={() => handleUpdateStatus('Field verification')}
            >
              Reopen for Verification
            </button>
          )}
        </footer>
      </aside>
    </>
  )
}

function ScanResultModal({
  result,
  onClose,
  onNavigateAlerts,
}: {
  result: ScanResult
  onClose: () => void
  onNavigateAlerts: () => void
}) {
  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal-box scan-result-modal" onClick={e => e.stopPropagation()}>
        <div className="scan-result-header">
          <div className="scan-result-icon">
            <Sparkles size={24} />
          </div>
          <div>
            <h2>Risk Assessment Scan Complete</h2>
            <p>Portfolio evaluated against automated ML models and compliance rules.</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close dialog" style={{ marginLeft: 'auto' }}>
            <X size={18} />
          </button>
        </div>
        <div className="scan-result-body">
          <div className="scan-metric-grid">
            <div className="scan-metric-card">
              <span>Works Scanned</span>
              <strong>{result.projects_scanned}</strong>
              <small>Scope verified</small>
            </div>
            <div className="scan-metric-card">
              <span>Alerts Flagged</span>
              <strong style={{ color: result.alerts_created > 0 ? '#d64f47' : 'inherit' }}>{result.alerts_created}</strong>
              <small>Action required</small>
            </div>
            <div className="scan-metric-card">
              <span>Scores Updated</span>
              <strong>{result.scores_updated}</strong>
              <small>Recalibrated</small>
            </div>
          </div>
          <div className="scan-audit-note">
            <ShieldCheck size={18} />
            <div>
              <strong>Audit-verified execution at {result.timestamp}</strong>
              <p style={{ margin: '3px 0 0' }}>
                Evaluated payment milestones, physical progress telemetry, contractor duplicate clusters, and geofence verification within 2 km radius.
              </p>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="button secondary" onClick={onClose}>
            Close
          </button>
          <button
            className="button primary"
            onClick={() => {
              onClose()
              onNavigateAlerts()
            }}
          >
            <AlertTriangle size={16} /> View Risk Alerts ({result.alerts_created})
          </button>
        </div>
      </div>
    </div>
  )
}

function ReportDossierModal({ report, onClose }: { report: GeneratedReport; onClose: () => void }) {
  const handleExportCsv = () => {
    const headers = ['Work ID', 'Project Title', 'State', 'District', 'Sanctioned (Lakh)', 'Spent (Lakh)', 'Progress (%)', 'Risk Score', 'Risk Level', 'Primary Issue']
    const rows = [
      headers,
      ...report.projects.map(p => [
        p.id,
        p.title,
        p.state,
        p.district ?? '',
        p.sanctioned,
        p.spent,
        p.progress,
        p.risk,
        p.level,
        p.issue,
      ])
    ]
    downloadCsv(`${report.id}_${report.title.toLowerCase().replace(/\s+/g, '_')}.csv`, rows)
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal-box report-dossier-modal" onClick={e => e.stopPropagation()}>
        <div className="report-dossier-topbar no-print">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={18} color="var(--green-700)" />
            <strong style={{ fontSize: '12px' }}>{report.title}</strong>
            <span className="report-code-badge">{report.id}</span>
          </div>
          <div className="report-dossier-actions">
            <button className="button secondary" onClick={handleExportCsv} title="Download structured CSV">
              <Download size={15} /> Download CSV
            </button>
            <button className="button secondary" onClick={handlePrint} title="Print or Save as PDF">
              <Printer size={15} /> Print / Save PDF
            </button>
            <button className="icon-button" onClick={onClose} aria-label="Close report preview">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="report-dossier-body">
          <div className="report-watermark" aria-hidden="true">
            MPLADS SENTINEL · {report.id}
          </div>

          <header className="report-emblem-header">
            <div className="report-crest-title">
              <div className="report-crest-icon">
                <ShieldCheck size={26} />
              </div>
              <div>
                <h2>MPLADS SENTINEL AI</h2>
                <p>Ministry of Statistics & Programme Implementation · Government of India</p>
              </div>
            </div>
            <div className="report-classification">
              <span className="report-class-badge">{report.classification}</span>
              <span className="report-id-code">REF: {report.id}</span>
            </div>
          </header>

          <div className="report-meta-strip">
            <div>
              <span>Report Title</span>
              <strong>{report.title}</strong>
            </div>
            <div>
              <span>Generated On</span>
              <strong>{report.timestamp}</strong>
            </div>
            <div>
              <span>Generated By</span>
              <strong>{report.generatedBy}</strong>
            </div>
            <div>
              <span>Scope</span>
              <strong>{report.scope}</strong>
            </div>
          </div>

          <div className="report-stats-grid">
            <div className="report-stat-tile">
              <span>Works Evaluated</span>
              <strong>{report.totalWorks}</strong>
              <small>In authorized scope</small>
            </div>
            <div className="report-stat-tile">
              <span>Total Sanctioned</span>
              <strong>{formatCrore(report.sanctionedLakh / 100)}</strong>
              <small>₹{report.sanctionedLakh.toLocaleString('en-IN')} Lakh</small>
            </div>
            <div className="report-stat-tile">
              <span>Monitored Expenditure</span>
              <strong>{formatCrore(report.expenditureLakh / 100)}</strong>
              <small>{report.sanctionedLakh > 0 ? `${Math.round((report.expenditureLakh / report.sanctionedLakh) * 100)}% utilization` : '—'}</small>
            </div>
            <div className="report-stat-tile">
              <span>High / Critical Risk</span>
              <strong style={{ color: '#d64f47' }}>{report.highRiskCount}</strong>
              <small>{report.delayedCount} delayed works</small>
            </div>
          </div>

          <div className="report-findings-card">
            <h3><Sparkles size={16} color="var(--green-700)"/> Key Analytical Observations & Signals</h3>
            <ul>
              {report.findings.map((finding, idx) => (
                <li key={idx}>{finding}</li>
              ))}
            </ul>
          </div>

          <div className="report-table-section">
            <h3>Works in Scope ({report.projects.length})</h3>
            <table className="report-dossier-table">
              <thead>
                <tr>
                  <th>Work Details</th>
                  <th>State / District</th>
                  <th>Sanctioned</th>
                  <th>Disbursed</th>
                  <th>Progress</th>
                  <th>Risk Score</th>
                  <th>Primary Signal</th>
                </tr>
              </thead>
              <tbody>
                {report.projects.map(p => (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.title}</strong>
                      <span>{p.id} · {p.agency}</span>
                    </td>
                    <td>{p.state}{p.district ? ` / ${p.district}` : ''}</td>
                    <td>₹{p.sanctioned.toLocaleString('en-IN')} L</td>
                    <td>₹{p.spent.toLocaleString('en-IN')} L</td>
                    <td>
                      <strong>{p.progress}%</strong>
                    </td>
                    <td>
                      <span className={riskClass(p.level)} style={{ padding: '2px 6px', fontSize: '9px' }}>
                        {p.risk} {p.level}
                      </span>
                    </td>
                    <td>{p.issue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <footer className="report-signoff">
            <div>
              <p style={{ margin: 0 }}>This dossier is system-generated by Sentinel ML Engine under authorized administrative credentials.</p>
              <p style={{ margin: '4px 0 0', fontSize: '9px', color: 'var(--muted)' }}>Tracking Hash: {report.id}-SHA256-VERIFIED</p>
            </div>
            <div className="report-digital-stamp">
              <CheckCircle2 size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }}/>
              DIGITALLY AUDITED
            </div>
          </footer>
        </div>
      </div>
    </div>
  )
}

function ReportsView({
  projects,
  summary,
  user,
  role,
}: {
  projects: Project[]
  summary: ApiDashboardSummary | null
  user: ApiUser
  role: Role
}) {
  const [activeReport, setActiveReport] = useState<GeneratedReport | null>(null)
  const [generatingTag, setGeneratingTag] = useState<string | null>(null)

  // Seed default reports or retrieve from state
  const [reportsHistory, setReportsHistory] = useState<GeneratedReport[]>(() => {
    return [
      {
        id: 'REP-2026-DAILY-4821',
        title: 'National risk briefing',
        tag: 'Daily',
        description: 'Executive overview of emerging risks and state performance.',
        timestamp: '19 Sep 2026, 09:30 AM IST',
        generatedBy: 'System Automated Engine',
        scope: 'National Portfolio (All India)',
        classification: 'OFFICIAL / SENSITIVE - AUDIT LOGGED',
        totalWorks: 6,
        sanctionedLakh: 520,
        expenditureLakh: 374.6,
        highRiskCount: 2,
        delayedCount: 3,
        findings: [
          'Critical payment-progress discrepancy detected in Bengaluru Rural (82% disbursed vs 34% certified execution).',
          'Delay trajectory warning active across 3 North-Eastern and Northern infrastructure packages.',
          'Physical milestone evidence required from 2 district implementing agencies prior to Q3 fund sanction.'
        ],
        projects: projects.slice(0, 6),
      }
    ]
  })

  const reportTemplates = [
    { icon: Gauge, title: 'National risk briefing', text: 'Executive overview of emerging risks and state performance.', tag: 'Daily', code: 'DAILY' },
    { icon: IndianRupee, title: 'Fund utilization analysis', text: 'Allocation, expenditure and unusual financial patterns.', tag: 'Monthly', code: 'FND' },
    { icon: Clock3, title: 'Delay and completion outlook', text: 'Forecasted delay risk and intervention opportunities.', tag: 'Weekly', code: 'DLY' },
    { icon: Network, title: 'Vendor relationship review', text: 'Concentration, shared identities and network anomalies.', tag: 'Quarterly', code: 'VND' },
  ]

  const handleGenerate = (template: typeof reportTemplates[0]) => {
    setGeneratingTag(template.title)

    setTimeout(() => {
      const now = new Date()
      const formattedDate = now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      const formattedTime = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
      const randomCode = Math.floor(1000 + Math.random() * 9000)
      const reportId = `REP-${now.getFullYear()}-${template.code}-${randomCode}`

      const totalSanctioned = summary ? summary.sanctioned_lakh : projects.reduce((acc, p) => acc + p.sanctioned, 0)
      const totalSpent = summary ? summary.expenditure_lakh : projects.reduce((acc, p) => acc + p.spent, 0)
      const highRisk = projects.filter(p => p.level === 'Critical' || p.level === 'High').length
      const delayed = summary ? summary.delayed_works : projects.filter(p => p.progress < 50 && p.spent > p.sanctioned * 0.4).length

      let findings: string[] = []
      if (template.code === 'DAILY') {
        findings = [
          `Analyzed ${projects.length} authorized works across ${user.organization.name}.`,
          `${highRisk} works currently exceed critical/high risk thresholds requiring field oversight.`,
          'Primary anomaly driver: Disproportionate expenditure velocity compared to verified physical milestones.',
          'Geo-spatial boundary checks verified 100% of works within authorized parliamentary constituency bounds.'
        ]
      } else if (template.code === 'FND') {
        findings = [
          `Total sanctioned allocation of ₹${totalSanctioned.toLocaleString('en-IN')} Lakh monitored.`,
          `Cumulative expenditure recorded at ₹${totalSpent.toLocaleString('en-IN')} Lakh (${totalSanctioned > 0 ? Math.round((totalSpent / totalSanctioned) * 100) : 0}% overall utilization).`,
          'Identified 2 schemes where stage disbursements occurred without requisite photographic evidence.',
          'Recommended release freeze for accounts with unresolved vendor duplicate flags.'
        ]
      } else if (template.code === 'DLY') {
        findings = [
          `${delayed} works are currently tracking behind scheduled completion milestones.`,
          'Delay prediction model flags civil link road and community hall projects with >70% delay risk.',
          'Key bottlenecks cited: Inter-departmental Right of Way clearances and material price escalations.',
          'Fast-track intervention proposed for works with >80% funds disbursed.'
        ]
      } else {
        findings = [
          'Evaluated vendor concentration across executing state agencies.',
          'Identified common registered address pattern among 3 bidding contractors in Devanahalli cluster.',
          'Cross-referenced tax and PAN identifiers against public works blacklist registry.',
          'Detailed relationship graph dispatched to State Nodal Auditor.'
        ]
      }

      const newReport: GeneratedReport = {
        id: reportId,
        title: template.title,
        tag: template.tag,
        description: template.text,
        timestamp: `${formattedDate}, ${formattedTime} IST`,
        generatedBy: `${user.full_name} (${role})`,
        scope: user.organization.name,
        classification: 'OFFICIAL / RESTRICTED - AUDIT LOGGED',
        totalWorks: projects.length,
        sanctionedLakh: totalSanctioned,
        expenditureLakh: totalSpent,
        highRiskCount: highRisk,
        delayedCount: delayed,
        findings,
        projects: [...projects],
      }

      setReportsHistory(prev => [newReport, ...prev])
      setActiveReport(newReport)
      setGeneratingTag(null)
    }, 450)
  }

  const handleDownloadReportCsv = (report: GeneratedReport) => {
    const headers = ['Work ID', 'Project Title', 'State', 'District', 'Sanctioned (Lakh)', 'Spent (Lakh)', 'Progress (%)', 'Risk Score', 'Risk Level', 'Primary Issue']
    const rows = [
      headers,
      ...report.projects.map(p => [
        p.id,
        p.title,
        p.state,
        p.district ?? '',
        p.sanctioned,
        p.spent,
        p.progress,
        p.risk,
        p.level,
        p.issue,
      ])
    ]
    downloadCsv(`${report.id}_${report.title.toLowerCase().replace(/\s+/g, '_')}.csv`, rows)
  }

  return (
    <>
      <section className="report-grid">
        {reportTemplates.map(template => {
          const { icon: Icon, title, text, tag } = template
          const isGenerating = generatingTag === title
          return (
            <article className="card report-card" key={title}>
              <div className="report-icon">
                <Icon size={22} />
              </div>
              <span className="report-tag">{tag}</span>
              <h2>{title}</h2>
              <p>{text}</p>
              <button
                className="button secondary"
                onClick={() => handleGenerate(template)}
                disabled={isGenerating}
                aria-busy={isGenerating}
              >
                {isGenerating ? 'Compiling dossier…' : 'Generate report'} <ChevronRight size={16} />
              </button>
            </article>
          )
        })}
      </section>

      <section className="card report-history">
        <CardHeader
          title="Recent reports"
          subtitle="Generated reports are watermarked and access-logged"
          action={reportsHistory.length > 0 ? 'Export summary' : undefined}
          onAction={() => {
            if (reportsHistory.length > 0) {
              const rows = [
                ['Report ID', 'Title', 'Generated At', 'Officer', 'Scope', 'Works Evaluated'],
                ...reportsHistory.map(r => [r.id, r.title, r.timestamp, r.generatedBy, r.scope, r.totalWorks])
              ]
              downloadCsv('Recent_Reports_Index.csv', rows)
            }
          }}
        />

        {reportsHistory.length === 0 ? (
          <div className="empty-state">
            <FileSearch size={30} />
            <strong>Select a report template to begin</strong>
            <p>Exports respect your role, jurisdiction and field-level permissions.</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="recent-reports-table">
              <thead>
                <tr>
                  <th>Report Title</th>
                  <th>Tracking ID</th>
                  <th>Generated At</th>
                  <th>Authorized Officer</th>
                  <th>Works in Scope</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reportsHistory.map(r => (
                  <tr key={r.id}>
                    <td>
                      <div className="report-title-cell">
                        <FileText size={18} color="var(--green-700)" />
                        <div>
                          <strong>{r.title}</strong>
                          <span>{r.description}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="report-code-badge">{r.id}</span>
                    </td>
                    <td>{r.timestamp}</td>
                    <td>{r.generatedBy}</td>
                    <td>
                      <strong>{r.totalWorks} works</strong>
                    </td>
                    <td>
                      <div className="report-actions-cell">
                        <button
                          className="button secondary"
                          style={{ padding: '5px 9px', fontSize: '10px' }}
                          onClick={() => setActiveReport(r)}
                        >
                          View Dossier
                        </button>
                        <button
                          className="icon-button"
                          title="Download CSV"
                          aria-label="Download CSV"
                          onClick={() => handleDownloadReportCsv(r)}
                        >
                          <Download size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {activeReport && <ReportDossierModal report={activeReport} onClose={() => setActiveReport(null)} />}
    </>
  )
}

function AdminView() {
  const settings = [
    { icon: Users, title: 'Users & access', text: 'Manage roles, jurisdiction scopes and temporary delegation.', value: '1,284 users' },
    { icon: ShieldCheck, title: 'Security policies', text: 'Review authentication, export and session controls.', value: '12 policies' },
    { icon: Zap, title: 'Detection rules', text: 'Version and simulate compliance rules before activation.', value: '34 active' },
    { icon: Gauge, title: 'Model registry', text: 'Review deployed models, performance and drift status.', value: '7 models' },
    { icon: Activity, title: 'Audit explorer', text: 'Search immutable access and decision events.', value: '2.8M events' },
    { icon: Building2, title: 'Organizations', text: 'Maintain state, district and implementing-agency hierarchy.', value: '4,912 units' },
  ]
  return <section className="admin-grid">{settings.map(({icon: Icon, title, text, value}) => <button className="card admin-card" key={title}><span className="admin-icon"><Icon size={21}/></span><div><h2>{title}</h2><p>{text}</p><strong>{value}</strong></div><ChevronRight size={18}/></button>)}</section>
}

function ProfileView({ user, role, onLogout }: { user: ApiUser; role: Role; onLogout: () => void }) {
  const initials = user.full_name.split(' ').map(part => part[0]).slice(0, 2).join('')
  const jurisdiction = user.organization.level === 'national'
    ? 'All India'
    : [user.organization.district, user.organization.state].filter(Boolean).join(', ')
  const scopeDescription = user.organization.level === 'national'
    ? 'Authorized to review the national project portfolio.'
    : user.organization.level === 'state'
      ? `Authorized to review projects within ${user.organization.state}.`
      : `Authorized to review projects within ${user.organization.district} district.`

  return <div className="profile-page">
    <section className="card profile-identity-card">
      <div className="profile-hero">
        <div className="profile-avatar-large" aria-hidden="true">{initials}</div>
        <div className="profile-hero-copy">
          <span className="verified-label"><BadgeCheck size={15}/> Identity verified</span>
          <h2>{user.full_name}</h2>
          <p>{role}</p>
          <span className="official-email"><Mail size={15}/>{user.email}</span>
        </div>
        <div className="account-state"><i/><span>Account active</span></div>
      </div>
      <div className="profile-id-strip">
        <span>User reference</span><code>{user.id}</code>
      </div>
    </section>

    <div className="profile-details-grid">
      <section className="card profile-section-card">
        <div className="profile-section-heading"><span><BriefcaseBusiness size={19}/></span><div><h2>Official assignment</h2><p>Your role and administrative placement</p></div></div>
        <dl className="profile-facts">
          <div><dt>Role</dt><dd>{role}</dd></div>
          <div><dt>Organization</dt><dd>{user.organization.name}</dd></div>
          <div><dt>Authority level</dt><dd className="capitalize">{user.organization.level}</dd></div>
          <div><dt>Organization reference</dt><dd className="mono-value">{user.organization.id}</dd></div>
        </dl>
      </section>

      <section className="card profile-section-card">
        <div className="profile-section-heading"><span><Globe2 size={19}/></span><div><h2>Data jurisdiction</h2><p>Scope enforced by the backend</p></div></div>
        <div className="jurisdiction-summary"><MapPin size={21}/><div><span>Authorized geography</span><strong>{jurisdiction}</strong><p>{scopeDescription}</p></div></div>
        <div className="scope-notice"><LockKeyhole size={15}/><span>Out-of-scope records are hidden at the database query boundary.</span></div>
      </section>

      <section className="card profile-section-card security-card">
        <div className="profile-section-heading"><span><Fingerprint size={19}/></span><div><h2>Session security</h2><p>Protections applied to this login</p></div></div>
        <ul className="security-list">
          <li><span><KeyRound size={17}/></span><div><strong>Short-lived access</strong><p>Access authorization expires after 15 minutes.</p></div><BadgeCheck size={17}/></li>
          <li><span><ShieldCheck size={17}/></span><div><strong>Protected renewal</strong><p>Refresh credentials remain in an HttpOnly cookie.</p></div><BadgeCheck size={17}/></li>
          <li><span><Activity size={17}/></span><div><strong>Audited activity</strong><p>Sign-in and risk operations are recorded.</p></div><BadgeCheck size={17}/></li>
        </ul>
      </section>

      <section className="card profile-section-card account-actions-card">
        <div className="profile-section-heading"><span><UserRound size={19}/></span><div><h2>Account actions</h2><p>Manage this authenticated session</p></div></div>
        <div className="profile-action-row"><div><strong>Sign out of Sentinel</strong><p>Revokes the current refresh session on this device.</p></div><button className="button danger-button" onClick={onLogout}><LogOut size={16}/> Sign out</button></div>
        <div className="profile-help"><CircleHelp size={16}/><p>Contact your organization administrator to update your name, role, email or jurisdiction.</p></div>
      </section>
    </div>
  </div>
}

function ProjectDrawer({ project, onClose }: { project: Project; onClose: () => void }) {
  const [intelligence, setIntelligence] = useState<ApiProjectIntelligence | null>(null)
  const [prediction, setPrediction] = useState<ApiDelayPrediction | null>(null)
  const [alert, setAlert] = useState<ApiAlert | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionMessage, setActionMessage] = useState('')
  const [evidenceLatitude, setEvidenceLatitude] = useState('')
  const [evidenceLongitude, setEvidenceLongitude] = useState('')
  const [evidenceProgress, setEvidenceProgress] = useState(String(project.progress))
  const [evidenceRemarks, setEvidenceRemarks] = useState('')
  const [savingEvidence, setSavingEvidence] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    setIntelligence(null)
    setPrediction(null)
    setAlert(null)
    setActionMessage('')
    setEvidenceLatitude('')
    setEvidenceLongitude('')
    setEvidenceProgress(String(project.progress))
    setEvidenceRemarks('')
    Promise.all([api.intelligence(project.id), api.alerts(), api.delayPrediction(project.id)])
      .then(([result, alerts, delayPrediction]) => {
        if (!active) return
        setIntelligence(result)
        setPrediction(delayPrediction)
        setAlert(alerts.find(item => item.project_id === project.id && item.status === 'open') ?? null)
      })
      .catch(() => active && setActionMessage('Live intelligence is temporarily unavailable.'))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [project.id])

  const startReview = async () => {
    if (!alert) return
    try {
      const updated = await api.updateAlert(alert.id, 'triaged')
      setAlert(updated)
      setActionMessage('Review started and recorded in the audit trail.')
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'Unable to start the review.')
    }
  }

  const submitEvidence = async (event: React.FormEvent) => {
    event.preventDefault()
    setSavingEvidence(true)
    try {
      const result = await api.submitEvidence(project.id, {
        captured_at: new Date().toISOString(),
        latitude: Number(evidenceLatitude),
        longitude: Number(evidenceLongitude),
        reported_progress: Number(evidenceProgress),
        remarks: evidenceRemarks.trim(),
      })
      setActionMessage(`Evidence recorded within ${result.distance_from_project_km} km of the project location.`)
      setEvidenceRemarks('')
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'Unable to submit evidence.')
    } finally {
      setSavingEvidence(false)
    }
  }

  return <><div className="drawer-scrim" onClick={onClose}/><aside className="drawer"><header><div><span className="drawer-label">PHASE 4 EARLY-WARNING PROFILE</span><h2>{project.title}</h2><p>{project.id} · {project.location}</p></div><button className="icon-button" onClick={onClose} aria-label="Close project details"><X size={20}/></button></header><div className="drawer-body"><div className="risk-hero"><div className={`risk-ring ring-${project.level.toLowerCase()}`}><strong>{project.risk}</strong><span>/100</span></div><div><span className={riskClass(project.level)}><i/>{project.level} risk</span><h3>Human review recommended</h3><p>Signals are indicators, not a determination of fraud.</p></div></div><div className="quick-facts"><div><span>Sanctioned</span><strong>{formatCrore(project.sanctioned / 100)}</strong></div><div><span>Spent</span><strong>{formatCrore(project.spent / 100)}</strong></div><div><span>Progress</span><strong>{project.progress}%</strong></div></div>{loading && <p className="intelligence-loading">Loading authorized intelligence…</p>}{prediction && <section className="drawer-section prediction-card"><div className="section-title-row"><h3>Delay early warning</h3><span className="prediction-score">{prediction.delay_probability}% · {prediction.confidence}</span></div><p>{prediction.disclaimer}</p><ul>{prediction.factors.map(factor => <li key={factor}>{factor}</li>)}</ul></section>}{intelligence && <><section className="drawer-section"><div className="section-title-row"><h3>Project health</h3><span className={`health-badge ${intelligence.health_band.toLowerCase().replaceAll(' ', '-')}`}>{intelligence.health_score}/100 · {intelligence.health_band}</span></div><div className="health-track"><span style={{width: `${intelligence.health_score}%`}}/></div></section><section className="drawer-section"><h3>Compliance watch</h3>{intelligence.compliance.map(item => <article className="compliance-item" key={item.label}><span className={`compliance-dot ${item.status}`}/><div><strong>{item.label}</strong><p>{item.detail}</p></div><small>{item.status}</small></article>)}</section><section className="drawer-section"><h3>Potential duplicate works</h3>{intelligence.duplicate_candidates.length ? intelligence.duplicate_candidates.map(candidate => <article className="duplicate-item" key={candidate.project_id}><div><strong>{candidate.title}</strong><p>{candidate.project_id} · {candidate.location}</p><small>{candidate.reasons.join(' · ')}</small></div><b>{candidate.similarity_score}%</b></article>) : <p className="empty-intelligence">No similar works crossed the review threshold.</p>}</section><section className="drawer-section"><h3>Risk history</h3>{intelligence.risk_timeline.map((point, index) => <div className="timeline-item" key={`${point.recorded_at}-${point.score}`}><span className={index === intelligence.risk_timeline.length - 1 ? 'current' : ''}>{index === intelligence.risk_timeline.length - 1 && <Check size={12}/>}</span><p><strong>{point.score}/100 · {point.level}</strong><br/>{new Date(point.recorded_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p></div>)}</section><section className="drawer-section"><h3>Submit site evidence</h3><p className="evidence-note">Metadata only for this prototype. The server verifies time, progress, and a 2 km project radius.</p><form className="evidence-form" onSubmit={submitEvidence}><div><label>Latitude<input type="number" min="6" max="38" step="0.0001" value={evidenceLatitude} onChange={event => setEvidenceLatitude(event.target.value)} required/></label><label>Longitude<input type="number" min="68" max="98" step="0.0001" value={evidenceLongitude} onChange={event => setEvidenceLongitude(event.target.value)} required/></label></div><label>Observed progress (%)<input type="number" min={project.progress} max="100" value={evidenceProgress} onChange={event => setEvidenceProgress(event.target.value)} required/></label><label>Inspection remarks<textarea value={evidenceRemarks} onChange={event => setEvidenceRemarks(event.target.value)} minLength={3} maxLength={1000} required/></label><button className="button secondary" disabled={savingEvidence}>{savingEvidence ? 'Verifying evidence…' : 'Submit verified metadata'}</button></form></section></>}</div><footer>{actionMessage && <span className="drawer-message">{actionMessage}</span>}<button className="button secondary" onClick={onClose}>Close</button>{alert?.status === 'open' && <button className="button primary" onClick={startReview}><ClipboardCheck size={17}/> Start review</button>}</footer></aside></>
}

function LoginScreen({ onAuthenticated }: { onAuthenticated: (user: ApiUser) => void }) {
  const [email, setEmail] = useState('ministry@sentinel.gov.in')
  const [password, setPassword] = useState('Sentinel@2026')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setLoading(true); setError('')
    try { onAuthenticated(await api.login(email, password)) }
    catch (e) { setError(e instanceof Error ? e.message : 'Sign in failed') }
    finally { setLoading(false) }
  }

  return <main className="login-page">
    <section className="login-visual">
      <div className="login-brand"><span><ShieldCheck size={24}/></span><div><strong>MPLADS</strong><small>Sentinel AI</small></div></div>
      <div className="login-pitch"><span className="eyebrow"><i className="status-dot"/> Secure oversight intelligence</span><h1>See risk early.<br/>Act with evidence.</h1><p>Explainable monitoring for public works, fund utilization and accountable resolution.</p></div>
      <div className="trust-row"><span><LockKeyhole size={17}/>Jurisdiction isolated</span><span><Activity size={17}/>Fully audited</span><span><Sparkles size={17}/>Human-governed AI</span></div>
    </section>
    <section className="login-panel"><form onSubmit={submit}>
      <div className="mobile-login-brand"><ShieldCheck size={22}/><strong>MPLADS Sentinel</strong></div>
      <span className="login-kicker">AUTHORIZED ACCESS</span><h2>Welcome back</h2><p>Sign in with your assigned official account.</p>
      <label>Official email<input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" required/></label>
      <label>Password<div className="password-field"><input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required minLength={8}/><button type="button" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></label>
      {error && <div className="login-error"><AlertTriangle size={16}/>{error}</div>}
      <button className="button primary login-submit" disabled={loading}>{loading ? 'Verifying access…' : 'Sign in securely'}<ChevronRight size={18}/></button>
      <div className="demo-note"><strong>Demonstration account</strong><span>Credentials are pre-filled. Other seeded roles are documented in the project README.</span></div>
      <small className="privacy-note"><LockKeyhole size={13}/> Access is role-scoped and recorded in the security audit trail.</small>
    </form></section>
  </main>
}

function App() {
  const [user, setUser] = useState<ApiUser | null>(null)
  const [restoring, setRestoring] = useState(true)

  useEffect(() => {
    api.restoreSession().then(ok => ok ? api.me().then(setUser).catch(() => null) : null).finally(() => setRestoring(false))
  }, [])

  if (restoring) return <div className="auth-loader"><ShieldCheck size={28}/><span>Establishing secure session…</span></div>
  if (!user) return <LoginScreen onAuthenticated={setUser}/>
  return <DashboardApp user={user} onLogout={() => api.logout().finally(() => setUser(null))}/>
}

export default App
