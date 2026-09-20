export type RiskLevel = 'Critical' | 'High' | 'Moderate' | 'Low'

export type Project = {
  id: string
  title: string
  location: string
  state: string
  district: string
  category: string
  agency: string
  sanctioned: number
  spent: number
  progress: number
  risk: number
  level: RiskLevel
  issue: string
  updated: string
  lat: number
  lng: number
  latitude?: number
  longitude?: number
}

export const projects: Project[] = [
  { id: 'MPL-KA-24018', title: 'Rural Link Road Improvement', location: 'Devanahalli, Bengaluru Rural', state: 'Karnataka', district: 'Bengaluru Rural', category: 'Roads', agency: 'PWD Bengaluru Rural', sanctioned: 58, spent: 47.6, progress: 34, risk: 91, level: 'Critical', issue: '82% paid while physical progress is 34%', updated: '12 min ago', lat: 61, lng: 58, latitude: 13.246, longitude: 77.712 },
  { id: 'MPL-UP-23872', title: 'Community Health Centre Extension', location: 'Sadar, Gorakhpur', state: 'Uttar Pradesh', district: 'Gorakhpur', category: 'Health', agency: 'District Health Society', sanctioned: 72, spent: 54.2, progress: 49, risk: 84, level: 'High', issue: 'Estimate 41% above comparable works', updated: '37 min ago', lat: 68, lng: 30, latitude: 26.760, longitude: 83.373 },
  { id: 'MPL-MH-24103', title: 'Government School Science Block', location: 'Karjat, Raigad', state: 'Maharashtra', district: 'Raigad', category: 'Education', agency: 'Zilla Parishad Raigad', sanctioned: 44, spent: 26.8, progress: 52, risk: 76, level: 'High', issue: 'Possible duplicate work found 310 m away', updated: '1 hr ago', lat: 43, lng: 46, latitude: 18.910, longitude: 73.323 },
  { id: 'MPL-AS-23711', title: 'Solar Drinking Water Facility', location: 'Bokakhat, Golaghat', state: 'Assam', district: 'Golaghat', category: 'Water', agency: 'PHE Golaghat', sanctioned: 18, spent: 15.4, progress: 67, risk: 63, level: 'Moderate', issue: 'Completion delay probability is 74%', updated: '2 hrs ago', lat: 80, lng: 40, latitude: 26.640, longitude: 93.600 },
  { id: 'MPL-TN-24220', title: 'Community Learning Centre', location: 'Ambattur, Chennai', state: 'Tamil Nadu', district: 'Chennai', category: 'Community', agency: 'Greater Chennai Corporation', sanctioned: 36, spent: 18.1, progress: 55, risk: 28, level: 'Low', issue: 'No material irregularity detected', updated: '3 hrs ago', lat: 51, lng: 78, latitude: 13.114, longitude: 80.154 },
]

export const trend = [
  { month: 'Apr', detected: 42, resolved: 24 },
  { month: 'May', detected: 56, resolved: 31 },
  { month: 'Jun', detected: 48, resolved: 39 },
  { month: 'Jul', detected: 73, resolved: 44 },
  { month: 'Aug', detected: 68, resolved: 56 },
  { month: 'Sep', detected: 81, resolved: 64 },
]

export const states = [
  { name: 'Uttar Pradesh', projects: 3842, highRisk: 194, score: 72 },
  { name: 'Maharashtra', projects: 2918, highRisk: 121, score: 64 },
  { name: 'Karnataka', projects: 2140, highRisk: 87, score: 58 },
  { name: 'Assam', projects: 1375, highRisk: 69, score: 54 },
  { name: 'Tamil Nadu', projects: 2360, highRisk: 74, score: 48 },
]

export type DistrictProgress = {
  name: string
  progress: number
  financialProgress: number
  sanctionedLakh: number
  spentLakh: number
  totalWorks: number
  delayedWorks: number
  primarySignal: string
}

export type StateProgress = {
  name: string
  code: string
  progress: number
  financialProgress: number
  sanctionedCrore: number
  spentCrore: number
  totalWorks: number
  highRiskWorks: number
  districts: DistrictProgress[]
}

