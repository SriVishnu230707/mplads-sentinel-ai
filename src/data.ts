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

export const activity = [
  { title: 'Critical alert assigned', meta: 'MPL-KA-24018 · to Karnataka State Review Cell', time: '12 min', tone: 'critical' },
  { title: 'Evidence received', meta: 'MPL-UP-23872 · 3 documents uploaded', time: '37 min', tone: 'info' },
  { title: 'Case resolved', meta: 'MPL-RJ-22901 · Explanation verified by auditor', time: '1 hr', tone: 'success' },
  { title: 'Model completed nightly scan', meta: '18,420 active works assessed · model v1.4', time: '2 hrs', tone: 'neutral' },
]
