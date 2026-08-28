import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { sortByPeriod, TRACKS, TRACK_LABEL, STATUS_LABEL, LOCATIONS, EXEC_RANKS, orgPath, GRADE_COLOR, nearestGrade, P, B, G, R, O } from '../lib/constants'
import { deriveEmployee, evalCount, fetchRankCriteria, CATEGORIES } from '../lib/promotion'
import { Bd, GB, LocationBadges, Prog, TenureBar, Tip, thS, tdS, inp, Loading, ErrorBox, EmptyState, Modal, btnPrimary, btnGhost } from '../components/ui'
import { downloadCSV, parseCSV } from '../lib/csv'

const TRACK_BADGE = { 사무: { c: '#475569', bg: '#f1f5f9' }, 사무외국어필수: { c: B, bg: '#e0f2fe' }, 연구: { c: P, bg: '#f3e8ff' } }
const CATEGORY_COLOR = { 사무: '#475569', 사무외국어필수: B, 연구: P, 임원: '#92400e' }
const CATEGORY_LABEL = { ...TRACK_LABEL, 임원: '임원' }

// CSV 내보내기/가져오기에 쓰는 편집 가능 컬럼 (id는 매칭용, 절대 수정·삭제 금지)
const CSV_COLUMNS = [
  { key: 'id', label: 'id' },
  { key: 'name', label: '이름' },
  { key: 'locations', label: '위치(대전/판교/해외법인, 복수는 쉼표로 구분)' },
  { key: 'division', label: '실' },
  { key: 'dept', label: '팀' },
  { key: 'team', label: '파트' },
  { key: 'rank', label: '직급' },
  { key: 'track', label: '직군(사무/사무외국어필수/연구/임원)' },
  { key: 'level', label: '연차' },
  { key: 'backfill_full_tenure', label: '경력직백필(TRUE/FALSE)' },
  { key: 'eng_pts', label: '영어점수' },
  { key: 'eng_lifetime', label: '영어평생인정(TRUE/FALSE)' },
  { key: 'eng2_pts', label: '제2외국어점수' },
  { key: 'eng2_lifetime', label: '제2외국어평생인정(TRUE/FALSE)' },
  { key: 'cert_pts', label: '자격가점' },
  { key: 'award_pts', label: '포상가점' },
  { key: 'note', label: '비고(겸직 등 자유메모)' },
  { key: 'currentPts', label: '(참고)현재포인트' },
]
const CSV_EDITABLE_KEYS = ['name', 'locations', 'division', 'dept', 'team', 'rank', 'track', 'level', 'backfill_full_tenure', 'eng_pts', 'eng_lifetime', 'eng2_pts', 'eng2_lifetime', 'cert_pts', 'award_pts', 'note']
const CSV_BOOL_KEYS = new Set(['backfill_full_tenure', 'eng_lifetime', 'eng2_lifetime'])
const CSV_NUM_KEYS = new Set(['level', 'eng_pts', 'eng2_pts', 'cert_pts', 'award_pts'])
// 상태 정렬용 우선순위 — 낮을수록(승진 가능) 먼저 옴
const STATUS_SORT_ORDER = { possible: 0, engShort: 1, ptShort: 2, tenureShort: 2, short: 3, na: 4 }
// 상태 필터에서 고를 수 있는 항목 — 실제로 issues 배열에 담기는 값만(상태 컬럼에 뱃지로 뜨는 것과 동일)
const STATUS_FILTER_KEYS = ['possible', 'tenureShort', 'ptShort', 'engShort', 'na']