export const stateProgressData: StateProgress[] = [
  {
    name: 'Karnataka',
    code: 'KA',
    progress: 68,
    financialProgress: 72,
    sanctionedCrore: 810,
    spentCrore: 583,
    totalWorks: 2140,
    highRiskWorks: 87,
    districts: [
      { name: 'Bengaluru Rural', progress: 68, financialProgress: 74, sanctionedLakh: 580, spentLakh: 429, totalWorks: 342, delayedWorks: 42, primarySignal: '82% paid vs 34% certified execution' },
      { name: 'Bengaluru Urban', progress: 82, financialProgress: 88, sanctionedLakh: 1420, spentLakh: 1250, totalWorks: 512, delayedWorks: 28, primarySignal: 'On schedule · 91% milestone rate' },
      { name: 'Mysuru', progress: 74, financialProgress: 78, sanctionedLakh: 920, spentLakh: 718, totalWorks: 420, delayedWorks: 35, primarySignal: 'Steady rural water works' },
      { name: 'Belagavi', progress: 59, financialProgress: 64, sanctionedLakh: 760, spentLakh: 486, totalWorks: 380, delayedWorks: 64, primarySignal: 'Foundation delays due to monsoons' },
      { name: 'Tumakuru', progress: 63, financialProgress: 66, sanctionedLakh: 640, spentLakh: 422, totalWorks: 290, delayedWorks: 38, primarySignal: 'Tender revision approvals pending' },
      { name: 'Kalaburagi', progress: 48, financialProgress: 52, sanctionedLakh: 580, spentLakh: 302, totalWorks: 196, delayedWorks: 51, primarySignal: 'Billing reconciliation backlog' },
    ],
  },
  {
    name: 'Uttar Pradesh',
    code: 'UP',
    progress: 69,
    financialProgress: 71,
    sanctionedCrore: 1240,
    spentCrore: 880,
    totalWorks: 3842,
    highRiskWorks: 194,
    districts: [
      { name: 'Gorakhpur', progress: 61, financialProgress: 75, sanctionedLakh: 720, spentLakh: 540, totalWorks: 640, delayedWorks: 82, primarySignal: 'Estimate 41% above regional benchmark' },
      { name: 'Varanasi', progress: 85, financialProgress: 89, sanctionedLakh: 1600, spentLakh: 1424, totalWorks: 720, delayedWorks: 32, primarySignal: 'High completion rate · 94% on track' },
      { name: 'Lucknow', progress: 79, financialProgress: 84, sanctionedLakh: 2100, spentLakh: 1764, totalWorks: 890, delayedWorks: 48, primarySignal: 'Healthcare expansion on schedule' },
      { name: 'Prayagraj', progress: 53, financialProgress: 60, sanctionedLakh: 1180, spentLakh: 708, totalWorks: 540, delayedWorks: 94, primarySignal: 'River embankment works deferred' },
      { name: 'Meerut', progress: 71, financialProgress: 73, sanctionedLakh: 980, spentLakh: 715, totalWorks: 512, delayedWorks: 44, primarySignal: 'School science laboratories active' },
      { name: 'Kanpur Nagar', progress: 66, financialProgress: 69, sanctionedLakh: 1220, spentLakh: 842, totalWorks: 540, delayedWorks: 58, primarySignal: 'Community center finishing phase' },
    ],
  },
  {
    name: 'Maharashtra',
    code: 'MH',
    progress: 74,
    financialProgress: 77,
    sanctionedCrore: 960,
    spentCrore: 739,
    totalWorks: 2918,
    highRiskWorks: 121,
    districts: [
      { name: 'Raigad', progress: 65, financialProgress: 61, sanctionedLakh: 440, spentLakh: 268, totalWorks: 380, delayedWorks: 46, primarySignal: 'Possible duplicate school wing nearby' },
      { name: 'Pune', progress: 88, financialProgress: 91, sanctionedLakh: 2300, spentLakh: 2093, totalWorks: 760, delayedWorks: 22, primarySignal: 'Model district in asset completion' },
      { name: 'Thane', progress: 73, financialProgress: 76, sanctionedLakh: 1850, spentLakh: 1406, totalWorks: 620, delayedWorks: 41, primarySignal: 'Bridge connectivity on schedule' },
      { name: 'Nagpur', progress: 69, financialProgress: 72, sanctionedLakh: 1320, spentLakh: 950, totalWorks: 490, delayedWorks: 48, primarySignal: 'Solar pump installations verified' },
      { name: 'Nashik', progress: 58, financialProgress: 62, sanctionedLakh: 1120, spentLakh: 694, totalWorks: 410, delayedWorks: 63, primarySignal: 'Market yard sheds pending sanction' },
      { name: 'Sambhajinagar', progress: 52, financialProgress: 57, sanctionedLakh: 940, spentLakh: 536, totalWorks: 258, delayedWorks: 54, primarySignal: 'Pipeline extension delay reported' },
    ],
  },
  {
    name: 'Assam',
    code: 'AS',
    progress: 66,
    financialProgress: 70,
    sanctionedCrore: 350,
    spentCrore: 245,
    totalWorks: 1375,
    highRiskWorks: 69,
    districts: [
      { name: 'Golaghat', progress: 72, financialProgress: 85, sanctionedLakh: 180, spentLakh: 153, totalWorks: 240, delayedWorks: 26, primarySignal: 'Solar drinking units operational' },
      { name: 'Kamrup Metro', progress: 81, financialProgress: 84, sanctionedLakh: 980, spentLakh: 823, totalWorks: 390, delayedWorks: 22, primarySignal: 'Urban skill center near handover' },
      { name: 'Dibrugarh', progress: 64, financialProgress: 68, sanctionedLakh: 600, spentLakh: 408, totalWorks: 280, delayedWorks: 38, primarySignal: 'Post-monsoon civil works resumed' },
      { name: 'Cachar', progress: 55, financialProgress: 59, sanctionedLakh: 520, spentLakh: 307, totalWorks: 210, delayedWorks: 45, primarySignal: 'Culvert drainage repairs in progress' },
      { name: 'Jorhat', progress: 67, financialProgress: 71, sanctionedLakh: 480, spentLakh: 341, totalWorks: 255, delayedWorks: 31, primarySignal: 'Rural connectivity Phase 2 approved' },
    ],
  },
  {
    name: 'Tamil Nadu',
    code: 'TN',
    progress: 76,
    financialProgress: 78,
    sanctionedCrore: 780,
    spentCrore: 608,
    totalWorks: 2360,
    highRiskWorks: 74,
    districts: [
      { name: 'Chennai', progress: 84, financialProgress: 50, sanctionedLakh: 360, spentLakh: 180, totalWorks: 620, delayedWorks: 18, primarySignal: 'Community learning centres completed' },
      { name: 'Coimbatore', progress: 79, financialProgress: 83, sanctionedLakh: 1350, spentLakh: 1120, totalWorks: 540, delayedWorks: 26, primarySignal: 'Check dams and water conservation met' },
      { name: 'Madurai', progress: 70, financialProgress: 74, sanctionedLakh: 1080, spentLakh: 799, totalWorks: 430, delayedWorks: 39, primarySignal: 'Primary healthcare annex finishing' },
      { name: 'Tiruchirappalli', progress: 73, financialProgress: 76, sanctionedLakh: 980, spentLakh: 745, totalWorks: 410, delayedWorks: 31, primarySignal: 'Panchayat digital centers deployed' },
      { name: 'Salem', progress: 66, financialProgress: 70, sanctionedLakh: 900, spentLakh: 630, totalWorks: 360, delayedWorks: 44, primarySignal: 'Overhead water tank civil work' },
    ],
  },
]

export const activity = [
  { title: 'Critical alert assigned', meta: 'MPL-KA-24018 · to Karnataka State Review Cell', time: '12 min', tone: 'critical' },
  { title: 'Evidence received', meta: 'MPL-UP-23872 · 3 documents uploaded', time: '37 min', tone: 'info' },
  { title: 'Case resolved', meta: 'MPL-RJ-22901 · Explanation verified by auditor', time: '1 hr', tone: 'success' },
  { title: 'Model completed nightly scan', meta: '18,420 active works assessed · model v1.4', time: '2 hrs', tone: 'neutral' },
]
