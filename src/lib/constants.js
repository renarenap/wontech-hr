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

// ═══ 직급/직군 체계 ═══
// 사무직(일반)/사무직(영어필수)/연구직: 승진포인트 추적 대상 (체류연한·기준P는 rank_criteria 테이블에서 관리 — 하드코딩 아님)
// 임원: 명단/입퇴사 관리용으로만 목록에 포함 — rank_criteria에 없는 직급이라 자동으로 '해당없음' 처리됨
export const OFFICE_RANKS = ['사원', '대리', '과장', '차장', '부장']
export const RESEARCH_RANKS = ['연구원', '전임연구원', '선임연구원', '책임연구원', '수석연구원']
export const EXEC_RANKS = ['이사', '상무이사', '전무이사', '부사장', '수석부사장', '대표', '부회장', '회장']

// DB에는 그대로 '사무영어필수' 값으로 저장되지만(마이그레이션 비용 때문에 키는 유지),
// 화면에 보이는 이름은 "외국어필수"입니다 — 영어뿐 아니라 제2외국어로도 요건을 채울 수 있어서요.
export const TRACKS = [
  { value: '사무', label: '사무직 (일반)' },
  { value: '사무영어필수', label: '사무직 (외국어필수)' },
  { value: '연구', label: '연구직' },
]
export const TRACK_LABEL = Object.fromEntries(TRACKS.map((t) => [t.value, t.label]))

// 외국어필수 트랙 자동 제안 대상 부서 (마케팅·미래전략·해외CS·해외영업 계열 — 한국영업/국내CS 등 국내 담당은 일반으로 분류)
export const FOREIGN_LANG_REQUIRED_DEPTS = [
  '마케팅실', '미래전략실', '전략기획팀', '해외CS파트', '대전 국내CS파트', '판교 국내CS파트',
  '글로벌영업실', '글로벌영업팀', '해외법인영업파트', '해외영업팀', '해외법인영업', '해외영업',
]
export function suggestTrackForDept(dept, isResearch) {
  if (isResearch) return '연구'
  if (!dept) return '사무'
  return FOREIGN_LANG_REQUIRED_DEPTS.some((d) => dept.includes(d) || d.includes(dept)) ? '사무영어필수' : '사무'
}

// ═══ 부서(파트 단위) 목록 ═══
// 2026.08.20자 조직도 기준으로 뽑아둔 목록 — 실제 employees 데이터에 있는 부서와 합쳐서 드롭다운에 사용
export const DEPT_OPTIONS = [
  'B2C사업부', 'CA(Clinical Application)파트', 'Experience파트', 'H/W 개발 파트', 'S/W 개발 파트', 'TCF팀',
  '감사법무파트', '경영기획팀', '경영진', '고객만족팀', '구매팀', '글로벌물류관리팀', '글로벌영업실', '기획파트',
  '대외협력파트', '대전 국내CS파트', '대전 인사파트', '대전 인허가파트', '레이저광학팀', '마케팅실', '메디컬솔루션팀',
  '미래전략실', '미주/아시아파트', '브랜드전략파트', '상품전략파트', '생산기술 1팀', '생산기술 2팀', '생산기술 3팀',
  '생산기술연구소', '써지컬 사업파트', '엔지니어링팀', '연구소', '연구지원팀', '영업전략파트', '유럽/중아(중동&아프리카)파트',
  '인허가팀', '재무파트', '전기전자팀', '전략기획팀', '전략마케팅팀', '정보보호파트', '제2생산기술연구소', '중화파트',
  '판교 국내CS파트', '판교 인사파트', '판교 인허가파트', '판교연구소', '품질관리팀', '한국영업 1파트', '한국영업 2파트',
  '해외CS파트', '해외법인영업파트', '해외영업팀', '청소미화',
]

// 직원 파생 필드 계산(deriveEmployee)은 rank_criteria 파라미터 테이블을 참조해야 해서
// src/lib/promotion.js 로 옮겼습니다 (하드코딩된 직급 기준표 대신 DB 설정값 사용).

export const STATUS_LABEL = {
  possible: { label: '승진 가능', color: G, bg: '#dcfce7' },
  ptShort: { label: '포인트 부족', color: Y, bg: '#fef9c3' },
  tenureShort: { label: '연차 부족', color: Y, bg: '#fef9c3' },
  engShort: { label: '외국어 미충족', color: '#c026d3', bg: '#fae8ff' },
  short: { label: '미충족', color: R, bg: '#fee2e2' },
  na: { label: '해당없음', color: '#94a3b8', bg: '#f1f5f9' },
}
