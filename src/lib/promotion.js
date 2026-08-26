// ═══ 승진포인트 계산 로직 (rank_criteria 파라미터 테이블 기반, 하드코딩 없음) ═══
import { supabase } from '../supabaseClient'
import { OFFICE_RANKS, RESEARCH_RANKS } from './constants'

const TRACKED_RANKS = new Set([...OFFICE_RANKS, ...RESEARCH_RANKS])

// rank_criteria 테이블 전체를 { [rank]: {req_tenure, threshold, backfill_rate} } 형태로 로드
export async function fetchRankCriteria() {
  const { data, error } = await supabase.from('rank_criteria').select('*')
  if (error) throw error
  const map = {}
  ;(data || []).forEach((r) => {
    map[r.rank] = { req_tenure: r.req_tenure, threshold: r.threshold, backfill_rate: Number(r.backfill_rate) || 0 }
  })
  return map
}

// 평가이력 개수(R) — 반기 평가는 1건, 연간(2026~) 평가는 반기 2건분으로 계산
export function evalCount(evaluations) {
  return (evaluations || []).reduce((n, e) => {
    const isHalf = e.period?.endsWith('상') || e.period?.endsWith('하')
    return n + (isHalf ? 1 : 2)
  }, 0)
}

// 경력직 백필 포인트
// - backfillFullTenure(경력직, 평가이력 전무): 연차 전체 × 기준점수
// - 일반(체류 중 일부 반기만 누락): (예상 반기 슬롯 - 실제 평가횟수) × 기준점수 / 2
export function computeBackfill(level, R, rankCriteria, backfillFullTenure) {
  const rate = rankCriteria?.backfill_rate || 0
  if (!rate) return 0
  const lvl = level || 0
  if (backfillFullTenure) {
    return Math.round(lvl * rate * 10) / 10
  }
  return Math.max(0, Math.round((((lvl - 1) * 2 - R) * rate / 2) * 10) / 10)
}

// 외국어필수 승진 게이트 대상 직급 (과장/차장만 — 부장은 기준 자체가 없어 'na' 상태로 별도 처리됨)
const LANG_GATE_RANKS = ['과장', '차장']

export function isEngGateTrack(employee) {
  return employee.track === '사무영어필수' && LANG_GATE_RANKS.includes(employee.rank)
}

// 영어 또는 제2외국어 중 하나라도 Im3(2점) 이상이거나 평생인정이면 충족 — "영어"가 아니라 "외국어" 요건이라 둘 다 인정
export function engGateMet(employee) {
  const engOk = (employee.eng_pts || 0) >= 2 || !!employee.eng_lifetime
  const eng2Ok = (employee.eng2_pts || 0) >= 2 || !!employee.eng2_lifetime
  return engOk || eng2Ok
}

// 대시보드/포인트현황 등에서 공통으로 쓰는 직군 구분.
// "임원"은 승진 기준 유무(hasCriteria)가 아니라 직급 자체로 판단해야 함 — 부장·수석연구원도
// 승진 기준이 없어(해당없음) hasCriteria는 false지만, 이들은 임원이 아니라 그냥 사무직/연구직 최고참
// 직급이라 각자의 트랙(사무/연구) 탭에 그대로 남아있어야 함. TRACKED_RANKS(사원~부장, 연구원~수석연구원)에
// 없는 직급(이사·상무·대표 등 진짜 임원 + 직급 미확인)만 "임원" 탭으로 분류.
export const CATEGORIES = [
  { key: '사무', track: '사무', test: (e) => TRACKED_RANKS.has(e.rank) && e.track === '사무' },
  { key: '사무영어필수', track: '사무영어필수', test: (e) => TRACKED_RANKS.has(e.rank) && e.track === '사무영어필수' },
  { key: '연구', track: '연구', test: (e) => TRACKED_RANKS.has(e.rank) && e.track === '연구' },
  { key: '임원', track: null, test: (e) => !TRACKED_RANKS.has(e.rank) },
]

// employee: employees 테이블 row, evaluations: 해당 직원의 evaluations rows, rankCriteriaMap: fetchRankCriteria() 결과
export function deriveEmployee(employee, evaluations, rankCriteriaMap) {
  const evalPtsSum = (evaluations || []).reduce((s, e) => s + Number(e.points || 0), 0)
  const rc = rankCriteriaMap?.[employee.rank]
  const req_tenure = rc?.req_tenure || 0
  const threshold = rc?.threshold || 0
  const hasCriteria = req_tenure > 0 || threshold > 0

  const R = evalCount(evaluations)
  const backfillPts = hasCriteria ? computeBackfill(employee.level, R, rc, employee.backfill_full_tenure) : 0
  // 가점(자격증·포상)만 포인트 합산에 들어감 — 영어/제2외국어는 별도 필수요건 필드로 분리(합산 제외)
  const addPts = (employee.cert_pts || 0) + (employee.award_pts || 0)
  const currentPts = Math.round((evalPtsSum + backfillPts + addPts) * 10) / 10

  const gap = Math.max(0, threshold - currentPts)
  const tenureMet = (employee.level || 0) >= req_tenure
  const ptsMet = currentPts >= threshold
  const engGated = isEngGateTrack(employee)
  const engOk = engGateMet(employee)

  // status: 대시보드 KPI처럼 "한 사람당 버킷 하나"가 필요한 곳에서 쓰는 대표 상태(우선순위 기반)
  let status
  if (!hasCriteria) status = 'na'
  else if (ptsMet && tenureMet) status = (!engGated || engOk) ? 'possible' : 'engShort'
  else if (ptsMet && !tenureMet) status = 'tenureShort'
  else if (!ptsMet && tenureMet) status = 'ptShort'
  else status = 'short'

  // issues: 실제로 걸려있는 미충족 사유를 전부 나열 — 연차·포인트·외국어가 동시에 부족할 수도 있어서
  // (목록 화면 상태 컬럼은 이 배열을 뱃지 여러 개로 보여줌)
  const issues = []
  if (hasCriteria) {
    if (!tenureMet) issues.push('tenureShort')
    if (!ptsMet) issues.push('ptShort')
    if (engGated && !engOk) issues.push('engShort')
    if (issues.length === 0) issues.push('possible')
  } else {
    issues.push('na')
  }

  return {
    ...employee, evalPts: evalPtsSum, backfillPts, addPts, currentPts, gap,
    req_tenure, threshold, tenureMet, ptsMet, hasCriteria, engGated, engOk, status, issues,
  }
}
