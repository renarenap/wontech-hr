import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../lib/auth'
import { sortByPeriod, TRACKS, TRACK_LABEL, STATUS_LABEL, LOCATIONS, EXEC_RANKS, ORG_LEVEL_LABEL, orgPath, GRADE_COLOR, nearestGrade, baseRank, P, B, G, R, O } from '../lib/constants'
import { deriveEmployee, evalCount, fetchRankCriteria, fetchLeaveRate, CATEGORIES } from '../lib/promotion'
import { fetchLevelReferenceYear, fetchLatestBumpBatch, applyLevelBump, undoLevelBump } from '../lib/levelBump'
import { Bd, GB, NoteFlagBadge, LocationBadges, Prog, TenureBar, Tip, thS, tdS, inp, Loading, ErrorBox, EmptyState, Modal, btnPrimary, btnGhost } from '../components/ui'
import { downloadCSV, parseCSV } from '../lib/csv'

// 전체 명단 CSV를 실제로 다운로드했을 때 관리자에게 알림(이메일) — 실패해도 다운로드 자체는 막지 않음
async function notifyDownload(rowCount) {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify-download`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ rowCount }),
    })
  } catch {
    // 알림 실패는 조용히 무시
  }
}

const TRACK_BADGE = { 사무: { c: '#475569', bg: '#f1f5f9' }, 사무외국어필수: { c: B, bg: '#e0f2fe' }, 연구: { c: P, bg: '#f3e8ff' } }
const CATEGORY_COLOR = { 사무: '#475569', 사무외국어필수: B, 연구: P, 임원: '#92400e' }
const CATEGORY_LABEL = { ...TRACK_LABEL, 임원: '임원' }

// CSV 내보내기/가져오기에 쓰는 편집 가능 컬럼 (id는 매칭용, 절대 수정·삭제 금지)
const CSV_COLUMNS = [
  { key: 'id', label: 'id' },
  { key: 'name', label: '이름' },
  { key: 'join_date', label: '입사일(YYYYMMDD 또는 YYYY-MM-DD)' },
  { key: 'locations', label: '위치(대전/판교/해외법인, 복수는 쉼표로 구분)' },
  { key: 'division', label: ORG_LEVEL_LABEL.division },
  { key: 'dept', label: ORG_LEVEL_LABEL.dept },
  { key: 'team', label: ORG_LEVEL_LABEL.team },
  { key: 'rank', label: '직급' },
  { key: 'role', label: '직책(팀장·본부장·부문장 등, 없으면 비워두세요)' },
  { key: 'track', label: '직군(사무/사무외국어필수/연구/임원)' },
  { key: 'level', label: '연차' },
  { key: 'leaveMonths', label: '휴직개월수(요율은 기준값 설정 참고, 체류연한에도 반영 · 시작·종료일 둘 다 있으면 자동계산되어 무시됨)' },
  { key: 'leave_start_date', label: '휴직시작일(YYYYMMDD 또는 YYYY-MM-DD)' },
  { key: 'leave_end_date', label: '휴직종료일(YYYYMMDD 또는 YYYY-MM-DD)' },
  { key: 'backfill_full_tenure', label: '경력직인정포인트 적용(TRUE/FALSE, 아니면 평가인정포인트로 계산)' },
  { key: 'eng_pts', label: '영어점수' },
  { key: 'eng_lifetime', label: '영어평생인정(TRUE/FALSE)' },
  { key: 'cn_pts', label: '중국어점수' },
  { key: 'cn_lifetime', label: '중국어평생인정(TRUE/FALSE)' },
  { key: 'jp_pts', label: '일본어점수' },
  { key: 'jp_lifetime', label: '일본어평생인정(TRUE/FALSE)' },
  { key: 'award_pts', label: '포상가점' },
  { key: 'note_flag', label: '비고평가(+/-/o, 기본 o)' },
  { key: 'cert_pts', label: '(참고)자격가점 — 상세화면 "자격증"에서 건별 등록' },
  { key: 'tech_pts', label: '(참고)기술성과가점 — 상세화면 "기술성과"에서 건별 등록' },
  { key: 'currentPts', label: '(참고)현재포인트' },
]
const CSV_EDITABLE_KEYS = ['name', 'join_date', 'locations', 'division', 'dept', 'team', 'rank', 'role', 'track', 'level', 'leave_years', 'leave_start_date', 'leave_end_date', 'backfill_full_tenure', 'eng_pts', 'eng_lifetime', 'cn_pts', 'cn_lifetime', 'jp_pts', 'jp_lifetime', 'award_pts', 'note_flag']
const CSV_BOOL_KEYS = new Set(['backfill_full_tenure', 'eng_lifetime', 'cn_lifetime', 'jp_lifetime'])
const CSV_NUM_KEYS = new Set(['level', 'leave_years', 'eng_pts', 'cn_pts', 'jp_pts', 'award_pts'])
// 상태 정렬용 우선순위 — 낮을수록(승진 가능) 먼저 옴
const STATUS_SORT_ORDER = { possible: 0, engShort: 1, ptShort: 2, tenureShort: 2, onLeave: 3, short: 4, na: 5 }
// 상태 필터에서 고를 수 있는 항목 — 실제로 issues 배열에 담기는 값만(상태 컬럼에 뱃지로 뜨는 것과 동일)
const STATUS_FILTER_KEYS = ['possible', 'tenureShort', 'ptShort', 'engShort', 'onLeave', 'na']
// 선택 다운로드(승진후보 등 골라서 CSV로) 전용 컬럼 — 포인트현황 표에 보이는 값 그대로
const SELECTION_CSV_COLUMNS = [
  { key: 'name', label: '이름' },
  { key: 'orgPathStr', label: `소속(${ORG_LEVEL_LABEL.division}·${ORG_LEVEL_LABEL.dept}·${ORG_LEVEL_LABEL.team})` },
  { key: 'rank', label: '직급' },
  { key: 'trackLabel', label: '직군' },
  { key: 'currentPts', label: '포인트' },
  { key: 'threshold', label: '진급기준' },
  { key: 'gapStr', label: '잔여' },
  { key: 'effectiveLevel', label: '연차(체류연한)' },
  { key: 'req_tenure', label: '요구연차' },
  { key: 'backfillPts', label: '경력인정P' },
  { key: 'statusLabel', label: '상태' },
  { key: 'note_flag', label: '비고평가(+/-/o)' },
  { key: 'latestNoteStr', label: '비고 최근 특이사항' },
  { key: 'latestCommentStr', label: '정성평가 최근 코멘트' },
]

// 경력인정P 산출 근거(툴팁 문구) + 평가이력에 점선 배지로 그릴 슬롯 수·등급색을 한 번에 계산
// - count: 점선 배지 몇 개로 나타낼지(경력직 인정포인트=연차 수, 평가 인정포인트=공백 건수)
// - grade: 슬롯 1개당 점수를 GRADE_HEIGHT에서 가장 가까운 등급으로 역매핑한 색상용 등급 문자
function backfillDetail(e) {
  if (!e.backfillPts) return { count: 0, grade: null, tooltip: '경력인정 P 대상 아님' }
  const rate = e.backfillRate || 0
  const lvl = e.level || 0
  if (e.backfill_full_tenure) {
    return { count: lvl, grade: nearestGrade(rate), tooltip: `경력직 인정포인트 · ${e.rank} ${rate}P/연차 × ${lvl}년 = ${e.backfillPts}P` }
  }
  // 경력직 인정포인트가 아닌 경우엔 평가인정포인트로 계산됨: 예상 반기 슬롯 - 실제 평가횟수(반기환산) 만큼을 기준점수 절반씩으로 채움
  const evaluated = evalCount(e.history)
  const expected = Math.max(0, (lvl - 1) * 2)
  const gapHalves = Math.max(0, expected - evaluated)
  return {
    count: gapHalves, grade: nearestGrade(rate / 2),
    tooltip: `평가 인정포인트 · ${e.rank} 예상평가 ${expected}건 − 실제 ${evaluated}건 = 공백 ${gapHalves}건 × ${rate}P÷2 = ${e.backfillPts}P`,
  }
}

// 평가이력 칸에 실제 평가 배지 뒤에 붙는 경력인정P 표시 — 반투명·점선으로 "실제 평가가 아니라 인정된 값"임을 구분
const BACKFILL_BADGE_MAX = 4
function BackfillBadge({ grade }) {
  const color = GRADE_COLOR[grade] || '#94a3b8'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 22, borderRadius: 5,
      fontSize: 10, fontWeight: 700, color, background: `${color}1a`, border: `1px dashed ${color}`, marginRight: 2, flexShrink: 0,
    }}>
      {grade}
    </span>
  )
}

function BackfillBadges({ employee }) {
  const { count, grade, tooltip } = backfillDetail(employee)
  if (count <= 0) return null
  const shown = Math.min(count, BACKFILL_BADGE_MAX)
  const overflow = count - shown
  return (
    <span onClick={(ev) => ev.stopPropagation()}>
      <Tip content={tooltip}>
        <span style={{ display: 'inline-flex', alignItems: 'center' }}>
          {Array.from({ length: shown }).map((_, i) => <BackfillBadge key={i} grade={grade} />)}
          {overflow > 0 && (
            <span style={{ fontSize: 9, fontWeight: 800, color: '#fff', background: O, borderRadius: 10, padding: '1px 6px', marginLeft: 1 }}>
              +{overflow}
            </span>
          )}
        </span>
      </Tip>
    </span>
  )
}

// 상태 다중선택 드롭다운 — 승진가능/연차부족/포인트부족/외국어미충족/휴직중/해당없음 중 여러 개를 동시에 켤 수 있음(정확히 일치 조건 —
// 예: "포인트부족"+"외국어미충족" 두 개를 켜면 딱 그 두 사유만 걸린 사람만 나옴. 연차부족까지 추가로 걸린 사람은 빠짐 —
// 그 사람까지 보려면 "연차부족"도 같이 켜야 함)
// 컬럼 헤더에 붙는 펼치기/접기 토글(▸/▾) — 클릭 시 그 컬럼의 모든 행이 한꺼번에 펼쳐지거나 접힘.
// 헤더가 정렬용 onClick을 이미 갖고 있을 수 있어(예: 소속) stopPropagation으로 분리.
function HeaderExpandToggle({ expanded, onToggle }) {
  return (
    <button
      type="button"
      onClick={(ev) => { ev.stopPropagation(); onToggle() }}
      title={expanded ? '접기' : '펼치기'}
      style={{
        marginLeft: 14, background: '#f1f5f9', border: 'none', borderRadius: 5, cursor: 'pointer',
        fontSize: 15, fontWeight: 700, color: '#475569', padding: '1px 7px', verticalAlign: 'middle', lineHeight: 1.4,
      }}
    >
      {expanded ? '▾' : '▸'}
    </button>
  )
}

function StatusFilterDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const onDocClick = (ev) => { if (ref.current && !ref.current.contains(ev.target)) setOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const toggle = (key) => onChange(value.includes(key) ? value.filter((v) => v !== key) : [...value, key])
  const label = value.length === 0 ? '전체 상태' : `상태 ${value.length}개 선택`

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        style={{ ...inp, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: value.length > 0 ? 'var(--text)' : undefined }}
        onClick={() => setOpen((o) => !o)}
      >
        {label} <span style={{ fontSize: 9, color: '#94a3b8' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 20, minWidth: 170,
          background: '#fff', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 20px rgba(0,0,0,.1)', padding: 6,
        }}>
          {STATUS_FILTER_KEYS.map((key) => {
            const cfg = STATUS_LABEL[key]
            return (
              <label
                key={key}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', fontSize: 12, cursor: 'pointer', borderRadius: 6 }}
                onMouseEnter={(ev) => (ev.currentTarget.style.background = '#f8fafc')}
                onMouseLeave={(ev) => (ev.currentTarget.style.background = 'transparent')}
              >
                <input type="checkbox" checked={value.includes(key)} onChange={() => toggle(key)} />
                <Bd color={cfg.color} bg={cfg.bg}>{cfg.label}</Bd>
              </label>
            )
          })}
          {value.length > 0 && (
            <button
              type="button"
              style={{ ...btnGhost, width: '100%', marginTop: 4, fontSize: 11, padding: '5px 0' }}
              onClick={() => onChange([])}
            >
              선택 초기화
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function EmployeeList() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [employees, setEmployees] = useState(null)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  // 탭(직군)은 URL 쿼리에 저장 — 상세페이지 갔다가 뒤로가기로 돌아와도 고른 탭이 그대로 유지되게
  const [searchParams, setSearchParams] = useSearchParams()
  const trackF = searchParams.get('track') || 'all' // 'all' | CATEGORIES[].key
  const setTrackF = (v) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (v === 'all') next.delete('track'); else next.set('track', v)
      return next
    }, { replace: true })
  }
  const [rankF, setRankF] = useState('all')
  const [locF, setLocF] = useState('all')
  const [divF, setDivF] = useState('all')
  const [deptF, setDeptF] = useState('all')
  const [teamF, setTeamF] = useState('all')
  // 상태 필터도 URL 쿼리에 저장 — 대시보드 KPI 카드에서 "필터링된 목록으로 바로가기" 링크를 걸 수 있게
  const statusF = useMemo(() => {
    const raw = searchParams.get('status')
    return raw ? raw.split(',').filter(Boolean) : []
  }, [searchParams])
  const setStatusF = (arr) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (!arr || arr.length === 0) next.delete('status'); else next.set('status', arr.join(','))
      return next
    }, { replace: true })
  }
  const [sortKey, setSortKey] = useState('currentPts')
  const [sortAsc, setSortAsc] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [showExportImport, setShowExportImport] = useState(false)
  const [showBumpLevel, setShowBumpLevel] = useState(false)
  const [latestBatch, setLatestBatch] = useState(null) // 되돌리기 버튼을 보여줄지 판단 — 안 되돌린 가장 최근 "연차 일괄 +1" 배치
  const [undoing, setUndoing] = useState(false)
  const [orgExpanded, setOrgExpanded] = useState(false) // 소속 컬럼 전체를 부문·본부·팀으로 펼칠지(헤더 토글, 전체 행 공통)
  const [historyExpanded, setHistoryExpanded] = useState(false) // 평가이력 컬럼 전체를 전체 이력+경력인정P로 펼칠지(헤더 토글, 전체 행 공통)
  const [selectedIds, setSelectedIds] = useState(() => new Set()) // 승진후보 등 골라서 CSV로 다운로드할 때 체크한 행

  useEffect(() => {
    let cancelled = false
    async function load() {
      setError(null)
      const [{ data: emps, error: e1 }, { data: evals, error: e2 }, { data: comments, error: e3 }, { data: notes, error: e4 }, rankCriteria, leaveRate] = await Promise.all([
        supabase.from('employees').select('*'),
        supabase.from('evaluations').select('employee_id, period, grade, points').order('period'),
        supabase.from('eval_comments').select('employee_id, comment_date, text').order('comment_date', { ascending: false }),
        supabase.from('note_entries').select('employee_id, entry_date, text').order('entry_date', { ascending: false }),
        fetchRankCriteria(),
        fetchLeaveRate(),
      ])
      if (cancelled) return
      if (e1 || e2 || e3 || e4) { setError(e1 || e2 || e3 || e4); return }
      const byEmp = {}
      ;(evals || []).forEach((ev) => {
        if (!byEmp[ev.employee_id]) byEmp[ev.employee_id] = []
        byEmp[ev.employee_id].push(ev)
      })
      const commentsByEmp = {}
      ;(comments || []).forEach((c) => {
        if (!commentsByEmp[c.employee_id]) commentsByEmp[c.employee_id] = []
        commentsByEmp[c.employee_id].push(c)
      })
      const notesByEmp = {}
      ;(notes || []).forEach((n) => {
        if (!notesByEmp[n.employee_id]) notesByEmp[n.employee_id] = []
        notesByEmp[n.employee_id].push(n)
      })
      const list = (emps || []).map((e) => {
        const history = sortByPeriod(byEmp[e.id] || [])
        const empComments = commentsByEmp[e.id] || [] // 이미 comment_date 내림차순으로 불러왔으니 [0]이 최신
        const empNotes = notesByEmp[e.id] || [] // 이미 entry_date 내림차순으로 불러왔으니 [0]이 최신
        return { ...deriveEmployee(e, history, rankCriteria, leaveRate), history, comments: empComments, noteEntries: empNotes }
      })
      setEmployees(list)
    }
    load().catch((err) => { if (!cancelled) setError(err) })
    return () => { cancelled = true }
  }, [refreshKey])

  // "연차 일괄 +1" 되돌리기 버튼을 보여줄지 — 안 되돌린 가장 최근 배치가 있을 때만
  useEffect(() => { fetchLatestBumpBatch().then(setLatestBatch).catch(() => setLatestBatch(null)) }, [refreshKey])

  const undoBump = async () => {
    if (!latestBatch) return
    if (!window.confirm(`${latestBatch.new_reference_year}년도 기준으로 적용했던 연차 일괄 +1을 되돌릴까요? 전 직원 연차가 -1 되고, ${latestBatch.previous_reference_year}년도 기준으로 되돌아갑니다.`)) return
    setUndoing(true)
    try {
      await undoLevelBump(latestBatch, user?.email || null)
      setRefreshKey((k) => k + 1)
    } catch (err) {
      setError(err)
    }
    setUndoing(false)
  }

  // 직급/부서/팀 드롭다운 옵션은 현재 선택된 직군 탭 안에서만 뽑아서, 엉뚱한 조합을 고를 수 없게 함
  const scopedByTrack = useMemo(() => {
    if (!employees) return []
    if (trackF === 'all') return employees
    const cat = CATEGORIES.find((c) => c.key === trackF)
    return cat ? employees.filter(cat.test) : employees
  }, [employees, trackF])

  const rankOptions = useMemo(() => [...new Set(scopedByTrack.map((e) => e.rank))].sort((a, b) => a.localeCompare(b, 'ko')), [scopedByTrack])
  const divOptions = useMemo(() => [...new Set(scopedByTrack.map((e) => e.division).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko')), [scopedByTrack])
  const deptOptions = useMemo(() => [...new Set(scopedByTrack.map((e) => e.dept).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko')), [scopedByTrack])
  const teamOptions = useMemo(() => [...new Set(scopedByTrack.map((e) => e.team).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko')), [scopedByTrack])

  const filtered = useMemo(() => {
    if (!employees) return []
    let l = scopedByTrack.filter((e) => {
      if (search && !e.name.includes(search) && !(e.dept || '').includes(search) && !(e.team || '').includes(search) && !(e.division || '').includes(search)) return false
      if (rankF !== 'all' && e.rank !== rankF) return false
      if (locF !== 'all' && !(e.locations || []).includes(locF)) return false
      if (divF !== 'all' && e.division !== divF) return false
      if (deptF !== 'all' && e.dept !== deptF) return false
      if (teamF !== 'all' && e.team !== teamF) return false
      if (statusF.length > 0) {
        // 정확히 이 조합만 — 선택한 사유들 외에 다른 사유가 하나라도 더 걸려있으면 제외(개수·구성이 완전히 같아야 함)
        const a = [...statusF].sort()
        const b = [...e.issues].sort()
        if (a.length !== b.length || a.some((v, i) => v !== b[i])) return false
      }
      return true
    })
    l.sort((a, b) => {
      const av = sortKey === 'status' ? (STATUS_SORT_ORDER[a.status] ?? 99) : a[sortKey]
      const bv = sortKey === 'status' ? (STATUS_SORT_ORDER[b.status] ?? 99) : b[sortKey]
      return sortAsc ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)
    })
    return l
  }, [employees, scopedByTrack, search, rankF, locF, divF, deptF, teamF, statusF, sortKey, sortAsc])

  // 직군 탭을 바꾸면 그 탭에 없는 값으로 걸려있던 직급/부문/본부/팀 필터는 초기화
  useEffect(() => {
    setRankF('all'); setDivF('all'); setDeptF('all'); setTeamF('all')
  }, [trackF])

  const hs = (k) => {
    if (sortKey === k) setSortAsc(!sortAsc)
    else { setSortKey(k); setSortAsc(k === 'status') } // 상태는 승진가능이 먼저 오도록 오름차순 기본값
  }
  const ar = (k) => (sortKey === k ? (sortAsc ? ' ↑' : ' ↓') : '')

  // 지금 화면에 보이는(필터링된) 행 기준으로 전체선택/해제 — 다른 탭·필터에 있는 행의 체크는 안 건드림
  const allFilteredSelected = filtered.length > 0 && filtered.every((e) => selectedIds.has(e.id))
  const toggleSelectAllFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allFilteredSelected) filtered.forEach((e) => next.delete(e.id))
      else filtered.forEach((e) => next.add(e.id))
      return next
    })
  }
  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  const selectedList = filtered.filter((e) => selectedIds.has(e.id))
  const downloadSelected = () => {
    const stamp = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', 'h') + 'm'
    const rows = selectedList.map((e) => ({
      ...e,
      orgPathStr: orgPath(e),
      trackLabel: TRACK_LABEL[e.track] || e.track,
      gapStr: e.gap > 0 ? `-${e.gap}P` : '충족',
      statusLabel: (e.issues || []).map((i) => (STATUS_LABEL[i] || STATUS_LABEL.short).label).join(' / '),
      latestNoteStr: e.noteEntries?.[0] ? `${e.noteEntries[0].entry_date}: ${e.noteEntries[0].text}` : '',
      latestCommentStr: e.comments?.[0] ? `${e.comments[0].comment_date}: ${e.comments[0].text}` : '',
    }))
    downloadCSV(`승진후보_선택다운로드_${stamp}.csv`, rows, SELECTION_CSV_COLUMNS)
  }

  if (error) return <ErrorBox error={error} />
  if (!employees) return <Loading />

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 8 }}>
        {selectedIds.size > 0 && (
          <button style={btnGhost} onClick={() => setSelectedIds(new Set())}>선택 해제 ({selectedIds.size})</button>
        )}
        <button
          style={{ ...btnPrimary, opacity: selectedList.length === 0 ? 0.4 : 1, cursor: selectedList.length === 0 ? 'default' : 'pointer' }}
          disabled={selectedList.length === 0}
          onClick={downloadSelected}
        >
          ⬇ 선택 항목 다운로드 ({selectedList.length}명)
        </button>
        <button style={btnGhost} onClick={() => setShowExportImport(true)}>📑 전체 데이터 다운로드 / 업로드</button>
        <button style={btnGhost} onClick={() => setShowBumpLevel(true)}>📅 연차 일괄 +1</button>
        {latestBatch && (
          <button style={{ ...btnGhost, color: R }} onClick={undoBump} disabled={undoing}>
            {undoing ? '되돌리는 중…' : `↩ 연차 일괄+1 되돌리기 (${latestBatch.new_reference_year}년도)`}
          </button>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        <button
          onClick={() => setTrackF('all')}
          style={{
            padding: '6px 12px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            color: trackF === 'all' ? '#fff' : '#475569', background: trackF === 'all' ? '#475569' : '#f1f5f9',
          }}
        >
          전체
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c.key} onClick={() => setTrackF(c.key)}
            style={{
              padding: '6px 12px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              color: trackF === c.key ? '#fff' : CATEGORY_COLOR[c.key],
              background: trackF === c.key ? CATEGORY_COLOR[c.key] : '#f1f5f9',
            }}
          >
            {CATEGORY_LABEL[c.key]}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input style={{ ...inp, minWidth: 200 }} placeholder={`🔍  이름 · ${ORG_LEVEL_LABEL.division} · ${ORG_LEVEL_LABEL.dept} · ${ORG_LEVEL_LABEL.team}`} value={search} onChange={(e) => setSearch(e.target.value)} />
        <select style={{ ...inp, cursor: 'pointer' }} value={rankF} onChange={(e) => setRankF(e.target.value)}>
          <option value="all">전체 직급</option>
          {rankOptions.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select style={{ ...inp, cursor: 'pointer' }} value={locF} onChange={(e) => setLocF(e.target.value)}>
          <option value="all">전체 지역</option>
          {LOCATIONS.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <select style={{ ...inp, cursor: 'pointer' }} value={divF} onChange={(e) => setDivF(e.target.value)}>
          <option value="all">전체 {ORG_LEVEL_LABEL.division}</option>
          {divOptions.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select style={{ ...inp, cursor: 'pointer' }} value={deptF} onChange={(e) => setDeptF(e.target.value)}>
          <option value="all">전체 {ORG_LEVEL_LABEL.dept}</option>
          {deptOptions.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select style={{ ...inp, cursor: 'pointer' }} value={teamF} onChange={(e) => setTeamF(e.target.value)}>
          <option value="all">전체 {ORG_LEVEL_LABEL.team}</option>
          {teamOptions.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <StatusFilterDropdown value={statusF} onChange={setStatusF} />
        <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 8 }}>{filtered.length}명</span>
      </div>
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid var(--border)', overflow: 'auto', maxHeight: 'calc(100vh - 210px)', boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
        {filtered.length === 0 ? (
          <EmptyState label="조건에 맞는 직원이 없습니다" />
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...thS, width: 34 }}>
                  <input type="checkbox" checked={allFilteredSelected} onChange={toggleSelectAllFiltered} title="현재 목록 전체 선택/해제" />
                </th>
                <th style={{ ...thS, cursor: 'pointer' }} onClick={() => hs('name')}>이름{ar('name')}</th>
                <th style={thS}>위치</th>
                <th style={{ ...thS, cursor: 'pointer' }} onClick={() => hs('dept')}>
                  소속{ar('dept')}
                  <HeaderExpandToggle expanded={orgExpanded} onToggle={() => setOrgExpanded((v) => !v)} />
                </th>
                <th style={{ ...thS, cursor: 'pointer' }} onClick={() => hs('rank')}>직급{ar('rank')}</th>
                <th style={{ ...thS, cursor: 'pointer' }} onClick={() => hs('track')}>직군{ar('track')}</th>
                <th style={thS}>
                  평가 이력
                  <HeaderExpandToggle expanded={historyExpanded} onToggle={() => setHistoryExpanded((v) => !v)} />
                </th>
                <th style={{ ...thS, cursor: 'pointer' }} onClick={() => hs('currentPts')}>포인트{ar('currentPts')}</th>
                <th style={{ ...thS, cursor: 'pointer' }} onClick={() => hs('gap')}>잔여{ar('gap')}</th>
                <th style={{ ...thS, cursor: 'pointer' }} onClick={() => hs('level')}>연차{ar('level')}</th>
                <th style={{ ...thS, cursor: 'pointer' }} onClick={() => hs('backfillPts')}>경력인정P{ar('backfillPts')}</th>
                <th style={{ ...thS, cursor: 'pointer' }} onClick={() => hs('status')}>상태{ar('status')}</th>
                <th style={thS}>정성평가</th>
                <th style={thS}>비고</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr
                  key={e.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/employees/${e.id}`)}
                  onMouseEnter={(ev) => (ev.currentTarget.style.background = '#f8fafc')}
                  onMouseLeave={(ev) => (ev.currentTarget.style.background = 'transparent')}
                >
                  <td style={tdS} onClick={(ev) => ev.stopPropagation()}>
                    <input type="checkbox" checked={selectedIds.has(e.id)} onChange={() => toggleSelect(e.id)} />
                  </td>
                  <td style={{ ...tdS, fontWeight: 600 }}>{e.name}</td>
                  <td style={tdS}><LocationBadges locations={e.locations} /></td>
                  <td style={{ ...tdS, color: '#64748b' }}>
                    {orgExpanded ? orgPath(e) : (e.team || e.dept || e.division || '—')}
                  </td>
                  <td style={tdS}>{e.rank}</td>
                  <td style={tdS}><Bd color={(TRACK_BADGE[e.track] || TRACK_BADGE.사무).c} bg={(TRACK_BADGE[e.track] || TRACK_BADGE.사무).bg}>{TRACK_LABEL[e.track] || e.track}</Bd></td>
                  <td style={{ ...tdS, whiteSpace: historyExpanded ? 'normal' : 'nowrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'nowrap' }}>
                      {(historyExpanded ? e.evalWindow : e.evalWindow.slice(-6)).map((h) => <GB key={h.period} grade={h.grade} dim={!h.counted} />)}
                      {historyExpanded && <BackfillBadges employee={e} />}
                    </div>
                  </td>
                  <td style={tdS}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Prog current={e.currentPts} max={e.threshold} />
                      {e.leavePts > 0 && (
                        <span onClick={(ev) => ev.stopPropagation()}>
                          <Tip content={`휴직 포인트 ${e.leavePts}P 포함 — 정책 아직 미확정`}>
                            <span style={{ fontSize: 12 }}>🌿</span>
                          </Tip>
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={tdS}><span style={{ color: e.gap > 0 ? R : G, fontWeight: 600 }}>{e.gap > 0 ? `-${e.gap}P` : '충족'}</span></td>
                  <td style={tdS} onClick={(ev) => ev.stopPropagation()}>
                    {e.leaveYears > 0 ? (
                      <Tip content={`근무 ${e.level || 0}년 + 휴직 ${e.leaveYears}년 = ${e.effectiveLevel}년`}>
                        <TenureBar level={e.effectiveLevel} reqTenure={e.req_tenure} />
                      </Tip>
                    ) : (
                      <TenureBar level={e.effectiveLevel} reqTenure={e.req_tenure} />
                    )}
                  </td>
                  <td style={{ ...tdS, color: e.backfillPts > 0 ? P : '#d1d5db' }} onClick={(ev) => ev.stopPropagation()}>
                    <Tip content={backfillDetail(e).tooltip}>{e.backfillPts || 0}P</Tip>
                  </td>
                  <td style={tdS}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {e.issues.map((i) => {
                        const cfg = STATUS_LABEL[i] || STATUS_LABEL.short
                        return <Bd key={i} color={cfg.color} bg={cfg.bg}>{cfg.label}</Bd>
                      })}
                    </div>
                  </td>
                  <td style={tdS} onClick={(ev) => ev.stopPropagation()}>
                    {e.comments?.length > 0 ? (
                      <Tip content={`최근: ${e.comments[0].comment_date} — ${e.comments[0].text}${e.comments.length > 1 ? `\n(총 ${e.comments.length}건, 상세화면에서 전체 확인)` : ''}`}>
                        <span style={{ background: '#f0fdfa', border: '1px solid #99f6e4', color: '#0d9488', borderRadius: 6, padding: '3px 9px', fontSize: 11, fontWeight: 600 }}>
                          💬 {e.comments.length}건
                        </span>
                      </Tip>
                    ) : (
                      <span style={{ color: '#d1d5db', fontSize: 11 }}>—</span>
                    )}
                  </td>
                  <td style={tdS} onClick={(ev) => ev.stopPropagation()}>
                    <Tip content={e.noteEntries?.[0] ? `최근(${e.noteEntries[0].entry_date}): ${e.noteEntries[0].text}${e.noteEntries.length > 1 ? `\n(총 ${e.noteEntries.length}건, 상세화면에서 전체 확인)` : ''}` : '기재된 특이사항 없음'}>
                      <span><NoteFlagBadge flag={e.note_flag} /></span>
                    </Tip>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {showExportImport && (
        <ExportImportModal
          employees={employees}
          onClose={() => setShowExportImport(false)}
          onApplied={() => { setShowExportImport(false); setRefreshKey((k) => k + 1) }}
        />
      )}
      {showBumpLevel && (
        <BumpLevelModal
          employees={employees}
          changedBy={user?.email || null}
          onClose={() => setShowBumpLevel(false)}
          onApplied={() => { setShowBumpLevel(false); setRefreshKey((k) => k + 1) }}
        />
      )}
    </div>
  )
}

// ═══ 연차 일괄 +1 (매년 1/1 기준, 특수 조정된 개별 연차는 그대로 두고 전 직원 일괄 +1) ═══
// 연차가 마이너스→플러스로 넘어가는 사람은 그 직전 평가+경력인정 포인트를 자동으로 얼려서(보류 포인트)
// 담당자가 상세화면에서 수동으로 반영여부·반영포인트를 정하기 전까진 총점에 안 들어가게 함.
// 지금 데이터가 몇 년도 기준인지(level_reference_year)를 추적해서, 이미 그 해로 넘어간 뒤인지
// 아직 그 해가 안 됐는데 미리 누르는 건지 구분해 경고 문구를 다르게 보여줌.
function BumpLevelModal({ employees, changedBy, onClose, onApplied }) {
  const [applying, setApplying] = useState(false)
  const [done, setDone] = useState(null)
  const [error, setError] = useState('')
  const [criteria, setCriteria] = useState(null) // { rankCriteria, leaveRate, referenceYear }

  useEffect(() => {
    Promise.all([fetchRankCriteria(), fetchLeaveRate(), fetchLevelReferenceYear()])
      .then(([rankCriteria, leaveRate, referenceYear]) => setCriteria({ rankCriteria, leaveRate, referenceYear }))
  }, [])

  const nowYear = new Date().getFullYear()
  const newYear = criteria ? criteria.referenceYear + 1 : null
  // 지금 연도가 이미 새 기준년도를 넘어섰으면(=정상적으로 새해가 지나서 누르는 경우) 순한 확인 문구,
  // 아직 안 지났으면(=기준년도를 착각했거나 너무 일찍 누른 경우) 한 번 더 재확인시키는 문구
  const isNormalTiming = criteria && nowYear >= newYear

  // 연차<=1일 땐 evalPts·backfillPts가 이미 항상 0이라(마이너스 연차 조정과 동일한 안전장치), 얼려야 할
  // "보류 포인트"는 예전(마이너스) 연차가 아니라 +1된 새 연차 기준으로 다시 계산해야 실제 위험 금액이 나옴 —
  // 그 새 연차에서 지금까지의 실제 평가이력이 갑자기 다 인정되면서 튀어오르는 금액이 바로 그거라서.
  const preview = !criteria ? [] : employees.map((e) => {
    const oldLevel = e.level || 0
    const newLevel = oldLevel + 1
    const transitioning = oldLevel < 0 && newLevel >= 0
    let heldPoints = 0
    if (transitioning) {
      const projected = deriveEmployee({ ...e, level: newLevel }, e.history, criteria.rankCriteria, criteria.leaveRate)
      heldPoints = Math.round(((projected.evalPts || 0) + (projected.backfillPts || 0)) * 10) / 10
    }
    return { id: e.id, name: e.name, oldLevel, newLevel, transitioning, heldPoints }
  })
  const transitioningList = preview.filter((p) => p.transitioning)

  const apply = async () => {
    setApplying(true)
    setError('')
    try {
      const items = preview.map((p) => ({ employeeId: p.id, oldLevel: p.oldLevel, newLevel: p.newLevel, freeze: p.transitioning ? p.heldPoints : null }))
      await applyLevelBump(items, criteria.referenceYear, newYear, changedBy)
      setDone({ total: preview.length, transitioned: transitioningList.length, newYear })
    } catch (err) {
      setError(err.message)
    }
    setApplying(false)
  }

  return (
    <Modal title="연차 일괄 +1" onClose={onClose} width={560}>
      {done ? (
        <div>
          <div style={{ fontSize: 13, color: '#166534', marginBottom: 16 }}>
            {done.total}명의 연차가 +1 됐어요 ({done.newYear}년도 기준 적용). {done.transitioned > 0 && `그 중 ${done.transitioned}명은 마이너스→플러스로 넘어가며 보류 포인트 처리됐어요 — 각자 상세화면 "⏸ 보류 포인트 처리"에서 확인해주세요.`}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button style={btnPrimary} onClick={onApplied}>확인</button>
          </div>
        </div>
      ) : !criteria ? (
        <Loading />
      ) : (
        <div>
          {isNormalTiming ? (
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 16, lineHeight: 1.6 }}>
              지금 데이터는 <b>{criteria.referenceYear}년도</b> 기준이에요. 연차 일괄 +1을 하면 <b>{newYear}년도</b> 기준이 적용됩니다. 그래도 +1 하시겠습니까?
            </div>
          ) : (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 12, color: '#991b1b', lineHeight: 1.6 }}>
              ⚠️ 지금 데이터는 <b>{criteria.referenceYear}년도</b> 기준인데, 아직 {nowYear}년이라 {newYear}년도로 넘어가기엔 이른 것 같아요.
              연차 일괄 +1을 하면 <b>{newYear}년도</b> 기준이 적용됩니다. 기준년도를 재확인해주세요. 그래도 +1 하시겠습니까?
            </div>
          )}
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 16, lineHeight: 1.6 }}>
            전 직원 {preview.length}명의 연차가 전부 +1 됩니다 (개별 특수조정 연차 포함, 전부 그대로 +1). 실행 후 "↩ 마지막 연차+1 되돌리기"로 되돌릴 수 있어요.
          </div>
          {transitioningList.length > 0 && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: 12, marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#854d0e', marginBottom: 8 }}>
                마이너스→플러스로 넘어가며 보류 포인트 처리되는 사람 ({transitioningList.length}명)
              </div>
              <div style={{ maxHeight: 180, overflow: 'auto' }}>
                {transitioningList.map((p) => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#854d0e', padding: '3px 0' }}>
                    <span>{p.name} ({p.oldLevel} → {p.newLevel})</span>
                    <span>보류 {p.heldPoints}P</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {error && <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 10 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" style={btnGhost} onClick={onClose} disabled={applying}>취소</button>
            <button type="button" style={btnPrimary} onClick={apply} disabled={applying}>
              {applying ? '처리 중…' : `그래도 ${preview.length}명 전체 +1 적용`}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

// ═══ 전체 데이터 CSV 다운로드 / 업로드 (엑셀에서 편집 후 재반영) ═══
function ExportImportModal({ employees, onClose, onApplied }) {
  const [rows, setRows] = useState(null) // 업로드 후 분류된 변경사항
  const [error, setError] = useState('')
  const [applying, setApplying] = useState(false)
  const [result, setResult] = useState(null)
  const [backedUp, setBackedUp] = useState(false)

  const download = (isBackup) => {
    const stamp = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', 'h') + 'm'
    // 임원은 실제로는 track(사무/사무외국어필수/연구) 값과 무관하게 직급으로만 판단되지만,
    // CSV에서는 헷갈리지 않게 직급이 임원급이면 직군란도 "임원"으로 보여줌(업로드 시엔 다시 사무로 정규화됨)
    const rows = employees.map((e) => ({
      ...(EXEC_RANKS.includes(baseRank(e.rank)) ? { ...e, track: '임원' } : e),
      leaveMonths: Math.round((e.leave_years || 0) * 12), // 저장은 연 단위 소수, CSV엔 개월수로 보여줌
    }))
    downloadCSV(`employees_${isBackup ? 'backup_' : ''}${stamp}.csv`, rows, CSV_COLUMNS)
    // 자동 백업(모달 열자마자 한 번)은 알림 안 보냄 — 실제로 "다시 다운로드"를 눌렀을 때만
    if (!isBackup) notifyDownload(rows.length)
  }

  // 모달을 열면 지금 상태를 자동으로 한 번 백업 다운로드 — 업로드해서 문제가 생겨도
  // 이 파일을 그대로 다시 업로드하면 지금 상태로 되돌릴 수 있음
  useEffect(() => {
    download(true)
    setBackedUp(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setResult(null)
    try {
      const text = await file.text()
      const parsed = parseCSV(text)
      const byId = new Map(employees.map((emp) => [emp.id, emp]))
      const out = []
      parsed.forEach((raw, i) => {
        const id = (raw.id || '').trim()
        if (!id) {
          // id가 비어있으면 신규 추가로 취급
          const name = (raw['이름'] || '').trim()
          if (!name) return
          out.push({ key: `new-${i}`, kind: 'insert', name, patch: buildPatch(raw), errors: validatePatch(buildPatch(raw)) })
          return
        }
        const emp = byId.get(id)
        if (!emp) {
          out.push({ key: `missing-${i}`, kind: 'error', name: raw['이름'] || id, errors: [`id를 현재 데이터에서 찾을 수 없어요: ${id}`] })
          return
        }
        const patch = buildPatch(raw)
        const changed = {}
        CSV_EDITABLE_KEYS.forEach((k) => {
          const newVal = patch[k]
          const oldVal = emp[k]
          let oldNorm, newNorm
          if (CSV_BOOL_KEYS.has(k)) { oldNorm = !!oldVal; newNorm = !!newVal }
          else if (CSV_NUM_KEYS.has(k)) { oldNorm = Number(oldVal || 0); newNorm = Number(newVal || 0) }
          else { oldNorm = oldVal ?? ''; newNorm = newVal ?? '' }
          if (String(newNorm) !== String(oldNorm)) changed[k] = { from: oldNorm, to: newNorm }
        })
        if (Object.keys(changed).length > 0) {
          out.push({ key: id, kind: 'update', id, name: emp.name, changed, patch, errors: validatePatch(patch) })
        }
      })
      setRows(out)
    } catch (err) {
      setError('파일을 읽는 중 문제가 발생했어요: ' + err.message)
    }
  }

  const apply = async () => {
    setApplying(true)
    let ok = 0
    const fail = []
    for (const r of rows) {
      if (r.errors?.length) { fail.push({ name: r.name, message: r.errors.join(', ') }); continue }
      try {
        if (r.kind === 'update') {
          const { error: err } = await supabase.from('employees').update(r.patch).eq('id', r.id)
          if (err) throw new Error(err.message)
        } else if (r.kind === 'insert') {
          const { error: err } = await supabase.from('employees').insert({
            ...r.patch, role: '팀원', req_tenure: 0, threshold: 0, base_pts: 0,
          })
          if (err) throw new Error(err.message)
        }
        ok += 1
      } catch (err) {
        fail.push({ name: r.name, message: err.message })
      }
    }
    setApplying(false)
    setResult({ ok, fail })
    if (fail.length === 0) onApplied()
  }

  const actionable = (rows || []).filter((r) => r.kind !== 'error')
  const blocked = (rows || []).filter((r) => r.errors?.length > 0)

  return (
    <Modal title="전체 데이터 다운로드 / 업로드" onClose={onClose} width={760}>
      {!rows && (
        <div>
          {backedUp && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#166534', marginBottom: 14 }}>
              ✅ 지금 상태로 백업 CSV가 자동으로 다운로드됐어요. 업로드해서 문제가 생기면 이 파일을 그대로 다시 업로드하면 원래대로 되돌릴 수 있어요.
            </div>
          )}
          <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.7, marginBottom: 16 }}>
            1. 전체 명단을 CSV로 받아서 엑셀에서 열어 수정하세요 (맨 앞 <b>id</b> 칸은 지우거나 바꾸지 마세요 — 어떤 사람인지 매칭하는 용도예요).<br />
            2. 수정 끝나면 <b>CSV로 저장</b>한 다음, 그 파일을 아래에서 업로드하세요.<br />
            3. id가 있는 행은 <b>수정</b>으로, id를 비워두고 이름만 채운 행은 <b>신규 추가</b>로 처리돼요. 행을 통째로 지우는 건 삭제로 인식하지 않아요(안전을 위해 — 퇴사 처리는 "입·퇴사 관리"에서 해주세요).
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button type="button" style={btnPrimary} onClick={() => download(false)}>⬇ CSV 다시 다운로드 ({employees.length}명)</button>
          </div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 6 }}>수정한 CSV 업로드</label>
          <input type="file" accept=".csv" onChange={onFile} />
          {error && <div style={{ color: '#dc2626', fontSize: 12, marginTop: 10 }}>{error}</div>}
        </div>
      )}

      {rows && !result && (
        <div>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>
            변경사항 {actionable.length}건 감지 (수정 {actionable.filter((r) => r.kind === 'update').length}건, 신규 {actionable.filter((r) => r.kind === 'insert').length}건)
            {blocked.length > 0 && <span style={{ color: '#dc2626' }}> · 오류 {blocked.length}건은 반영에서 제외돼요</span>}
          </div>
          {actionable.length === 0 ? (
            <EmptyState label="변경된 내용이 없어요" />
          ) : (
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, maxHeight: 340, overflow: 'auto' }}>
              {rows.map((r) => (
                <div key={r.key} style={{ padding: '8px 12px', fontSize: 12, borderBottom: '1px solid #f1f5f9' }}>
                  <b>{r.name}</b>{' '}
                  {r.errors?.length > 0 ? (
                    <span style={{ color: '#dc2626' }}>{r.errors.join(', ')}</span>
                  ) : r.kind === 'insert' ? (
                    <span style={{ color: '#166534' }}>신규 추가</span>
                  ) : (
                    <span style={{ color: '#64748b' }}>
                      {Object.entries(r.changed).map(([k, v]) => `${k}: ${v.from} → ${v.to}`).join(' · ')}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
            <button type="button" style={btnGhost} onClick={onClose}>취소</button>
            <button
              type="button" style={btnPrimary} disabled={applying || actionable.length === 0}
              onClick={apply}
            >
              {applying ? '반영 중…' : `반영하기 (${actionable.length})`}
            </button>
          </div>
        </div>
      )}

      {result && (
        <div>
          <div style={{ fontSize: 13, marginBottom: 10 }}>
            ✅ {result.ok}건 반영 완료{result.fail.length > 0 && ` · ⚠️ ${result.fail.length}건 실패`}
          </div>
          {result.fail.length > 0 && (
            <div style={{ background: '#fef2f2', borderRadius: 8, padding: 12, fontSize: 12, color: '#b91c1c', marginBottom: 10 }}>
              {result.fail.map((f, i) => <div key={i}>{f.name}: {f.message}</div>)}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" style={btnPrimary} onClick={onApplied}>확인</button>
          </div>
        </div>
      )}
    </Modal>
  )
}

// 컬럼 헤더 문구가 바뀌어도(직군 라벨이 여러 번 수정됨) 예전에 받아둔 CSV를 그대로 올릴 수 있게
// 괄호 앞부분(고정된 라벨 이름)만 맞으면 찾아줌 — 괄호 안 안내문구가 달라져도 안전
function pickByPrefix(raw, prefix) {
  const key = Object.keys(raw).find((k) => k.startsWith(prefix))
  return key ? raw[key] : ''
}

// 날짜 입력을 여러 형식으로 받아줌 — "20251013"(구분자 없이), "2025-10-13", "2025/10/13", "2025.10.13"
function normalizeDate(raw) {
  const s = (raw || '').trim()
  if (!s) return null
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
  const m = s.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  return s
}

// 휴직시작일·종료일이 둘 다 있으면 그 사이 개월수를 계산(종료일의 '일'이 시작일보다 앞이면 1개월 덜 채운 것으로 봄)
function monthsBetween(startStr, endStr) {
  const s = startStr && startStr.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const e = endStr && endStr.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!s || !e) return null
  const sy = Number(s[1]), sm = Number(s[2]), sd = Number(s[3])
  const ey = Number(e[1]), em = Number(e[2]), ed = Number(e[3])
  let months = (ey - sy) * 12 + (em - sm)
  if (ed < sd) months -= 1
  return Math.max(0, months)
}

function buildPatch(raw) {
  const patch = {
    name: (raw['이름'] || '').trim(),
    join_date: normalizeDate(pickByPrefix(raw, '입사일(')),
    // "대전"만 써도 "대전(원텍연구원)"으로 인식(라벨에 원텍연구원이 붙기 전에 이미 채워둔 값 보정용)
    locations: pickByPrefix(raw, '위치(').split(',').map((s) => s.trim()).filter(Boolean).map((s) => (s === '대전' ? '대전(원텍연구원)' : s)),
    // 예전(2026-09 개편 전) 라벨 "실/팀/파트"로 받아둔 백업 CSV를 올려도 되게 그 헤더도 그대로 인정.
    // 새 라벨 컬럼 자체가 이 행에 아예 없을 때만(값이 빈칸인 게 아니라 헤더 자체가 없을 때만) 예전 헤더를 대신 씀 —
    // 안 그러면 새 CSV에서 "본부"가 빈칸인 사람이 같은 글자인 새 "팀" 헤더값을 잘못 주워올 수 있음(예전 팀=지금 본부, 예전 파트=지금 팀).
    division: ((ORG_LEVEL_LABEL.division in raw ? raw[ORG_LEVEL_LABEL.division] : raw['실']) || '').trim() || null,
    dept: ((ORG_LEVEL_LABEL.dept in raw ? raw[ORG_LEVEL_LABEL.dept] : raw['팀']) || '').trim() || null,
    team: ((ORG_LEVEL_LABEL.team in raw ? raw[ORG_LEVEL_LABEL.team] : raw['파트']) || '').trim() || null,
    rank: (raw['직급'] || '').trim(),
    role: pickByPrefix(raw, '직책(').trim() || null,
    // "임원"은 실제 DB엔 없는 값(임원 여부는 직급으로 자동 판단) — CSV에서만 편의상 받아주고 사무로 정규화.
    // "사무영어필수"는 예전 값(사무외국어필수로 개명됨) — 예전에 받아둔 CSV를 올려도 되게 자동 변환.
    track: (() => {
      const t = pickByPrefix(raw, '직군(').trim()
      if (t === '임원') return '사무'
      if (t === '사무영어필수') return '사무외국어필수'
      return t
    })(),
    level: Number(raw['연차']) || 0,
    // CSV엔 개월수로 입력받고(더 자연스러움), 저장은 지금처럼 연 단위 소수로(1년 3개월 등 소수 연차 그대로 지원)
    // 휴직시작일·종료일이 둘 다 있으면 그걸로 개월수 자동 계산(우선), 없으면 휴직개월수 칸을 그대로 씀
    leave_years: (() => {
      const start = normalizeDate(pickByPrefix(raw, '휴직시작일('))
      const end = normalizeDate(pickByPrefix(raw, '휴직종료일('))
      const fromDates = monthsBetween(start, end)
      const months = fromDates !== null ? fromDates : (Number(pickByPrefix(raw, '휴직개월수(')) || 0)
      return months / 12
    })(),
    leave_start_date: normalizeDate(pickByPrefix(raw, '휴직시작일(')),
    leave_end_date: normalizeDate(pickByPrefix(raw, '휴직종료일(')),
    backfill_full_tenure: /^(true|1|y|yes)$/i.test(pickByPrefix(raw, '경력직인정포인트').trim() || pickByPrefix(raw, '경력직백필').trim()),
    eng_pts: Number(raw['영어점수']) || 0,
    eng_lifetime: /^(true|1|y|yes)$/i.test((raw['영어평생인정(TRUE/FALSE)'] || '').trim()),
    cn_pts: Number(raw['중국어점수']) || 0,
    cn_lifetime: /^(true|1|y|yes)$/i.test((raw['중국어평생인정(TRUE/FALSE)'] || '').trim()),
    jp_pts: Number(raw['일본어점수']) || 0,
    jp_lifetime: /^(true|1|y|yes)$/i.test((raw['일본어평생인정(TRUE/FALSE)'] || '').trim()),
    award_pts: Number(raw['포상가점']) || 0,
    note_flag: (() => {
      const v = pickByPrefix(raw, '비고평가(').trim()
      return ['+', '-', 'o'].includes(v) ? v : 'o'
    })(),
  }
  return patch
}

function validatePatch(patch) {
  const errs = []
  if (!patch.name) errs.push('이름이 비어있어요')
  if (!patch.division && !patch.dept && !patch.team) errs.push(`${ORG_LEVEL_LABEL.division}/${ORG_LEVEL_LABEL.dept}/${ORG_LEVEL_LABEL.team} 중 최소 하나는 있어야 해요`)
  if (!patch.rank) errs.push('직급이 비어있어요')
  if (!TRACKS.some((t) => t.value === patch.track)) errs.push(`직군 값이 이상해요: "${patch.track}" (사무/사무외국어필수/연구 중 하나여야 해요)`)
  if (!['+', '-', 'o'].includes(patch.note_flag)) errs.push(`비고평가 값이 이상해요: "${patch.note_flag}" (+/-/o 중 하나여야 해요)`)
  return errs
}
