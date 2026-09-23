// ═══ 상세 분석 — 내년 승진 예상 / 고과 추이 계산 (화면과 분리해 둔 순수 함수들) ═══
import { GRADE_HEIGHT, SIM_GRADE_POINTS, sortByPeriod } from './constants'
import { deriveEmployee } from './promotion'

// 평가 이력 period 표기는 연도 끝 두 자리('26')라서 올해 연간평가도 같은 형식으로 만듦
export function currentEvalPeriod(date = new Date()) {
  return String(date.getFullYear()).slice(2)
}

// 올해 연간평가를 grade로 받았다고 치고 + 연차 일괄 +1까지 된 뒤의 상태를 다시 계산.
// 현재 포인트에 등급 점수만 더하는 게 아니라 deriveEmployee를 그대로 다시 돌리는 이유:
// 연차가 +1 되면 평가 반영범위((연차-1)×2 반기)가 넓어지고, 연차 부족이던 사람은 체류연한도 채울 수 있어서.
// 올해 평가가 이미 입력돼 있으면(grade 인자 없이) 실제 평가로 계산함.
export function projectNextYear(employee, evaluations, rankCriteriaMap, leaveRate, grade, period = currentEvalPeriod()) {
  const evals = grade
    ? [...(evaluations || []).filter((e) => e.period !== period), { period, grade, points: SIM_GRADE_POINTS[grade] }]
    : evaluations || []
  return deriveEmployee({ ...employee, level: (employee.level || 0) + 1 }, evals, rankCriteriaMap, leaveRate)
}

const passes = (p) => p.ptsMet && p.tenureMet

// 내년 승진 예상 분류 — 지금 이미 기준을 채운 사람·기준 없는 사람·휴직중은 여기서 다루지 않음(각각 별도 표시)
//   safe  : GD만 받아도 통과(평가만 무난하면 내년 승진 대상)
//   needVG: VG 이상이어야 통과
//   needEX: EX여야 통과
//   no    : EX를 받아도 미달
// 올해 평가가 이미 입력된 사람은 등급 가정 없이 실제값으로 계산해서 safe/no 둘 중 하나로만 나눔(confirmed=true)
export const OUTLOOK = {
  safe: { label: '안정권', desc: 'GD만 받아도 통과', color: '#16a34a', bg: '#dcfce7' },
  needVG: { label: '고과 필요', desc: 'VG 이상 필요', color: '#ca8a04', bg: '#fef9c3' },
  needEX: { label: 'EX 필요', desc: 'EX여야 통과', color: '#ea580c', bg: '#ffedd5' },
  no: { label: '내년 불가', desc: 'EX여도 미달', color: '#64748b', bg: '#f1f5f9' },
}

export function nextYearOutlook(derived, evaluations, rankCriteriaMap, leaveRate, period = currentEvalPeriod()) {
  if (!derived.hasCriteria) return { bucket: 'na' }
  if (derived.status === 'possible' || derived.status === 'execReview') return { bucket: 'already' }
  if (derived.onLeaveNow) return { bucket: 'onLeave' }

  const confirmed = (evaluations || []).some((e) => e.period === period)
  const langBlocked = derived.engGated && !derived.engOk
  if (confirmed) {
    const p = projectNextYear(derived, evaluations, rankCriteriaMap, leaveRate, null, period)
    return { bucket: passes(p) ? 'safe' : 'no', confirmed, langBlocked, projections: { actual: p }, best: p }
  }

  const projections = {}
  let bucket = 'no'
  for (const [g, b] of [['GD', 'safe'], ['VG', 'needVG'], ['EX', 'needEX']]) {
    projections[g] = projectNextYear(derived, evaluations, rankCriteriaMap, leaveRate, g, period)
    if (bucket === 'no' && passes(projections[g])) bucket = b
  }
  return { bucket, confirmed, langBlocked, projections, best: projections.EX }
}

// ═══ 고과 추이 ═══
// 반기('23상')는 1건, 연간('26')은 반기 2건분 — 평균은 이 가중치로 계산(evalCount와 같은 기준)
const unitsOf = (e) => (e.period?.endsWith('상') || e.period?.endsWith('하') ? 1 : 2)
export const scoreOf = (e) => GRADE_HEIGHT[e.grade] ?? null

function weightedAvg(list) {
  let sum = 0
  let units = 0
  list.forEach((e) => {
    const s = scoreOf(e)
    if (s == null) return
    sum += s * unitsOf(e)
    units += unitsOf(e)
  })
  return units ? Math.round((sum / units) * 10) / 10 : null
}

// recentN: 최근 몇 건(평가 횟수 기준)을 볼지 / goodMin: 이 점수(GRADE_HEIGHT) 이상이면 우수(8 = A·VG 이상)
// lowMax: 이 점수 이하면 저고과(4 = C·NI 이하)
export function gradeTrend(evaluations, { recentN = 4, goodMin = 8, lowMax = 4 } = {}) {
  const sorted = sortByPeriod((evaluations || []).filter((e) => scoreOf(e) != null))
  const recent = sorted.slice(-recentN)

  let streak = 0
  for (let i = sorted.length - 1; i >= 0 && scoreOf(sorted[i]) >= goodMin; i--) streak++

  // 추세: 최근 2건 평균 vs 그 직전 2건 평균 — 비교할 이력이 3건 이상일 때만 판단
  let trend = null
  if (sorted.length >= 3) {
    const diff = weightedAvg(sorted.slice(-2)) - weightedAvg(sorted.slice(-4, -2))
    trend = diff >= 1 ? 'up' : diff <= -1 ? 'down' : 'flat'
  }

  return {
    count: sorted.length,
    recent,
    avg: weightedAvg(recent),
    streak,
    lowCount: recent.filter((e) => scoreOf(e) <= lowMax).length,
    trend,
  }
}

export const TREND_LABEL = {
  up: { label: '↗ 상승', color: '#16a34a' },
  flat: { label: '→ 유지', color: '#64748b' },
  down: { label: '↘ 하락', color: '#dc2626' },
}

// 주의 대상 사유 — 한 사람이 여러 개에 걸릴 수 있음
export const WATCH_REASON = {
  down: { label: '고과 하락', color: '#dc2626', bg: '#fee2e2' },
  low: { label: '저고과 반복', color: '#991b1b', bg: '#fee2e2' },
  stalled: { label: '승진 정체', color: '#ca8a04', bg: '#fef9c3' },
  langOnly: { label: '외국어만 남음', color: '#c026d3', bg: '#fae8ff' },
}

// stallYears: 체류연한을 이만큼 넘겼는데도 포인트가 모자라면 "승진 정체"
export function watchReasons(derived, trend, { stallYears = 2 } = {}) {
  const out = []
  if (trend.trend === 'down') out.push('down')
  if (trend.lowCount >= 2) out.push('low')
  if (derived.hasCriteria && !derived.onLeaveNow && derived.tenureMet && !derived.ptsMet
    && derived.effectiveLevel >= derived.req_tenure + stallYears) out.push('stalled')
  if (derived.status === 'engShort') out.push('langOnly')
  return out
}
