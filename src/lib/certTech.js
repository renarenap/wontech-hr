// ═══ 자격가점(cert_entries)/기술성과(tech_entries) — 건별 입력 + 카테고리 상한 자동 적용 ═══
// employees.cert_pts/tech_pts는 캐시값: 항목이 바뀔 때마다 여기서 재계산해서 다시 써줌으로써
// promotion.js 등 기존 계산 로직(employee.cert_pts를 그대로 읽음)은 손댈 필요가 없게 함.
import { supabase } from '../supabaseClient'

export const CERT_CATEGORY_CAP = { 전문자격: 6, 직무자격: 3 }
export const CERT_CATEGORY_DEFAULT_PTS = { 전문자격: 3, 직무자격: 1 }
export const CERT_CATEGORIES = ['전문자격', '직무자격']

export const TECH_CATEGORY_DEFAULT_PTS = { 국내특허: 2, 해외특허: 3, 국내논문: 2, 국제논문: 3 }
export const TECH_CATEGORIES = ['국내특허', '해외특허', '국내논문', '국제논문']
export const TECH_TOTAL_CAP = 6

// 카테고리별 합계를 각자 상한까지만 인정해서 더함 — 상한 초과분은 자동으로 컷됨
export function computeCertPts(entries) {
  const byCat = {}
  ;(entries || []).forEach((e) => { byCat[e.category] = (byCat[e.category] || 0) + Number(e.points || 0) })
  let total = 0
  Object.entries(byCat).forEach(([cat, sum]) => { total += Math.min(sum, CERT_CATEGORY_CAP[cat] ?? Infinity) })
  return Math.round(total * 10) / 10
}

export function computeTechPts(entries) {
  const sum = (entries || []).reduce((s, e) => s + Number(e.points || 0), 0)
  return Math.round(Math.min(sum, TECH_TOTAL_CAP) * 10) / 10
}

export async function fetchCertEntries(employeeId) {
  const { data, error } = await supabase.from('cert_entries').select('*').eq('employee_id', employeeId).order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function fetchTechEntries(employeeId) {
  const { data, error } = await supabase.from('tech_entries').select('*').eq('employee_id', employeeId).order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

// 추가/삭제 후엔 항상 최신 전체 목록을 다시 읽어서 cert_pts를 재계산해 employees에 반영 — 화면·계산 로직 모두 이 캐시값을 신뢰함
async function recomputeCertPts(employeeId) {
  const entries = await fetchCertEntries(employeeId)
  const { error } = await supabase.from('employees').update({ cert_pts: computeCertPts(entries) }).eq('id', employeeId)
  if (error) throw error
}

async function recomputeTechPts(employeeId) {
  const entries = await fetchTechEntries(employeeId)
  const { error } = await supabase.from('employees').update({ tech_pts: computeTechPts(entries) }).eq('id', employeeId)
  if (error) throw error
}

export async function addCertEntry(employeeId, { category, name, valid_until, points }) {
  const { error } = await supabase.from('cert_entries').insert({ employee_id: employeeId, category, name, valid_until: valid_until || null, points })
  if (error) throw error
  await recomputeCertPts(employeeId)
}

export async function deleteCertEntry(id, employeeId) {
  const { error } = await supabase.from('cert_entries').delete().eq('id', id)
  if (error) throw error
  await recomputeCertPts(employeeId)
}

export async function addTechEntry(employeeId, { category, name, achieved_date, points }) {
  const { error } = await supabase.from('tech_entries').insert({ employee_id: employeeId, category, name, achieved_date: achieved_date || null, points })
  if (error) throw error
  await recomputeTechPts(employeeId)
}

export async function deleteTechEntry(id, employeeId) {
  const { error } = await supabase.from('tech_entries').delete().eq('id', id)
  if (error) throw error
  await recomputeTechPts(employeeId)
}
