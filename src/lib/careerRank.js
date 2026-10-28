// ═══ 채용 — 경력 연차로 입사 직급·연차 추정 ═══
// rank_criteria의 체류연한(req_tenure)을 사원→대리→과장… 순서로 누적해서, 인정 경력이 몇 년이면
// 어느 직급의 몇 연차에 해당하는지 계산합니다(예: 사원·대리 4년씩이면 경력 6년 → 대리 2연차).
// 기준표 값은 "기준값 설정"에서 바뀌면 그대로 따라감 — 여기 직급 순서 외엔 하드코딩 없음.
import { OFFICE_RANKS, RESEARCH_RANKS } from './constants'

export const ranksForTrack = (track) => (track === '연구' ? RESEARCH_RANKS : OFFICE_RANKS)

// 인정 경력(개월) = 실제 경력 × 인정비율 — 연차는 만 년수로 끊음(남는 개월은 버림, employees.level이 정수라서)
export function recognizedYears(careerMonths, ratePct = 100) {
  const m = Math.max(0, Number(careerMonths) || 0) * (Number(ratePct) || 0) / 100
  return Math.floor(m / 12)
}

// 반환: { rank, level, steps } — steps는 화면에 "사원 4년 → 대리 2년" 식으로 풀어 보여줄 구간들.
// 체류연한이 0인(기준 없는) 직급에 닿으면 거기서 멈추고 남은 연차를 전부 그 직급 연차로 봄(트랙 최고 직급).
export function estimateRank(years, track, criteriaMap) {
  const ranks = ranksForTrack(track)
  let left = Math.max(0, Math.floor(Number(years) || 0))
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
  const r = m % 12
  return [y ? `${y}년` : '', r ? `${r}개월` : ''].filter(Boolean).join(' ') || '신입'
}
