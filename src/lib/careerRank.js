// ═══ 채용 — 학력·경력으로 입사 직급·연차 추정 ═══
// 인정 연차 = 인정 경력(만 년수) + 학력 가감 연차. 이걸 rank_criteria의 체류연한(req_tenure)을
// 사원→대리→과장… 순서로 누적한 구간에 대입해서 어느 직급의 몇 연차인지 계산합니다
// (예: 사원·대리 4년씩이면 인정 6년 → 대리 2연차). 기준표 값은 "기준값 설정"에서 바뀌면 그대로 따라감.
import { OFFICE_RANKS, RESEARCH_RANKS } from './constants'

export const ranksForTrack = (track) => (track === '연구' ? RESEARCH_RANKS : OFFICE_RANKS)

// 학력 인정 기준 — 졸업/수료별 가감 연차 (수료는 박사·석사만)
export const EDU_RULES = {
  박사: { 졸업: 4, 수료: 3 },
  석사: { 졸업: 2, 수료: 1 },
  '4년제 대졸': { 졸업: 0 },
  전문대졸: { 졸업: -1 },
  고졸: { 졸업: -2 },
}
export const EDU_LEVELS = Object.keys(EDU_RULES)
export const eduStatuses = (level) => Object.keys(EDU_RULES[level] || {})
export const eduAdjust = (level, status) => EDU_RULES[level]?.[status] ?? EDU_RULES[level]?.졸업 ?? 0

// 경력 인정 기준 — 직무 유사도 상/중/하 = 100/80/50%
export const SIMILARITY = [
  { value: '상', rate: 100 },
  { value: '중', rate: 80 },
  { value: '하', rate: 50 },
]
export const similarityRate = (s) => SIMILARITY.find((x) => x.value === s)?.rate ?? 100

// 경력 불인정: 프리랜서·개인사업자, 인턴, 6개월 미만 — 단, 상황에 따라 예외 인정 가능(비고에 사유 표기)
export const CAREER_TYPES = ['정규·계약직', '프리랜서·개인사업자', '인턴']
export const MIN_CAREER_MONTHS = 6

export const newCareerEntry = () => ({ company: '', years: 0, months: 0, type: '정규·계약직', similarity: '상', exception: false, note: '' })
export const entryMonths = (e) => Math.max(0, (Number(e.years) || 0) * 12 + (Number(e.months) || 0))

// 경력 한 건의 인정 여부 — { ok, reason, rate, months(인정 개월) }
export function judgeEntry(e) {
  const raw = entryMonths(e)
  const rate = similarityRate(e.similarity)
  let reason = null
  if (e.type !== '정규·계약직') reason = e.type
  else if (raw > 0 && raw < MIN_CAREER_MONTHS) reason = `${MIN_CAREER_MONTHS}개월 미만`
  const ok = !reason || !!e.exception
  return { ok, reason, rate, raw, months: ok ? (raw * rate) / 100 : 0 }
}

// 학력+경력 전체 계산 — 인정 경력은 개월 단위로 합친 뒤 만 년수로 끊음(남는 개월은 버림, employees.level이 정수라서)
export function calcCareer({ track, edu_level, edu_status, entries = [] }, criteriaMap) {
  const judged = entries.map((e) => ({ ...e, judge: judgeEntry(e) }))
  const recMonths = Math.round(judged.reduce((s, e) => s + e.judge.months, 0) * 10) / 10
  const careerYears = Math.floor(recMonths / 12)
  const eduYears = edu_level ? eduAdjust(edu_level, edu_status) : 0
  const total = careerYears + eduYears
  return { judged, recMonths, careerYears, eduYears, total, ...estimateRank(total, track, criteriaMap) }
}

// 반환: { rank, level, steps } — steps는 화면에 "사원 4년 → 대리 2년" 식으로 풀어 보여줄 구간들.
// 인정 연차가 마이너스면(예: 고졸 신입 -2) 첫 직급의 마이너스 연차 — 입사자 등록의 "연차 마이너스" 입력과 같은 의미.
// 체류연한이 0인(기준 없는) 직급에 닿으면 거기서 멈추고 남은 연차를 전부 그 직급 연차로 봄(트랙 최고 직급).
export function estimateRank(years, track, criteriaMap) {
  const ranks = ranksForTrack(track)
  let left = Math.floor(Number(years) || 0)
  if (left < 0) return { rank: ranks[0], level: left, steps: [{ rank: ranks[0], years: left, current: true }] }
  const steps = []
  for (let i = 0; i < ranks.length; i++) {
    const rank = ranks[i]
    const req = criteriaMap?.[rank]?.req_tenure || 0
    const last = i === ranks.length - 1 || req <= 0
    if (last || left < req) {
      steps.push({ rank, years: left, current: true })
      return { rank, level: left, steps }
    }
    steps.push({ rank, years: req })
    left -= req
  }
  return { rank: ranks[0], level: 0, steps }
}

export const careerLabel = (months) => {
  const m = Math.max(0, Number(months) || 0)
  const y = Math.floor(m / 12)
  const r = Math.round((m - y * 12) * 10) / 10
  return [y ? `${y}년` : '', r ? `${r}개월` : ''].filter(Boolean).join(' ') || '0개월'
}
