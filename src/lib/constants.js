// ═══ 브랜드 컬러 ═══
export const O = '#FF4800' // orange
export const P = '#7E3FD8' // purple
export const G = '#16a34a' // green
export const Y = '#ca8a04' // yellow
export const R = '#dc2626' // red
export const B = '#0284c7' // blue

// ═══ 평가등급 ═══
// '23~'25 반기 등급(S,A+,A,B+,B,C,D) + 2026년 이후 연간 등급(EX,VG,GD,NI,UN)
export const GRADE_LABEL = {
  S: 'EX', 'A+': 'VG+', A: 'VG', 'B+': 'GD+', B: 'GD', C: 'NI', D: 'UN',
  EX: 'EX', VG: 'VG', GD: 'GD', NI: 'NI', UN: 'UN',
}

export const GRADE_COLOR = {
  S: O, 'A+': '#e8590c', A: P, 'B+': '#6366f1', B: '#94a3b8', C: '#ef4444', D: '#991b1b',
  EX: O, VG: P, GD: '#94a3b8', NI: '#ef4444', UN: '#991b1b',
}

// 평가 이력 막대그래프 높이 계산용 포인트 스케일 (0~10)
export const GRADE_HEIGHT = {
  S: 10, 'A+': 9, A: 8, 'B+': 7, B: 6, C: 4, D: 2,
  EX: 10, VG: 8, GD: 6, NI: 4, UN: 2,
}

// 2026 시뮬레이션에서 등급 선택 시 가산되는 예상 포인트
export const SIM_GRADE_POINTS = { EX: 10, VG: 8, GD: 6, NI: 4 }

// period 문자열('23상','23하',...,'26','27'...) 정렬 키
export function periodSortKey(period) {
  if (!period) return 0
  const half = period.endsWith('상') ? 1 : period.endsWith('하') ? 2 : 0
  const year = parseInt(period, 10)
  if (Number.isNaN(year)) return 0
  return half ? year * 10 + half : year * 10
}

export function sortByPeriod(list) {
  return [...list].sort((a, b) => periodSortKey(a.period) - periodSortKey(b.period))
}

// ═══ 직급 체계 (승진포인트 추적 대상만 — 임원급(이사 이상)은 이 시스템의 대상이 아님) ═══
export const OFFICE_RANKS = ['사원', '대리', '과장', '차장', '부장']
export const RESEARCH_RANKS = ['연구원', '전임연구원', '선임연구원', '책임연구원', '수석연구원']

// 직급별 체류연한/진급포인트 기본값 (기준표 ⑤ 참고 — 신규 입사자 등록 시 자동 적용)
export const RANK_DEFAULTS = {
  사원: { req_tenure: 4, threshold: 24 }, 대리: { req_tenure: 4, threshold: 24 },
  과장: { req_tenure: 5, threshold: 35 }, 차장: { req_tenure: 5, threshold: 36 }, 부장: { req_tenure: 5, threshold: 40 },
  연구원: { req_tenure: 4, threshold: 24 }, 전임연구원: { req_tenure: 4, threshold: 24 },
  선임연구원: { req_tenure: 6, threshold: 40 }, 책임연구원: { req_tenure: 7, threshold: 48 }, 수석연구원: { req_tenure: 4, threshold: 32 },
}

// ═══ 직원 파생 필드 계산 ═══
// employee: employees 테이블 row, evalPtsSum: evaluations.points 합계
export function deriveEmployee(employee, evalPtsSum = 0) {
  const addPts =
    (employee.eng_pts || 0) + (employee.eng2_pts || 0) + (employee.cert_pts || 0) + (employee.award_pts || 0)
  const currentPts = evalPtsSum + (employee.base_pts || 0) + addPts
  const gap = Math.max(0, employee.threshold - currentPts)
  const tenureMet = (employee.level || 0) >= employee.req_tenure
  const ptsMet = currentPts >= employee.threshold
  const status = ptsMet && tenureMet ? 'possible' : tenureMet && !ptsMet ? 'ptShort' : 'short'
  return { ...employee, evalPts: evalPtsSum, addPts, currentPts, gap, tenureMet, ptsMet, status }
}

export const STATUS_LABEL = {
  possible: { label: '승진 가능', color: G, bg: '#dcfce7' },
  ptShort: { label: '포인트 부족', color: Y, bg: '#fef9c3' },
  short: { label: '미충족', color: R, bg: '#fee2e2' },
}
