import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity, AlertTriangle, BarChart3, Bell,
  Building2, CalendarDays, Check, ChevronDown, ChevronRight, CircleHelp,
  ClipboardCheck, Clock3, Download, FileSearch, Filter, FolderKanban, Gauge,
  IndianRupee, LayoutDashboard, LockKeyhole, Map, Menu, Moon,
  Network, PanelLeftClose, Search, Settings, ShieldCheck, Sparkles, Sun,
  Users, X, Zap, LogOut, Eye, EyeOff, UserRound, Mail, MapPin, Fingerprint,
  KeyRound, BadgeCheck, Globe2, BriefcaseBusiness,
} from 'lucide-react'
import { activity, type Project, type RiskLevel } from './data'
import { api, type ApiAlert, type ApiDashboardSummary, type ApiDelayPrediction, type ApiProject, type ApiProjectIntelligence, type ApiUser } from './api'

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
})

function DashboardApp({ user, onLogout }: { user: ApiUser; onLogout: () => void }) {
  const [page, setPage] = useState<Page>('overview')
  const role = roleLabels[user.role]
  const [projectData, setProjectData] = useState<Project[]>([])
  const [summary, setSummary] = useState<ApiDashboardSummary | null>(null)
  const [scanMessage, setScanMessage] = useState('')
  const [scanning, setScanning] = useState(false)
  const [dark, setDark] = useState(() => {
    const savedTheme = localStorage.getItem('sentinel-theme')
    return savedTheme ? savedTheme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  const [collapsed, setCollapsed] = useState(false)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Project | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

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
      setScanMessage(`${result.projects_scanned} works scanned · ${result.alerts_created} new alerts`)
    } catch (error) {
      setScanMessage(error instanceof Error ? error.message : 'Risk scan failed')
    } finally {
      setScanning(false)
    }
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
          <button className="icon-button mobile-toggle" onClick={() => setMobileMenu(true)} aria-label="Open navigation"><Menu size={21} /></button>
          <div className="global-search">
            <Search size={18} />
            <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search work ID, district, agency or vendor…" aria-label="Global search" />
            <kbd>⌘ K</kbd>
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
              <button className="button secondary"><Download size={17} /> Export view</button>
              <button className="button primary" onClick={runScan} disabled={scanning} aria-busy={scanning}><Sparkles size={17} /> {scanning ? 'Scanning…' : 'Run risk scan'}</button>
            </div>}
          </div>

          {scanMessage && <div className="system-message"><ShieldCheck size={16}/>{scanMessage}<button onClick={() => setScanMessage('')}><X size={15}/></button></div>}

          {page === 'overview' && <Overview projects={filtered} summary={summary} onSelect={setSelected} />}
          {page === 'alerts' && <AlertsView projects={filtered} onSelect={setSelected} />}
          {page === 'projects' && <ProjectsView projects={filtered} onSelect={setSelected} />}
          {page === 'map' && <MapView projects={filtered} onSelect={setSelected} />}
          {page === 'cases' && <CasesView />}
          {page === 'reports' && <ReportsView projects={filtered} />}
          {page === 'admin' && <AdminView />}
          {page === 'profile' && <ProfileView user={user} role={role} onLogout={onLogout} />}
        </div>
      </main>

      {selected && <ProjectDrawer project={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

// pageDescriptions moved above DashboardApp for correct declaration order

function Overview({ projects, summary, onSelect }: { projects: Project[]; summary: ApiDashboardSummary | null; onSelect: (p: Project) => void }) {
  const utilization = summary && summary.sanctioned_lakh > 0
    ? `${Math.round(summary.expenditure_lakh / summary.sanctioned_lakh * 100)}%`
    : '—'
  return <>
    <section className="metrics-grid">
      <Metric icon={FolderKanban} label="Active works" value={summary ? summary.active_works.toLocaleString('en-IN') : '—'} delta={summary ? String(summary.delayed_works) : '—'} note="delayed works in your scope" color="teal" />
      <Metric icon={IndianRupee} label="Expenditure monitored" value={summary ? formatCrore(summary.expenditure_lakh / 100) : '—'} delta={utilization} note={summary ? `of ${formatCrore(summary.sanctioned_lakh / 100)} sanctioned` : 'loading authorized portfolio'} color="blue" />
      <Metric icon={AlertTriangle} label="High-risk works" value={summary ? summary.high_risk_works.toLocaleString('en-IN') : '—'} delta={summary ? String(summary.open_alerts) : '—'} note="open alerts requiring review" color="red" />
      <Metric icon={Clock3} label="Delayed works" value={summary ? summary.delayed_works.toLocaleString('en-IN') : '—'} delta={summary ? String(summary.active_works) : '—'} note="active works assessed" color="amber" />
    </section>

    <section className="dashboard-grid">
      <div className="card risk-trend-card">
        <CardHeader title="Risk intelligence trend" subtitle="Detected vs. resolved signals · last 6 months" action="View analytics" />
        <TrendChart projects={projects} />
      </div>
      <div className="card map-card">
        <CardHeader title="National risk distribution" subtitle="Live project-risk concentration" action="Open map" />
        <RiskMap projects={projects} onSelect={onSelect} />
        <div className="map-legend"><span><i className="legend critical" />Critical</span><span><i className="legend high" />High</span><span><i className="legend moderate" />Moderate</span><span><i className="legend low" />Low</span></div>
      </div>
    </section>

    <section className="dashboard-grid lower-grid">
      <div className="card alerts-card">
        <CardHeader title="Priority alerts" subtitle="Ranked by risk, confidence and potential impact" action="View all 482" />
        <ProjectTable projects={projects.slice(0, 4)} onSelect={onSelect} compact />
      </div>
      <div className="card activity-card">
        <CardHeader title="Live activity" subtitle="Latest actions across the platform" />
        <div className="activity-list">
          {activity.map(item => <div className="activity-item" key={item.title}><span className={`activity-icon ${item.tone}`}><Activity size={15} /></span><div><strong>{item.title}</strong><p>{item.meta}</p></div><time>{item.time}</time></div>)}
        </div>
        <button className="text-button full">View complete audit activity <ChevronRight size={15} /></button>
      </div>
    </section>

    <section className="card state-card">
      <CardHeader title="State performance watch" subtitle="Relative risk based on active work portfolio" action="Compare all states" />
      <div className="state-list">
        {Object.values(projects.reduce<Record<string, { name: string; projects: number; highRisk: number; score: number }>>((groups, project) => {
          const item = groups[project.state] ?? { name: project.state, projects: 0, highRisk: 0, score: 0 }
          item.projects += 1; item.highRisk += project.level === 'Critical' || project.level === 'High' ? 1 : 0; item.score += project.risk
          groups[project.state] = item; return groups
        }, {})).sort((a, b) => (b.score / b.projects) - (a.score / a.projects)).map((state, i) => <div className="state-row" key={state.name}><span className="rank">{String(i + 1).padStart(2, '0')}</span><div className="state-name"><strong>{state.name}</strong><span>{state.projects.toLocaleString('en-IN')} authorized works</span></div><div className="bar-track"><span style={{ width: `${Math.round(state.score / state.projects)}%` }} /></div><strong className="risk-number">{state.highRisk}</strong><span className="muted-label">high risk</span><ChevronRight size={17} /></div>)}
      </div>
    </section>
  </>
}

function Metric({ icon: Icon, label, value, delta, note, color }: { icon: typeof Gauge; label: string; value: string; delta: string; note: string; color: string }) {
  return <article className="metric card"><div className={`metric-icon ${color}`}><Icon size={20} /></div><div className="metric-top"><span>{label}</span><CircleHelp size={14} /></div><div className="metric-value">{value}</div><div className="metric-foot"><span className="delta neutral">{delta}</span><span>{note}</span></div></article>
}

function CardHeader({ title, subtitle, action }: { title: string; subtitle: string; action?: string }) {
  return <div className="card-header"><div><h2>{title}</h2><p>{subtitle}</p></div>{action && <button className="text-button">{action}<ChevronRight size={15} /></button>}</div>
}

function TrendChart({ projects }: { projects: Project[] }) {
  const bands: RiskLevel[] = ['Low', 'Moderate', 'High', 'Critical']
  const values = bands.map(level => projects.filter(project => project.level === level).length)
  const max = Math.max(1, ...values)
  return <div className="chart-wrap"><div className="chart-legend"><span><i className="dot detected" />Live risk distribution</span><b>{projects.length} authorized works</b></div><svg viewBox="0 0 520 190" role="img" aria-label="Live project risk distribution"><defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#df6b58" stopOpacity=".28"/><stop offset="1" stopColor="#df6b58" stopOpacity="0"/></linearGradient></defs>{[40,80,120,160].map(y => <line key={y} x1="42" x2="478" y1={y} y2={y} className="grid-line"/>)}{bands.map((band, i) => { const height = values[i] / max * 118; const x = 70 + i * 105; return <g key={band}><rect x={x} y={160 - height} width="52" height={height} rx="7" fill={band === 'Critical' ? '#d4584c' : band === 'High' ? '#df8d37' : band === 'Moderate' ? '#d8a42e' : '#3f9d7f'}/><text x={x + 26} y="183" textAnchor="middle">{band}</text><text x={x + 26} y={151 - height} textAnchor="middle">{values[i]}</text></g>})}</svg></div>
}

function RiskMap({ projects, onSelect }: { projects: Project[]; onSelect: (p: Project) => void }) {
  return <div className="india-map"><div className="map-shape shape-one"/><div className="map-shape shape-two"/><div className="map-shape shape-three"/><div className="map-shape shape-four"/>{projects.map(p => <button key={p.id} className={`map-pin pin-${p.level.toLowerCase()}`} style={{ left: `${p.lng}%`, top: `${p.lat}%` }} onClick={() => onSelect(p)} aria-label={`${p.title}, ${p.level} risk`}><span/><b>{p.risk}</b></button>)}<div className="map-summary"><span>National risk index</span><strong>58.4</strong><small>Moderate · improving</small></div></div>
}

function ProjectTable({ projects, onSelect, compact = false }: { projects: Project[]; onSelect: (p: Project) => void; compact?: boolean }) {
  return <div className="table-scroll"><table><thead><tr><th>Work</th><th>Risk</th>{!compact && <th>Sanctioned</th>}<th>Progress</th><th>Primary signal</th><th /></tr></thead><tbody>{projects.map(p => <tr key={p.id} onClick={() => onSelect(p)}><td><strong>{p.title}</strong><span>{p.id} · {p.location}</span></td><td><span className={riskClass(p.level)}><i />{p.risk} {p.level}</span></td>{!compact && <td><strong>{formatCrore(p.sanctioned / 100)}</strong><span>{formatCrore(p.spent / 100)} spent</span></td>}<td><div className="progress-cell"><div><span style={{ width: `${p.progress}%` }}/></div><b>{p.progress}%</b></div></td><td className="issue-cell">{p.issue}</td><td><button className="row-action" aria-label={`Open ${p.title}`}><ChevronRight size={17}/></button></td></tr>)}</tbody></table></div>
}

function Toolbar({ searchPlaceholder = 'Search this view…' }: { searchPlaceholder?: string }) {
  return <div className="toolbar"><div className="local-search"><Search size={17}/><input placeholder={searchPlaceholder}/></div><button className="button secondary"><Filter size={16}/> Filters <span className="filter-count">3</span></button><button className="button secondary"><CalendarDays size={16}/> Last 30 days</button></div>
}

function AlertsView({ projects, onSelect }: { projects: Project[]; onSelect: (p: Project) => void }) {
  return <><div className="segment-tabs"><button className="active">All alerts <b>482</b></button><button>Critical <b>31</b></button><button>High <b>126</b></button><button>Assigned to me <b>8</b></button><button>Awaiting response <b>17</b></button></div><section className="card data-card"><Toolbar searchPlaceholder="Search alert, work or district…"/><ProjectTable projects={projects} onSelect={onSelect}/></section></>
}

function ProjectsView({ projects, onSelect }: { projects: Project[]; onSelect: (p: Project) => void }) {
  return <><section className="mini-stats"><div><span>All works</span><strong>18,420</strong></div><div><span>In progress</span><strong>11,864</strong></div><div><span>Delayed</span><strong>2,184</strong></div><div><span>Completed this FY</span><strong>4,372</strong></div></section><section className="card data-card"><Toolbar searchPlaceholder="Search work ID, title or agency…"/><ProjectTable projects={projects} onSelect={onSelect}/></section></>
}

function MapView({ projects, onSelect }: { projects: Project[]; onSelect: (p: Project) => void }) {
  const [visibleLevels, setVisibleLevels] = useState<RiskLevel[]>(['Critical', 'High', 'Moderate', 'Low'])
  const [message, setMessage] = useState('Select a pin to open its verified project intelligence.')
  const visible = projects.filter(project => visibleLevels.includes(project.level))
  const toggle = (level: RiskLevel) => setVisibleLevels(current => current.includes(level) ? current.filter(item => item !== level) : [...current, level])
  return <section className="map-page"><aside className="map-panel card"><h2>Live intelligence layers</h2><p>Map pins are plotted from authorized project coordinates, not sample locations.</p>{(['Critical', 'High', 'Moderate', 'Low'] as RiskLevel[]).map(level => <label key={level}><input type="checkbox" checked={visibleLevels.includes(level)} onChange={() => toggle(level)}/><span>{level} risk works</span><small>{projects.filter(project => project.level === level).length}</small></label>)}<div className="panel-separator"/><h3>Visible portfolio</h3><button className="select-like">{visible.length} of {projects.length} works <ChevronDown size={15}/></button><button className="button primary full-button" onClick={() => setMessage(`${visible.length} works visible · ${visible.filter(project => project.level === 'Critical' || project.level === 'High').length} require priority review.`)}><FileSearch size={17}/> Analyze visible area</button></aside><div className="card large-map"><div className="map-toolbar"><button className="active">Risk</button><span/><button><Filter size={16}/> Live filters</button></div><RiskMap projects={visible} onSelect={onSelect}/><div className="map-insight"><Zap size={17}/><div><strong>Spatial intelligence</strong><p>{message}</p></div></div></div></section>
}

function CasesView() {
  const cases = [
    { id: 'CASE-2026-0184', title: 'Payment–progress discrepancy', owner: 'Karnataka State Review Cell', status: 'Field verification', age: '4 days', sla: 68 },
    { id: 'CASE-2026-0171', title: 'Unusual cost benchmark deviation', owner: 'Uttar Pradesh Audit Unit', status: 'Evidence requested', age: '7 days', sla: 84 },
    { id: 'CASE-2026-0168', title: 'Possible duplicate school work', owner: 'Maharashtra Nodal Authority', status: 'Under review', age: '9 days', sla: 92 },
  ]
  return <><section className="workflow-strip">{['New', 'Triaged', 'Evidence requested', 'Verification', 'Closure review'].map((x, i) => <div key={x}><span>{[31,18,17,12,6][i]}</span><strong>{x}</strong>{i < 4 && <ChevronRight size={17}/>}</div>)}</section><section className="card case-list"><CardHeader title="Active investigations" subtitle="Cases requiring action, ordered by service-level risk" action="View case register"/>{cases.map(c => <article className="case-row" key={c.id}><div className="case-icon"><ClipboardCheck size={19}/></div><div className="case-main"><span>{c.id}</span><strong>{c.title}</strong><p>{c.owner}</p></div><div className="case-status"><span>{c.status}</span><small>Open for {c.age}</small></div><div className="sla"><div><span style={{ width: `${c.sla}%` }}/></div><small>SLA {c.sla}% used</small></div><button className="row-action"><ChevronRight size={18}/></button></article>)}</section></>
}

function ReportsView({ projects }: { projects: Project[] }) {
  const [generated, setGenerated] = useState<string[]>([])
  const download = (title: string) => {
    const rows = [['Project ID', 'Title', 'State', 'District', 'Risk score', 'Risk level', 'Sanctioned lakh', 'Spent lakh', 'Progress %', 'Primary signal'], ...projects.map(project => [project.id, project.title, project.state, project.district, String(project.risk), project.level, String(project.sanctioned), String(project.spent), String(project.progress), project.issue])]
    const csv = rows.map(row => row.map(value => `"${value.replaceAll('"', '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); const link = document.createElement('a'); link.href = url; link.download = `${title.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}-portfolio.csv`; link.click(); URL.revokeObjectURL(url)
    setGenerated(current => [title, ...current.filter(item => item !== title)])
  }
  const reports = [
    { icon: Gauge, title: 'National risk briefing', text: 'Executive overview of emerging risks and state performance.', tag: 'Daily' },
    { icon: IndianRupee, title: 'Fund utilization analysis', text: 'Allocation, expenditure and unusual financial patterns.', tag: 'Monthly' },
    { icon: Clock3, title: 'Delay and completion outlook', text: 'Forecasted delay risk and intervention opportunities.', tag: 'Weekly' },
    { icon: Network, title: 'Vendor relationship review', text: 'Concentration, shared identities and network anomalies.', tag: 'Quarterly' },
  ]
  return <><section className="report-grid">{reports.map(({icon: Icon, title, text, tag}) => <article className="card report-card" key={title}><div className="report-icon"><Icon size={22}/></div><span className="report-tag">{tag}</span><h2>{title}</h2><p>{text}</p><button className="button secondary" onClick={() => download(title)}>Download CSV <Download size={16}/></button></article>)}</section><section className="card report-history"><CardHeader title="Generated reports" subtitle="Exports contain only your currently authorized project portfolio"/>{generated.length ? <div className="activity-list">{generated.map(title => <div className="activity-item" key={title}><span className="activity-icon teal"><Download size={15}/></span><div><strong>{title}</strong><p>CSV export generated from {projects.length} live, authorized project records.</p></div><time>Just now</time></div>)}</div> : <div className="empty-state"><FileSearch size={30}/><strong>Select a report template to begin</strong><p>Exports respect your role and jurisdiction.</p></div>}</section></>
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