// 경력인정P 산출 근거(툴팁 문구) + 평가이력에 점선 배지로 그릴 슬롯 수·등급색을 한 번에 계산
// - count: 점선 배지 몇 개로 나타낼지(경력직 백필=연차 수, 평가공백 백필=공백 건수)
// - grade: 슬롯 1개당 점수를 GRADE_HEIGHT에서 가장 가까운 등급으로 역매핑한 색상용 등급 문자
function backfillDetail(e) {
  if (!e.backfillPts) return { count: 0, grade: null, tooltip: '경력인정 P 대상 아님' }
  const rate = e.backfillRate || 0
  const lvl = e.level || 0
  if (e.backfill_full_tenure) {
    return { count: lvl, grade: nearestGrade(rate), tooltip: `${e.rank} ${rate}P/연차 × ${lvl}년 = ${e.backfillPts}P` }
  }
  // 경력직 백필이 아닌 경우엔 평가공백만큼만 경력인정됨: 예상 반기 슬롯 - 실제 평가횟수(반기환산) 만큼을 기준점수 절반씩으로 채움
  const evaluated = evalCount(e.history)
  const expected = Math.max(0, (lvl - 1) * 2)
  const gapHalves = Math.max(0, expected - evaluated)
  return {
    count: gapHalves, grade: nearestGrade(rate / 2),
    tooltip: `${e.rank} 경력인정P (평가공백분) · 예상평가 ${expected}건 − 실제 ${evaluated}건 = 공백 ${gapHalves}건 × ${rate}P÷2 = ${e.backfillPts}P`,
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

// 상태 다중선택 드롭다운 — 승진가능/연차부족/포인트부족/외국어미충족/해당없음 중 여러 개를 동시에 켤 수 있음(OR 조건)
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
  const [employees, setEmployees] = useState(null)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [trackF, setTrackF] = useState('all') // 'all' | CATEGORIES[].key
  const [rankF, setRankF] = useState('all')
  const [locF, setLocF] = useState('all')
  const [divF, setDivF] = useState('all')
  const [deptF, setDeptF] = useState('all')
  const [teamF, setTeamF] = useState('all')
  const [statusF, setStatusF] = useState([]) // 다중선택 — 빈 배열이면 전체(상태 필터 없음)
  const [sortKey, setSortKey] = useState('currentPts')
  const [sortAsc, setSortAsc] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [showExportImport, setShowExportImport] = useState(false)
  const [orgExpanded, setOrgExpanded] = useState(false) // 소속 컬럼 전체를 실·팀·파트로 펼칠지(헤더 토글, 전체 행 공통)
  const [historyExpanded, setHistoryExpanded] = useState(false) // 평가이력 컬럼 전체를 전체 이력+경력인정P로 펼칠지(헤더 토글, 전체 행 공통)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setError(null)
      const [{ data: emps, error: e1 }, { data: evals, error: e2 }, rankCriteria] = await Promise.all([
        supabase.from('employees').select('*'),
        supabase.from('evaluations').select('employee_id, period, grade, points').order('period'),
        fetchRankCriteria(),
      ])
      if (cancelled) return
      if (e1 || e2) { setError(e1 || e2); return }
      const byEmp = {}
      ;(evals || []).forEach((ev) => {
        if (!byEmp[ev.employee_id]) byEmp[ev.employee_id] = []
        byEmp[ev.employee_id].push(ev)
      })
      const list = (emps || []).map((e) => {
        const history = sortByPeriod(byEmp[e.id] || [])
        return { ...deriveEmployee(e, history, rankCriteria), history }
      })
      setEmployees(list)
    }
    load().catch((err) => { if (!cancelled) setError(err) })
    return () => { cancelled = true }
  }, [refreshKey])

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
      if (search && !e.name.includes(search) && !e.dept.includes(search) && !(e.team || '').includes(search) && !(e.division || '').includes(search)) return false
      if (rankF !== 'all' && e.rank !== rankF) return false
      if (locF !== 'all' && !(e.locations || []).includes(locF)) return false
      if (divF !== 'all' && e.division !== divF) return false
      if (deptF !== 'all' && e.dept !== deptF) return false
      if (teamF !== 'all' && e.team !== teamF) return false
      if (statusF.length > 0 && !e.issues.some((i) => statusF.includes(i))) return false
      return true
    })
    l.sort((a, b) => {
      const av = sortKey === 'status' ? (STATUS_SORT_ORDER[a.status] ?? 99) : a[sortKey]
      const bv = sortKey === 'status' ? (STATUS_SORT_ORDER[b.status] ?? 99) : b[sortKey]
      return sortAsc ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)
    })
    return l
  }, [employees, scopedByTrack, search, rankF, locF, divF, deptF, teamF, statusF, sortKey, sortAsc])

  // 직군 탭을 바꾸면 그 탭에 없는 값으로 걸려있던 직급/실/팀/파트 필터는 초기화
  useEffect(() => {
    setRankF('all'); setDivF('all'); setDeptF('all'); setTeamF('all')
  }, [trackF])

  const hs = (k) => {
    if (sortKey === k) setSortAsc(!sortAsc)
    else { setSortKey(k); setSortAsc(k === 'status') } // 상태는 승진가능이 먼저 오도록 오름차순 기본값
  }
  const ar = (k) => (sortKey === k ? (sortAsc ? ' ↑' : ' ↓') : '')

  if (error) return <ErrorBox error={error} />
  if (!employees) return <Loading />

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button style={btnGhost} onClick={() => setShowExportImport(true)}>📑 전체 데이터 다운로드 / 업로드</button>
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
        <input style={{ ...inp, minWidth: 200 }} placeholder="🔍  이름 · 실 · 팀 · 파트" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select style={{ ...inp, cursor: 'pointer' }} value={rankF} onChange={(e) => setRankF(e.target.value)}>
          <option value="all">전체 직급</option>
          {rankOptions.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select style={{ ...inp, cursor: 'pointer' }} value={locF} onChange={(e) => setLocF(e.target.value)}>
          <option value="all">전체 지역</option>
          {LOCATIONS.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <select style={{ ...inp, cursor: 'pointer' }} value={divF} onChange={(e) => setDivF(e.target.value)}>
          <option value="all">전체 실</option>
          {divOptions.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select style={{ ...inp, cursor: 'pointer' }} value={deptF} onChange={(e) => setDeptF(e.target.value)}>
          <option value="all">전체 팀</option>
          {deptOptions.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select style={{ ...inp, cursor: 'pointer' }} value={teamF} onChange={(e) => setTeamF(e.target.value)}>
          <option value="all">전체 파트</option>
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
                  <td style={{ ...tdS, fontWeight: 600 }}>{e.name}</td>
                  <td style={tdS}><LocationBadges locations={e.locations} /></td>
                  <td style={{ ...tdS, color: '#64748b' }}>
                    {orgExpanded ? orgPath(e) : (e.team || e.dept || e.division || '—')}
                  </td>
                  <td style={tdS}>{e.rank}</td>
                  <td style={tdS}><Bd color={(TRACK_BADGE[e.track] || TRACK_BADGE.사무).c} bg={(TRACK_BADGE[e.track] || TRACK_BADGE.사무).bg}>{TRACK_LABEL[e.track] || e.track}</Bd></td>
                  <td style={{ ...tdS, whiteSpace: historyExpanded ? 'normal' : 'nowrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'nowrap' }}>
                      {(historyExpanded ? e.history : e.history.slice(-6)).map((h) => <GB key={h.period} grade={h.grade} />)}
                      {historyExpanded && <BackfillBadges employee={e} />}
                    </div>
                  </td>
                  <td style={tdS}><Prog current={e.currentPts} max={e.threshold} /></td>
                  <td style={tdS}><span style={{ color: e.gap > 0 ? R : G, fontWeight: 600 }}>{e.gap > 0 ? `-${e.gap}P` : '충족'}</span></td>
                  <td style={tdS}><TenureBar level={e.level} reqTenure={e.req_tenure} /></td>
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
                  <td style={{ ...tdS, color: '#94a3b8', whiteSpace: 'normal', maxWidth: 200 }}>{e.note || ''}</td>
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
    </div>
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
    const rows = employees.map((e) => (EXEC_RANKS.includes(e.rank) ? { ...e, track: '임원' } : e))
    downloadCSV(`employees_${isBackup ? 'backup_' : ''}${stamp}.csv`, rows, CSV_COLUMNS)
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

function buildPatch(raw) {
  const patch = {
    name: (raw['이름'] || '').trim(),
    locations: (raw['위치(대전/판교/해외법인, 복수는 쉼표로 구분)'] || '').split(',').map((s) => s.trim()).filter(Boolean),
    division: (raw['실'] || '').trim() || null,
    dept: (raw['팀'] || '').trim(),
    team: (raw['파트'] || '').trim() || null,
    rank: (raw['직급'] || '').trim(),
    // "임원"은 실제 DB엔 없는 값(임원 여부는 직급으로 자동 판단) — CSV에서만 편의상 받아주고 사무로 정규화
    track: (() => {
      const t = (raw['직군(사무/사무외국어필수/연구/임원)'] || '').trim()
      return t === '임원' ? '사무' : t
    })(),
    level: Number(raw['연차']) || 0,
    backfill_full_tenure: /^(true|1|y|yes)$/i.test((raw['경력직백필(TRUE/FALSE)'] || '').trim()),
    eng_pts: Number(raw['영어점수']) || 0,
    eng_lifetime: /^(true|1|y|yes)$/i.test((raw['영어평생인정(TRUE/FALSE)'] || '').trim()),
    eng2_pts: Number(raw['제2외국어점수']) || 0,
    eng2_lifetime: /^(true|1|y|yes)$/i.test((raw['제2외국어평생인정(TRUE/FALSE)'] || '').trim()),
    cert_pts: Number(raw['자격가점']) || 0,
    award_pts: Number(raw['포상가점']) || 0,
    note: (raw['비고(겸직 등 자유메모)'] || '').trim() || null,
  }
  return patch
}

function validatePatch(patch) {
  const errs = []
  if (!patch.name) errs.push('이름이 비어있어요')
  if (!patch.dept) errs.push('팀이 비어있어요')
  if (!patch.rank) errs.push('직급이 비어있어요')
  if (!TRACKS.some((t) => t.value === patch.track)) errs.push(`직군 값이 이상해요: "${patch.track}" (사무/사무외국어필수/연구 중 하나여야 해요)`)
  return errs
}
