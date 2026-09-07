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

// 등급이 아니라 점수로만 존재하는 값(경력인정P 등)을 등급색으로 시각화할 때 쓰는 역매핑 —
// GRADE_HEIGHT(등급별 점수 스케일)에서 가장 가까운 등급을 찾아줌. 구체계(S~D) 기준으로만 비교.
const GRADE_ORDER = ['D', 'C', 'B', 'B+', 'A', 'A+', 'S']
export function nearestGrade(points) {
  let best = GRADE_ORDER[0]
  let bestDiff = Infinity
  GRADE_ORDER.forEach((g) => {
    const diff = Math.abs((GRADE_HEIGHT[g] || 0) - points)
    if (diff < bestDiff) { bestDiff = diff; best = g }
  })
  return best
}

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

// ═══ 직급/직군 체계 ═══
// 사무직(일반)/사무직(영어필수)/연구직: 승진포인트 추적 대상 (체류연한·기준P는 rank_criteria 테이블에서 관리 — 하드코딩 아님)
// 임원: 명단/입퇴사 관리용으로만 목록에 포함 — rank_criteria에 없는 직급이라 자동으로 '해당없음' 처리됨
export const OFFICE_RANKS = ['사원', '대리', '과장', '차장', '부장']
export const RESEARCH_RANKS = ['연구원', '전임연구원', '선임연구원', '책임연구원', '수석연구원']
export const EXEC_RANKS = ['이사', '상무이사', '전무이사', '부사장', '수석부사장', '대표', '부회장', '회장']

// 값 자체가 "사무외국어필수"입니다 — 영어뿐 아니라 중국어·일본어로도 요건을 채울 수 있어서
// 예전 이름(사무영어필수)에서 바꿨습니다. DB(employees.track, CHECK 제약)도 이 값으로 마이그레이션됨.
export const TRACKS = [
  { value: '사무', label: '사무직 (일반)' },
  { value: '사무외국어필수', label: '사무직 (외국어필수)' },
  { value: '연구', label: '연구직' },
]
export const TRACK_LABEL = Object.fromEntries(TRACKS.map((t) => [t.value, t.label]))

// 외국어필수 트랙 자동 제안 대상 (2026-09-01 조직개편 기준) — 미래전략실·마케팅본부는 본부 전체,
// 해외영업은 해외영업본부 산하 팀 전부(해외영업1/2팀·해외법인영업팀), 해외CS는 고객만족본부 산하 "해외CS팀"만
// 콕 집어 대상 — 같은 본부라도 국내CS1/2팀·한국영업1/2팀 등 국내 담당은 일반으로 분류
export const FOREIGN_LANG_REQUIRED_ORGS = ['미래전략실', '마케팅본부', '해외영업', '해외CS']
export function suggestTrackForDept(dept, isResearch, team) {
  if (isResearch) return '연구'
  if (!dept && !team) return '사무'
  const hit = (val) => !!val && FOREIGN_LANG_REQUIRED_ORGS.some((d) => val.includes(d) || d.includes(val))
  return (hit(dept) || hit(team)) ? '사무외국어필수' : '사무'
}

// ═══ 부서(본부 단위) 목록 — 2026-09-01 조직개편(TO-BE 조직도) 기준 ═══
// 실제 employees 데이터에 있는 부서와 합쳐서 드롭다운에 사용. 4개 부문 산하 9개 본부·연구소 +
// COO 직속 특수조직(미래전략실·고객만족본부)까지 — 팀 단위는 여기 안 넣고 각 화면의 "팀" 칸에 자유입력함
export const DEPT_OPTIONS = [
  '연구소', '생산기술연구소', '제2생산기술연구소', '판교연구소',
  '마케팅본부', '해외영업본부', '국내영업본부', '메디컬솔루션본부',
  '미래전략실', '고객만족본부',
]

// ═══ 지역(위치) — "소속"(부문-본부-팀) 앞에 붙는 상위 구분 ═══
// 대전(원텍연구원)/판교(경영그룹)/해외법인 3개 축. 대전 소속인데 해외로 파견 나간 경우처럼
// 한 사람이 2곳에 걸칠 수 있어서 다중 선택(배열, employees.locations text[])으로 저장합니다.
// 조직개편으로 이름이 바뀔 수 있어서 하드코딩 최소화 — 화면에는 이 배열 순서 그대로 노출.
export const LOCATIONS = ['대전(원텍연구원)', '판교', '해외법인']
export const LOCATION_STYLE = {
  '대전(원텍연구원)': { c: B, bg: '#e0f2fe' },
  판교: { c: P, bg: '#f3e8ff' },
  해외법인: { c: G, bg: '#dcfce7' },
}

// ═══ 소속 3단계: 부문 → 본부 → 팀 (2026-09 조직개편, 예전엔 실 → 팀 → 파트였음) ═══
// DB 컬럼명은 마이그레이션 비용 때문에 유지: division(부문, 예전 '실') / dept(본부, 예전 '팀') / team(팀, 예전 '파트')
export const ORG_LEVEL_LABEL = { division: '부문', dept: '본부', team: '팀' }

// 부문 · 본부 · 팀을 화면에 보여줄 때 쓰는 공용 결합 함수 (없는 단계는 건너뜀)
export function orgPath(e) {
  return [e?.division, e?.dept, e?.team].filter(Boolean).join(' · ')
}

// 직원 파생 필드 계산(deriveEmployee)은 rank_criteria 파라미터 테이블을 참조해야 해서
// src/lib/promotion.js 로 옮겼습니다 (하드코딩된 직급 기준표 대신 DB 설정값 사용).

export const STATUS_LABEL = {
  possible: { label: '승진 가능', color: G, bg: '#dcfce7' },
  ptShort: { label: '포인트 부족', color: Y, bg: '#fef9c3' },
  tenureShort: { label: '연차 부족', color: Y, bg: '#fef9c3' },
  engShort: { label: '외국어 미충족', color: '#c026d3', bg: '#fae8ff' },
  short: { label: '미충족', color: R, bg: '#fee2e2' },
  onLeave: { label: '🌿 휴직중', color: '#0d9488', bg: '#ccfbf1' },
  na: { label: '해당없음', color: '#94a3b8', bg: '#f1f5f9' },
}
