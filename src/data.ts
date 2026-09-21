export type RiskLevel = 'Critical' | 'High' | 'Moderate' | 'Low'

export type Project = {
  id: string
  title: string
  location: string
  state: string
  district: string
  constituency?: string
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
  { id: 'MPL-KA-24018', title: 'Rural Link Road Improvement', location: 'Devanahalli, Bengaluru Rural', state: 'Karnataka', district: 'Bengaluru Rural', constituency: 'Bengaluru Rural', category: 'Roads', agency: 'PWD Bengaluru Rural', sanctioned: 58, spent: 47.6, progress: 34, risk: 91, level: 'Critical', issue: '82% paid while physical progress is 34%', updated: '12 min ago', lat: 61, lng: 58, latitude: 13.246, longitude: 77.712 },
  { id: 'MPL-UP-23872', title: 'Community Health Centre Extension', location: 'Sadar, Gorakhpur', state: 'Uttar Pradesh', district: 'Gorakhpur', constituency: 'Gorakhpur', category: 'Health', agency: 'District Health Society', sanctioned: 72, spent: 54.2, progress: 49, risk: 84, level: 'High', issue: 'Estimate 41% above comparable works', updated: '37 min ago', lat: 68, lng: 30, latitude: 26.760, longitude: 83.373 },
  { id: 'MPL-MH-24103', title: 'Government School Science Block', location: 'Karjat, Raigad', state: 'Maharashtra', district: 'Raigad', constituency: 'Raigad', category: 'Education', agency: 'Zilla Parishad Raigad', sanctioned: 44, spent: 26.8, progress: 52, risk: 76, level: 'High', issue: 'Possible duplicate work found 310 m away', updated: '1 hr ago', lat: 43, lng: 46, latitude: 18.910, longitude: 73.323 },
  { id: 'MPL-AS-23711', title: 'Solar Drinking Water Facility', location: 'Bokakhat, Golaghat', state: 'Assam', district: 'Golaghat', constituency: 'Kaziranga', category: 'Water', agency: 'PHE Golaghat', sanctioned: 18, spent: 15.4, progress: 67, risk: 63, level: 'Moderate', issue: 'Completion delay probability is 74%', updated: '2 hrs ago', lat: 80, lng: 40, latitude: 26.640, longitude: 93.600 },
  { id: 'MPL-TN-24220', title: 'Community Learning Centre', location: 'Ambattur, Chennai', state: 'Tamil Nadu', district: 'Chennai', constituency: 'Sriperumbudur', category: 'Community', agency: 'Greater Chennai Corporation', sanctioned: 36, spent: 18.1, progress: 55, risk: 28, level: 'Low', issue: 'No material irregularity detected', updated: '3 hrs ago', lat: 51, lng: 78, latitude: 13.114, longitude: 80.154 },
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

export type MonthlyProgress = {
  month: string
  progress: number
  financialProgress: number
}

export type DistrictProgress = {
  name: string
  progress: number
  financialProgress: number
  sanctionedLakh: number
  spentLakh: number
  totalWorks: number
  delayedWorks: number
  primarySignal: string
  history: MonthlyProgress[]
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
  history: MonthlyProgress[]
  districts: DistrictProgress[]
}

export const timelineMonths = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'] as const
export type TimelineMonth = typeof timelineMonths[number]

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
    history: [
      { month: 'Apr', progress: 42, financialProgress: 46 },
      { month: 'May', progress: 48, financialProgress: 52 },
      { month: 'Jun', progress: 54, financialProgress: 59 },
      { month: 'Jul', progress: 59, financialProgress: 64 },
      { month: 'Aug', progress: 64, financialProgress: 68 },
      { month: 'Sep', progress: 68, financialProgress: 72 },
    ],
    districts: [
      {
        name: 'Bengaluru Rural',
        progress: 68,
        financialProgress: 74,
        sanctionedLakh: 580,
        spentLakh: 429,
        totalWorks: 342,
        delayedWorks: 42,
        primarySignal: '82% paid vs 34% certified execution',
        history: [
          { month: 'Apr', progress: 34, financialProgress: 44 },
          { month: 'May', progress: 41, financialProgress: 51 },
          { month: 'Jun', progress: 48, financialProgress: 58 },
          { month: 'Jul', progress: 55, financialProgress: 64 },
          { month: 'Aug', progress: 62, financialProgress: 69 },
          { month: 'Sep', progress: 68, financialProgress: 74 },
        ],
      },
      {
        name: 'Bengaluru Urban',
        progress: 82,
        financialProgress: 88,
        sanctionedLakh: 1420,
        spentLakh: 1250,
        totalWorks: 512,
        delayedWorks: 28,
        primarySignal: 'On schedule · 91% milestone rate',
        history: [
          { month: 'Apr', progress: 52, financialProgress: 58 },
          { month: 'May', progress: 59, financialProgress: 66 },
          { month: 'Jun', progress: 66, financialProgress: 73 },
          { month: 'Jul', progress: 73, financialProgress: 79 },
          { month: 'Aug', progress: 78, financialProgress: 84 },
          { month: 'Sep', progress: 82, financialProgress: 88 },
        ],
      },
      {
        name: 'Mysuru',
        progress: 74,
        financialProgress: 78,
        sanctionedLakh: 920,
        spentLakh: 718,
        totalWorks: 420,
        delayedWorks: 35,
        primarySignal: 'Steady rural water works',
        history: [
          { month: 'Apr', progress: 46, financialProgress: 50 },
          { month: 'May', progress: 53, financialProgress: 57 },
          { month: 'Jun', progress: 60, financialProgress: 64 },
          { month: 'Jul', progress: 65, financialProgress: 69 },
          { month: 'Aug', progress: 70, financialProgress: 74 },
          { month: 'Sep', progress: 74, financialProgress: 78 },
        ],
      },
      {
        name: 'Belagavi',
        progress: 59,
        financialProgress: 64,
        sanctionedLakh: 760,
        spentLakh: 486,
        totalWorks: 380,
        delayedWorks: 64,
        primarySignal: 'Foundation delays due to monsoons',
        history: [
          { month: 'Apr', progress: 38, financialProgress: 42 },
          { month: 'May', progress: 42, financialProgress: 47 },
          { month: 'Jun', progress: 47, financialProgress: 52 },
          { month: 'Jul', progress: 51, financialProgress: 56 },
          { month: 'Aug', progress: 55, financialProgress: 60 },
          { month: 'Sep', progress: 59, financialProgress: 64 },
        ],
      },
      {
        name: 'Tumakuru',
        progress: 63,
        financialProgress: 66,
        sanctionedLakh: 640,
        spentLakh: 422,
        totalWorks: 290,
        delayedWorks: 38,
        primarySignal: 'Tender revision approvals pending',
        history: [
          { month: 'Apr', progress: 40, financialProgress: 43 },
          { month: 'May', progress: 45, financialProgress: 49 },
          { month: 'Jun', progress: 50, financialProgress: 54 },
          { month: 'Jul', progress: 55, financialProgress: 59 },
          { month: 'Aug', progress: 59, financialProgress: 63 },
          { month: 'Sep', progress: 63, financialProgress: 66 },
        ],
      },
      {
        name: 'Kalaburagi',
        progress: 48,
        financialProgress: 52,
        sanctionedLakh: 580,
        spentLakh: 302,
        totalWorks: 196,
        delayedWorks: 51,
        primarySignal: 'Billing reconciliation backlog',
        history: [
          { month: 'Apr', progress: 30, financialProgress: 34 },
          { month: 'May', progress: 34, financialProgress: 38 },
          { month: 'Jun', progress: 38, financialProgress: 42 },
          { month: 'Jul', progress: 41, financialProgress: 46 },
          { month: 'Aug', progress: 45, financialProgress: 49 },
          { month: 'Sep', progress: 48, financialProgress: 52 },
        ],
      },
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
    history: [
      { month: 'Apr', progress: 43, financialProgress: 45 },
      { month: 'May', progress: 49, financialProgress: 51 },
      { month: 'Jun', progress: 55, financialProgress: 57 },
      { month: 'Jul', progress: 60, financialProgress: 62 },
      { month: 'Aug', progress: 65, financialProgress: 67 },
      { month: 'Sep', progress: 69, financialProgress: 71 },
    ],
    districts: [
      {
        name: 'Gorakhpur',
        progress: 61,
        financialProgress: 75,
        sanctionedLakh: 720,
        spentLakh: 540,
        totalWorks: 640,
        delayedWorks: 82,
        primarySignal: 'Estimate 41% above regional benchmark',
        history: [
          { month: 'Apr', progress: 38, financialProgress: 48 },
          { month: 'May', progress: 44, financialProgress: 55 },
          { month: 'Jun', progress: 49, financialProgress: 61 },
          { month: 'Jul', progress: 54, financialProgress: 67 },
          { month: 'Aug', progress: 58, financialProgress: 71 },
          { month: 'Sep', progress: 61, financialProgress: 75 },
        ],
      },
      {
        name: 'Varanasi',
        progress: 85,
        financialProgress: 89,
        sanctionedLakh: 1600,
        spentLakh: 1424,
        totalWorks: 720,
        delayedWorks: 32,
        primarySignal: 'High completion rate · 94% on track',
        history: [
          { month: 'Apr', progress: 56, financialProgress: 61 },
          { month: 'May', progress: 63, financialProgress: 68 },
          { month: 'Jun', progress: 70, financialProgress: 75 },
          { month: 'Jul', progress: 76, financialProgress: 81 },
          { month: 'Aug', progress: 81, financialProgress: 85 },
          { month: 'Sep', progress: 85, financialProgress: 89 },
        ],
      },
      {
        name: 'Lucknow',
        progress: 79,
        financialProgress: 84,
        sanctionedLakh: 2100,
        spentLakh: 1764,
        totalWorks: 890,
        delayedWorks: 48,
        primarySignal: 'Healthcare expansion on schedule',
        history: [
          { month: 'Apr', progress: 50, financialProgress: 56 },
          { month: 'May', progress: 57, financialProgress: 63 },
          { month: 'Jun', progress: 64, financialProgress: 70 },
          { month: 'Jul', progress: 70, financialProgress: 76 },
          { month: 'Aug', progress: 75, financialProgress: 80 },
          { month: 'Sep', progress: 79, financialProgress: 84 },
        ],
      },
      {
        name: 'Prayagraj',
        progress: 53,
        financialProgress: 60,
        sanctionedLakh: 1180,
        spentLakh: 708,
        totalWorks: 540,
        delayedWorks: 94,
        primarySignal: 'River embankment works deferred',
        history: [
          { month: 'Apr', progress: 35, financialProgress: 41 },
          { month: 'May', progress: 39, financialProgress: 46 },
          { month: 'Jun', progress: 43, financialProgress: 50 },
          { month: 'Jul', progress: 47, financialProgress: 54 },
          { month: 'Aug', progress: 50, financialProgress: 57 },
          { month: 'Sep', progress: 53, financialProgress: 60 },
        ],
      },
      {
        name: 'Meerut',
        progress: 71,
        financialProgress: 73,
        sanctionedLakh: 980,
        spentLakh: 715,
        totalWorks: 512,
        delayedWorks: 44,
        primarySignal: 'School science laboratories active',
        history: [
          { month: 'Apr', progress: 46, financialProgress: 48 },
          { month: 'May', progress: 52, financialProgress: 54 },
          { month: 'Jun', progress: 58, financialProgress: 60 },
          { month: 'Jul', progress: 63, financialProgress: 65 },
          { month: 'Aug', progress: 67, financialProgress: 69 },
          { month: 'Sep', progress: 71, financialProgress: 73 },
        ],
      },
      {
        name: 'Kanpur Nagar',
        progress: 66,
        financialProgress: 69,
        sanctionedLakh: 1220,
        spentLakh: 842,
        totalWorks: 540,
        delayedWorks: 58,
        primarySignal: 'Community center finishing phase',
        history: [
          { month: 'Apr', progress: 42, financialProgress: 45 },
          { month: 'May', progress: 48, financialProgress: 51 },
          { month: 'Jun', progress: 53, financialProgress: 57 },
          { month: 'Jul', progress: 58, financialProgress: 62 },
          { month: 'Aug', progress: 62, financialProgress: 66 },
          { month: 'Sep', progress: 66, financialProgress: 69 },
        ],
      },
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
    history: [
      { month: 'Apr', progress: 48, financialProgress: 51 },
      { month: 'May', progress: 55, financialProgress: 58 },
      { month: 'Jun', progress: 61, financialProgress: 64 },
      { month: 'Jul', progress: 66, financialProgress: 69 },
      { month: 'Aug', progress: 71, financialProgress: 73 },
      { month: 'Sep', progress: 74, financialProgress: 77 },
    ],
    districts: [
      {
        name: 'Raigad',
        progress: 65,
        financialProgress: 61,
        sanctionedLakh: 440,
        spentLakh: 268,
        totalWorks: 380,
        delayedWorks: 46,
        primarySignal: 'Possible duplicate school wing nearby',
        history: [
          { month: 'Apr', progress: 41, financialProgress: 39 },
          { month: 'May', progress: 47, financialProgress: 45 },
          { month: 'Jun', progress: 52, financialProgress: 50 },
          { month: 'Jul', progress: 57, financialProgress: 54 },
          { month: 'Aug', progress: 61, financialProgress: 58 },
          { month: 'Sep', progress: 65, financialProgress: 61 },
        ],
      },
      {
        name: 'Pune',
        progress: 88,
        financialProgress: 91,
        sanctionedLakh: 2300,
        spentLakh: 2093,
        totalWorks: 760,
        delayedWorks: 22,
        primarySignal: 'Model district in asset completion',
        history: [
          { month: 'Apr', progress: 60, financialProgress: 64 },
          { month: 'May', progress: 67, financialProgress: 71 },
          { month: 'Jun', progress: 74, financialProgress: 78 },
          { month: 'Jul', progress: 80, financialProgress: 83 },
          { month: 'Aug', progress: 84, financialProgress: 88 },
          { month: 'Sep', progress: 88, financialProgress: 91 },
        ],
      },
      {
        name: 'Thane',
        progress: 73,
        financialProgress: 76,
        sanctionedLakh: 1850,
        spentLakh: 1406,
        totalWorks: 620,
        delayedWorks: 41,
        primarySignal: 'Bridge connectivity on schedule',
        history: [
          { month: 'Apr', progress: 48, financialProgress: 52 },
          { month: 'May', progress: 54, financialProgress: 58 },
          { month: 'Jun', progress: 60, financialProgress: 64 },
          { month: 'Jul', progress: 65, financialProgress: 69 },
          { month: 'Aug', progress: 69, financialProgress: 73 },
          { month: 'Sep', progress: 73, financialProgress: 76 },
        ],
      },
      {
        name: 'Nagpur',
        progress: 69,
        financialProgress: 72,
        sanctionedLakh: 1320,
        spentLakh: 950,
        totalWorks: 490,
        delayedWorks: 48,
        primarySignal: 'Solar pump installations verified',
        history: [
          { month: 'Apr', progress: 44, financialProgress: 47 },
          { month: 'May', progress: 50, financialProgress: 53 },
          { month: 'Jun', progress: 56, financialProgress: 59 },
          { month: 'Jul', progress: 61, financialProgress: 64 },
          { month: 'Aug', progress: 65, financialProgress: 68 },
          { month: 'Sep', progress: 69, financialProgress: 72 },
        ],
      },
      {
        name: 'Nashik',
        progress: 58,
        financialProgress: 62,
        sanctionedLakh: 1120,
        spentLakh: 694,
        totalWorks: 410,
        delayedWorks: 63,
        primarySignal: 'Market yard sheds pending sanction',
        history: [
          { month: 'Apr', progress: 37, financialProgress: 41 },
          { month: 'May', progress: 42, financialProgress: 46 },
          { month: 'Jun', progress: 47, financialProgress: 51 },
          { month: 'Jul', progress: 51, financialProgress: 55 },
          { month: 'Aug', progress: 55, financialProgress: 59 },
          { month: 'Sep', progress: 58, financialProgress: 62 },
        ],
      },
      {
        name: 'Sambhajinagar',
        progress: 52,
        financialProgress: 57,
        sanctionedLakh: 940,
        spentLakh: 536,
        totalWorks: 258,
        delayedWorks: 54,
        primarySignal: 'Pipeline extension delay reported',
        history: [
          { month: 'Apr', progress: 33, financialProgress: 37 },
          { month: 'May', progress: 38, financialProgress: 42 },
          { month: 'Jun', progress: 42, financialProgress: 46 },
          { month: 'Jul', progress: 46, financialProgress: 50 },
          { month: 'Aug', progress: 49, financialProgress: 54 },
          { month: 'Sep', progress: 52, financialProgress: 57 },
        ],
      },
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
    history: [
      { month: 'Apr', progress: 40, financialProgress: 44 },
      { month: 'May', progress: 46, financialProgress: 50 },
      { month: 'Jun', progress: 52, financialProgress: 56 },
      { month: 'Jul', progress: 57, financialProgress: 62 },
      { month: 'Aug', progress: 62, financialProgress: 66 },
      { month: 'Sep', progress: 66, financialProgress: 70 },
    ],
    districts: [
      {
        name: 'Golaghat',
        progress: 72,
        financialProgress: 85,
        sanctionedLakh: 180,
        spentLakh: 153,
        totalWorks: 240,
        delayedWorks: 26,
        primarySignal: 'Solar drinking units operational',
        history: [
          { month: 'Apr', progress: 45, financialProgress: 55 },
          { month: 'May', progress: 52, financialProgress: 63 },
          { month: 'Jun', progress: 58, financialProgress: 70 },
          { month: 'Jul', progress: 64, financialProgress: 76 },
          { month: 'Aug', progress: 68, financialProgress: 81 },
          { month: 'Sep', progress: 72, financialProgress: 85 },
        ],
      },
      {
        name: 'Kamrup Metro',
        progress: 81,
        financialProgress: 84,
        sanctionedLakh: 980,
        spentLakh: 823,
        totalWorks: 390,
        delayedWorks: 22,
        primarySignal: 'Urban skill center near handover',
        history: [
          { month: 'Apr', progress: 53, financialProgress: 56 },
          { month: 'May', progress: 60, financialProgress: 63 },
          { month: 'Jun', progress: 67, financialProgress: 70 },
          { month: 'Jul', progress: 73, financialProgress: 76 },
          { month: 'Aug', progress: 77, financialProgress: 80 },
          { month: 'Sep', progress: 81, financialProgress: 84 },
        ],
      },
      {
        name: 'Dibrugarh',
        progress: 64,
        financialProgress: 68,
        sanctionedLakh: 600,
        spentLakh: 408,
        totalWorks: 280,
        delayedWorks: 38,
        primarySignal: 'Post-monsoon civil works resumed',
        history: [
          { month: 'Apr', progress: 39, financialProgress: 43 },
          { month: 'May', progress: 45, financialProgress: 49 },
          { month: 'Jun', progress: 50, financialProgress: 55 },
          { month: 'Jul', progress: 55, financialProgress: 60 },
          { month: 'Aug', progress: 60, financialProgress: 64 },
          { month: 'Sep', progress: 64, financialProgress: 68 },
        ],
      },
      {
        name: 'Cachar',
        progress: 55,
        financialProgress: 59,
        sanctionedLakh: 520,
        spentLakh: 307,
        totalWorks: 210,
        delayedWorks: 45,
        primarySignal: 'Culvert drainage repairs in progress',
        history: [
          { month: 'Apr', progress: 32, financialProgress: 36 },
          { month: 'May', progress: 37, financialProgress: 41 },
          { month: 'Jun', progress: 42, financialProgress: 47 },
          { month: 'Jul', progress: 47, financialProgress: 51 },
          { month: 'Aug', progress: 51, financialProgress: 55 },
          { month: 'Sep', progress: 55, financialProgress: 59 },
        ],
      },
      {
        name: 'Jorhat',
        progress: 67,
        financialProgress: 71,
        sanctionedLakh: 480,
        spentLakh: 341,
        totalWorks: 255,
        delayedWorks: 31,
        primarySignal: 'Rural connectivity Phase 2 approved',
        history: [
          { month: 'Apr', progress: 42, financialProgress: 46 },
          { month: 'May', progress: 48, financialProgress: 52 },
          { month: 'Jun', progress: 54, financialProgress: 58 },
          { month: 'Jul', progress: 59, financialProgress: 63 },
          { month: 'Aug', progress: 63, financialProgress: 67 },
          { month: 'Sep', progress: 67, financialProgress: 71 },
        ],
      },
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
    history: [
      { month: 'Apr', progress: 50, financialProgress: 52 },
      { month: 'May', progress: 57, financialProgress: 59 },
      { month: 'Jun', progress: 63, financialProgress: 65 },
      { month: 'Jul', progress: 68, financialProgress: 70 },
      { month: 'Aug', progress: 72, financialProgress: 74 },
      { month: 'Sep', progress: 76, financialProgress: 78 },
    ],
    districts: [
      {
        name: 'Chennai',
        progress: 84,
        financialProgress: 50,
        sanctionedLakh: 360,
        spentLakh: 180,
        totalWorks: 620,
        delayedWorks: 18,
        primarySignal: 'Community learning centres completed',
        history: [
          { month: 'Apr', progress: 55, financialProgress: 32 },
          { month: 'May', progress: 63, financialProgress: 37 },
          { month: 'Jun', progress: 70, financialProgress: 42 },
          { month: 'Jul', progress: 76, financialProgress: 45 },
          { month: 'Aug', progress: 80, financialProgress: 48 },
          { month: 'Sep', progress: 84, financialProgress: 50 },
        ],
      },
      {
        name: 'Coimbatore',
        progress: 79,
        financialProgress: 83,
        sanctionedLakh: 1350,
        spentLakh: 1120,
        totalWorks: 540,
        delayedWorks: 26,
        primarySignal: 'Check dams and water conservation met',
        history: [
          { month: 'Apr', progress: 52, financialProgress: 56 },
          { month: 'May', progress: 59, financialProgress: 63 },
          { month: 'Jun', progress: 65, financialProgress: 69 },
          { month: 'Jul', progress: 71, financialProgress: 75 },
          { month: 'Aug', progress: 75, financialProgress: 79 },
          { month: 'Sep', progress: 79, financialProgress: 83 },
        ],
      },
      {
        name: 'Madurai',
        progress: 70,
        financialProgress: 74,
        sanctionedLakh: 1080,
        spentLakh: 799,
        totalWorks: 430,
        delayedWorks: 39,
        primarySignal: 'Primary healthcare annex finishing',
        history: [
          { month: 'Apr', progress: 45, financialProgress: 49 },
          { month: 'May', progress: 51, financialProgress: 55 },
          { month: 'Jun', progress: 57, financialProgress: 61 },
          { month: 'Jul', progress: 62, financialProgress: 66 },
          { month: 'Aug', progress: 66, financialProgress: 70 },
          { month: 'Sep', progress: 70, financialProgress: 74 },
        ],
      },
      {
        name: 'Tiruchirappalli',
        progress: 73,
        financialProgress: 76,
        sanctionedLakh: 980,
        spentLakh: 745,
        totalWorks: 410,
        delayedWorks: 31,
        primarySignal: 'Panchayat digital centers deployed',
        history: [
          { month: 'Apr', progress: 47, financialProgress: 50 },
          { month: 'May', progress: 53, financialProgress: 56 },
          { month: 'Jun', progress: 59, financialProgress: 62 },
          { month: 'Jul', progress: 65, financialProgress: 68 },
          { month: 'Aug', progress: 69, financialProgress: 72 },
          { month: 'Sep', progress: 73, financialProgress: 76 },
        ],
      },
      {
        name: 'Salem',
        progress: 66,
        financialProgress: 70,
        sanctionedLakh: 900,
        spentLakh: 630,
        totalWorks: 360,
        delayedWorks: 44,
        primarySignal: 'Overhead water tank civil work',
        history: [
          { month: 'Apr', progress: 43, financialProgress: 47 },
          { month: 'May', progress: 49, financialProgress: 53 },
          { month: 'Jun', progress: 54, financialProgress: 58 },
          { month: 'Jul', progress: 59, financialProgress: 63 },
          { month: 'Aug', progress: 63, financialProgress: 67 },
          { month: 'Sep', progress: 66, financialProgress: 70 },
        ],
      },
    ],
  },
]

export const activity = [
  { title: 'Critical alert assigned', meta: 'MPL-KA-24018 · to Karnataka State Review Cell', time: '12 min', tone: 'critical' },
  { title: 'Evidence received', meta: 'MPL-UP-23872 · 3 documents uploaded', time: '37 min', tone: 'info' },
  { title: 'Case resolved', meta: 'MPL-RJ-22901 · Explanation verified by auditor', time: '1 hr', tone: 'success' },
  { title: 'Model completed nightly scan', meta: '18,420 active works assessed · model v1.4', time: '2 hrs', tone: 'neutral' },
]
