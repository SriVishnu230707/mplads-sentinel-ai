import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, BarChart3, Bell,
  Building2, CalendarDays, Check, ChevronDown, ChevronRight, CircleHelp,
  ClipboardCheck, Clock3, Download, FileSearch, Filter, FolderKanban, Gauge,
  IndianRupee, LayoutDashboard, LockKeyhole, Map, Menu, Moon,
  Network, PanelLeftClose, Search, Settings, ShieldCheck, Sparkles, Sun,
  Users, X, Zap, LogOut, Eye, EyeOff,
} from 'lucide-react'
import { activity, projects as demoProjects, states, trend, type Project, type RiskLevel } from './data'
import { api, type ApiProject, type ApiUser } from './api'

type Page = 'overview' | 'alerts' | 'projects' | 'map' | 'cases' | 'reports' | 'admin'
type Role = 'Ministry National Supervisor' | 'State Nodal Authority' | 'District Authority' | 'Auditor / Investigator'

const nav: { id: Page; label: string; icon: typeof LayoutDashboard; count?: number }[] = [
  { id: 'overview', label: 'Command centre', icon: LayoutDashboard },
  { id: 'alerts', label: 'Risk alerts', icon: AlertTriangle, count: 31 },
  { id: 'projects', label: 'Works & projects', icon: FolderKanban },
  { id: 'map', label: 'Map intelligence', icon: Map },
  { id: 'cases', label: 'Investigations', icon: ClipboardCheck, count: 8 },
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
  const [projectData, setProjectData] = useState<Project[]>(demoProjects)
  const [scanMessage, setScanMessage] = useState('')
  const [dark, setDark] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Project | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // Sync dark mode with <html> so body/viewport background matches
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
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

  const loadProjects = async () => {
    const result = await api.projects()
    setProjectData(result.map(toProject))
  }

  useEffect(() => { loadProjects().catch(() => setScanMessage('API unavailable — showing demonstration data')) }, [])

  const runScan = async () => {
    setScanMessage('Scanning authorized portfolio…')
    try {
      const result = await api.scan()
      await loadProjects()
      setScanMessage(`${result.projects_scanned} works scanned · ${result.alerts_created} new alerts`)
    } catch (error) { setScanMessage(error instanceof Error ? error.message : 'Risk scan failed') }
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
            return (
              <button key={item.id} className={page === item.id ? 'nav-item active' : 'nav-item'} onClick={() => { setPage(item.id); setMobileMenu(false) }} title={collapsed ? item.label : undefined}>
                <Icon size={19} />
                {!collapsed && <><span>{item.label}</span>{item.count && <b>{item.count}</b>}</>}
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
            <button className="icon-button" onClick={() => setDark(v => !v)} aria-label="Toggle dark mode">{dark ? <Sun size={19} /> : <Moon size={19} />}</button>
            <button className="icon-button notification" aria-label="Notifications"><Bell size={19} /><span /></button>
            <div className="divider" />
            <div className="profile">
              <div className="avatar">{user.full_name.split(' ').map(x => x[0]).slice(0, 2).join('')}</div>
              <div className="profile-copy"><strong>{user.full_name}</strong><span>{role}</span></div>
              <button className="icon-button" onClick={onLogout} aria-label="Sign out" title="Sign out"><LogOut size={17}/></button>
            </div>
          </div>
        </header>

        <div className="content">
          <div className="page-heading">
            <div>
              <div className="eyebrow"><span className="status-dot" /> Live national overview</div>
              <h1>{page === 'overview' ? greeting(user.full_name) : nav.find(n => n.id === page)?.label}</h1>
              <p>{page === 'overview' ? 'Here is what requires attention across MPLADS today.' : pageDescriptions[page]}</p>
            </div>
            <div className="heading-actions">
              <div className="role-switcher secure-scope"><LockKeyhole size={16}/><span>{user.organization.name}</span></div>
              <button className="button secondary"><Download size={17} /> Export view</button>
              <button className="button primary" onClick={runScan}><Sparkles size={17} /> Run risk scan</button>
            </div>
          </div>

          {scanMessage && <div className="system-message"><ShieldCheck size={16}/>{scanMessage}<button onClick={() => setScanMessage('')}><X size={15}/></button></div>}

          {page === 'overview' && <Overview projects={filtered} onSelect={setSelected} />}
          {page === 'alerts' && <AlertsView projects={filtered} onSelect={setSelected} />}
          {page === 'projects' && <ProjectsView projects={filtered} onSelect={setSelected} />}
          {page === 'map' && <MapView projects={filtered} onSelect={setSelected} />}
          {page === 'cases' && <CasesView />}
          {page === 'reports' && <ReportsView />}
          {page === 'admin' && <AdminView />}
        </div>
      </main>

      {selected && <ProjectDrawer project={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

// pageDescriptions moved above DashboardApp for correct declaration order

function Overview({ projects, onSelect }: { projects: Project[]; onSelect: (p: Project) => void }) {
  return <>
    <section className="metrics-grid">
      <Metric icon={FolderKanban} label="Active works" value="18,420" delta="4.8%" positive note="across 736 districts" color="teal" />
      <Metric icon={IndianRupee} label="Expenditure monitored" value="₹6,847 Cr" delta="8.2%" positive note="of ₹8,102 Cr sanctioned" color="blue" />
      <Metric icon={AlertTriangle} label="High-risk works" value="482" delta="12.4%" note="31 require action today" color="red" />
      <Metric icon={ClipboardCheck} label="Cases resolved" value="1,248" delta="18.7%" positive note="87% within target SLA" color="amber" />
    </section>

    <section className="dashboard-grid">
      <div className="card risk-trend-card">
        <CardHeader title="Risk intelligence trend" subtitle="Detected vs. resolved signals · last 6 months" action="View analytics" />
        <TrendChart />
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
        {states.map((state, i) => <div className="state-row" key={state.name}><span className="rank">{String(i + 1).padStart(2, '0')}</span><div className="state-name"><strong>{state.name}</strong><span>{state.projects.toLocaleString('en-IN')} active works</span></div><div className="bar-track"><span style={{ width: `${state.score}%` }} /></div><strong className="risk-number">{state.highRisk}</strong><span className="muted-label">high risk</span><ChevronRight size={17} /></div>)}
      </div>
    </section>
  </>
}

function Metric({ icon: Icon, label, value, delta, positive, note, color }: { icon: typeof Gauge; label: string; value: string; delta: string; positive?: boolean; note: string; color: string }) {
  return <article className="metric card"><div className={`metric-icon ${color}`}><Icon size={20} /></div><div className="metric-top"><span>{label}</span><CircleHelp size={14} /></div><div className="metric-value">{value}</div><div className="metric-foot"><span className={positive ? 'delta positive' : 'delta negative'}>{positive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{delta}</span><span>{note}</span></div></article>
}

function CardHeader({ title, subtitle, action }: { title: string; subtitle: string; action?: string }) {
  return <div className="card-header"><div><h2>{title}</h2><p>{subtitle}</p></div>{action && <button className="text-button">{action}<ChevronRight size={15} /></button>}</div>
}

function TrendChart() {
  const max = 90
  const pointsA = trend.map((d, i) => `${42 + i * 86},${160 - (d.detected / max) * 120}`).join(' ')
  const pointsB = trend.map((d, i) => `${42 + i * 86},${160 - (d.resolved / max) * 120}`).join(' ')
  return <div className="chart-wrap"><div className="chart-legend"><span><i className="dot detected" />Risk detected</span><span><i className="dot resolved" />Resolved</span><b>+18.6% resolution rate</b></div><svg viewBox="0 0 520 190" role="img" aria-label="Risk intelligence trend line chart"><defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#df6b58" stopOpacity=".28"/><stop offset="1" stopColor="#df6b58" stopOpacity="0"/></linearGradient></defs>{[40,80,120,160].map(y => <line key={y} x1="42" x2="478" y1={y} y2={y} className="grid-line"/>)}<polygon points={`42,160 ${pointsA} 472,160`} fill="url(#area)"/><polyline points={pointsA} className="line detected-line"/><polyline points={pointsB} className="line resolved-line"/>{trend.map((d, i) => <g key={d.month}><text x={42 + i * 86} y="183" textAnchor="middle">{d.month}</text><circle cx={42 + i * 86} cy={160 - (d.detected / max) * 120} r="3.8" className="point detected-point"/><circle cx={42 + i * 86} cy={160 - (d.resolved / max) * 120} r="3.8" className="point resolved-point"/></g>)}</svg></div>
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
  return <section className="map-page"><aside className="map-panel card"><h2>Intelligence layers</h2><p>Combine evidence to uncover spatial patterns.</p>{['Risk severity', 'Possible duplicate works', 'Payment–progress mismatch', 'Inspection coverage', 'Citizen signals'].map((x, i) => <label key={x}><input type="checkbox" defaultChecked={i < 2}/><span>{x}</span><small>{[482, 64, 127, 318, 91][i]}</small></label>)}<div className="panel-separator"/><h3>Selected geography</h3><button className="select-like">All India <ChevronDown size={15}/></button><button className="button primary full-button"><FileSearch size={17}/> Analyze visible area</button></aside><div className="card large-map"><div className="map-toolbar"><button className="active">Risk</button><button>Satellite</button><button>District</button><span/><button><Filter size={16}/> Filter</button></div><RiskMap projects={projects} onSelect={onSelect}/><div className="map-insight"><Zap size={17}/><div><strong>Spatial insight</strong><p>3 possible duplicate clusters detected within the visible area.</p></div><ChevronRight size={17}/></div></div></section>
}

function CasesView() {
  const cases = [
    { id: 'CASE-2026-0184', title: 'Payment–progress discrepancy', owner: 'Karnataka State Review Cell', status: 'Field verification', age: '4 days', sla: 68 },
    { id: 'CASE-2026-0171', title: 'Unusual cost benchmark deviation', owner: 'Uttar Pradesh Audit Unit', status: 'Evidence requested', age: '7 days', sla: 84 },
    { id: 'CASE-2026-0168', title: 'Possible duplicate school work', owner: 'Maharashtra Nodal Authority', status: 'Under review', age: '9 days', sla: 92 },
  ]
  return <><section className="workflow-strip">{['New', 'Triaged', 'Evidence requested', 'Verification', 'Closure review'].map((x, i) => <div key={x}><span>{[31,18,17,12,6][i]}</span><strong>{x}</strong>{i < 4 && <ChevronRight size={17}/>}</div>)}</section><section className="card case-list"><CardHeader title="Active investigations" subtitle="Cases requiring action, ordered by service-level risk" action="View case register"/>{cases.map(c => <article className="case-row" key={c.id}><div className="case-icon"><ClipboardCheck size={19}/></div><div className="case-main"><span>{c.id}</span><strong>{c.title}</strong><p>{c.owner}</p></div><div className="case-status"><span>{c.status}</span><small>Open for {c.age}</small></div><div className="sla"><div><span style={{ width: `${c.sla}%` }}/></div><small>SLA {c.sla}% used</small></div><button className="row-action"><ChevronRight size={18}/></button></article>)}</section></>
}

function ReportsView() {
  const reports = [
    { icon: Gauge, title: 'National risk briefing', text: 'Executive overview of emerging risks and state performance.', tag: 'Daily' },
    { icon: IndianRupee, title: 'Fund utilization analysis', text: 'Allocation, expenditure and unusual financial patterns.', tag: 'Monthly' },
    { icon: Clock3, title: 'Delay and completion outlook', text: 'Forecasted delay risk and intervention opportunities.', tag: 'Weekly' },
    { icon: Network, title: 'Vendor relationship review', text: 'Concentration, shared identities and network anomalies.', tag: 'Quarterly' },
  ]
  return <><section className="report-grid">{reports.map(({icon: Icon, title, text, tag}) => <article className="card report-card" key={title}><div className="report-icon"><Icon size={22}/></div><span className="report-tag">{tag}</span><h2>{title}</h2><p>{text}</p><button className="button secondary">Generate report <ChevronRight size={16}/></button></article>)}</section><section className="card report-history"><CardHeader title="Recent reports" subtitle="Generated reports are watermarked and access-logged"/><div className="empty-state"><FileSearch size={30}/><strong>Select a report template to begin</strong><p>Exports respect your role, jurisdiction and field-level permissions.</p></div></section></>
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

function ProjectDrawer({ project, onClose }: { project: Project; onClose: () => void }) {
  const signals = [
    { label: 'Payment–progress mismatch', score: 94, text: `${Math.round(project.spent / project.sanctioned * 100)}% of sanctioned value spent with ${project.progress}% physical progress.` },
    { label: 'Cost benchmark deviation', score: 78, text: 'Estimated cost is above the peer range for comparable works.' },
    { label: 'Evidence confidence', score: 66, text: 'Latest physical evidence is 46 days old.' },
  ]
  return <><div className="drawer-scrim" onClick={onClose}/><aside className="drawer"><header><div><span className="drawer-label">PROJECT RISK PROFILE</span><h2>{project.title}</h2><p>{project.id} · {project.location}</p></div><button className="icon-button" onClick={onClose} aria-label="Close project details"><X size={20}/></button></header><div className="drawer-body"><div className="risk-hero"><div className={`risk-ring ring-${project.level.toLowerCase()}`}><strong>{project.risk}</strong><span>/100</span></div><div><span className={riskClass(project.level)}><i/>{project.level} risk</span><h3>Human review recommended</h3><p>Signals are indicators, not a determination of fraud.</p></div></div><div className="quick-facts"><div><span>Sanctioned</span><strong>{formatCrore(project.sanctioned / 100)}</strong></div><div><span>Spent</span><strong>{formatCrore(project.spent / 100)}</strong></div><div><span>Progress</span><strong>{project.progress}%</strong></div></div><section className="drawer-section"><h3>Why this was flagged</h3>{signals.map(s => <article className="signal" key={s.label}><div className="signal-head"><strong>{s.label}</strong><span>{s.score}% confidence</span></div><p>{s.text}</p><div><span style={{width: `${s.score}%`}}/></div></article>)}</section><section className="drawer-section"><h3>Accountable timeline</h3>{['Sanction approved · 14 May 2025', 'First payment recorded · 02 Jul 2025', 'Progress updated to 34% · 18 Aug 2026', 'Risk alert generated · Today, 09:42'].map((x,i) => <div className="timeline-item" key={x}><span className={i === 3 ? 'current' : ''}>{i === 3 && <Check size={12}/>}</span><p>{x}</p></div>)}</section></div><footer><button className="button secondary">View complete record</button><button className="button primary"><ClipboardCheck size={17}/> Create review case</button></footer></aside></>
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
