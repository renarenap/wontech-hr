// "임직원변동현황" 워드파일(월별 입사/퇴사 표) 파싱
// 표 구조: 월 | 임직원수 | 입사 | 퇴사 | 비고
// 입사/퇴사 칸에는 한 줄(문단)에 한 명씩: "이름 직급 일(부서)-지점" (퇴사는 "부서/근속연수")
import JSZip from 'jszip'
import { OFFICE_RANKS, RESEARCH_RANKS, EXEC_RANKS } from './constants'

// 워드 문서에 쓰이는 축약 직급 → 승진포인트 시스템 정식 직급명
const RANK_ALIAS = {
  전임: '전임연구원', 선임: '선임연구원', 책임: '책임연구원', 수석: '수석연구원',
  // 임원 직함 축약형 → EXEC_RANKS 정식 명칭 (이사/부사장/수석부사장/대표/부회장/회장은 이미 정식 명칭과 동일)
  상무: '상무이사', 전무: '전무이사', 대표이사: '대표',
}
const TRACKED_RANKS = new Set([...OFFICE_RANKS, ...RESEARCH_RANKS, ...EXEC_RANKS])

export function normalizeRank(rank) {
  const r = (rank || '').trim()
  return RANK_ALIAS[r] || r
}

export function isTrackedRank(rank) {
  return TRACKED_RANKS.has(normalizeRank(rank))
}

function paragraphText(pEl) {
  const ts = pEl.getElementsByTagName('w:t')
  let s = ''
  for (let i = 0; i < ts.length; i++) s += ts[i].textContent
  return s.trim()
}

function cellParagraphs(tcEl) {
  const ps = tcEl.getElementsByTagName('w:p')
  const out = []
  for (let i = 0; i < ps.length; i++) {
    const t = paragraphText(ps[i])
    if (t) out.push(t)
  }
  return out
}

// "이름 직급 일(부서)-지점" / "이름 직급 일(부서/근속연수)-지점" / "이름 직급 일[부서(비고)]-지점"
const ENTRY_RE = /^(\S+)\s+(\S+)\s+(\d{1,2})\s*[([](.+)[)\]]\s*-\s*(\S+)$/

function parseEntry(raw, year, month, kind) {
  const clean = raw.replace(/\s+/g, ' ').trim()
  const m = clean.match(ENTRY_RE)
  if (!m) return { raw: clean, ok: false, kind }
  const [, name, rankRaw, day, bracket, branch] = m
  let dept = bracket.trim().replace(/^\(+/, '')
  let tenure = null
  if (kind === 'resign') {
    const idx = dept.lastIndexOf('/')
    if (idx !== -1) {
      tenure = dept.slice(idx + 1).trim()
      dept = dept.slice(0, idx).trim()
    }
  }
  const rank = normalizeRank(rankRaw)
  const dd = String(parseInt(day, 10)).padStart(2, '0')
  const mm = String(month).padStart(2, '0')
  return {
    raw: clean, ok: true, kind,
    name: name.trim(), rank, dept, branch, tenure,
    date: `${year}-${mm}-${dd}`,
  }
}

export async function parseChangesDocx(file) {
  const zip = await JSZip.loadAsync(file)
  const entry = zip.file('word/document.xml')
  if (!entry) throw new Error('올바른 .docx 파일이 아닌 것 같아요 (word/document.xml 없음).')
  const xmlText = await entry.async('text')
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('문서를 읽는 중 문제가 발생했어요.')
  }

  const bodyText = doc.documentElement.textContent || ''
  const yearMatch = bodyText.match(/(20\d{2})\s*년?\s*임직원변동현황/) || bodyText.match(/(20\d{2})/)
  const year = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear()

  const tables = doc.getElementsByTagName('w:tbl')
  if (tables.length === 0) throw new Error('문서에서 표를 찾지 못했어요.')
  const trs = tables[0].getElementsByTagName('w:tr')

  const months = []
  for (let ri = 1; ri < trs.length; ri++) {
    const tcs = trs[ri].getElementsByTagName('w:tc')
    if (tcs.length < 4) continue
    const monthText = cellParagraphs(tcs[0])[0] || ''
    const month = parseInt(monthText, 10)
    if (!month) continue
    const hires = cellParagraphs(tcs[2]).map((l) => parseEntry(l, year, month, 'hire'))
    const resigns = cellParagraphs(tcs[3]).map((l) => parseEntry(l, year, month, 'resign'))
    months.push({ month, hires, resigns })
  }
  return { year, months }
}
