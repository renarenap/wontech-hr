import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { sortByPeriod, TRACKS, TRACK_LABEL, STATUS_LABEL, P, B, G, R } from '../lib/constants'
import { deriveEmployee, fetchRankCriteria, CATEGORIES } from '../lib/promotion'
import { Bd, GB, Prog, TenureBar, thS, tdS, inp, Loading, ErrorBox, EmptyState, Modal, btnPrimary, btnGhost } from '../components/ui'
import { downloadCSV, parseCSV } from '../lib/csv'

const TRACK_BADGE = { 사무: { c: '#475569', bg: '#f1f5f9' }, 사무영어필수: { c: B, bg: '#e0f2fe' }, 연구: { c: P, bg: '#f3e8ff' } }
const CATEGORY_COLOR = { 사무: '#475569', 사무영어필수: B, 연구: P, 임원: '#92400e' }
const CATEGORY_LABEL = { ...TRACK_LABEL, 임원: '임원' }

// CSV 내보내기/가져오기에 쓰는 편집 가능 컬럼 (id는 매칭용, 절대 수정·삭제 금지)
const CSV_COLUMNS = [
  { key: 'id', label: 'id' },
  { key: 'name', label: '이름' },
  { key: 'dept', label: '소속' },
  { key: 'team', label: '팀' },
  { key: 'rank', label: '직급' },
  { key: 'track', label: '직군(사무/사무영어필수/연구)' },
  { key: 'level', label: '연차' },
  { key: 'backfill_full_tenure', label: '경력직백필(TRUE/FALSE)' },
  { key: 'eng_pts', label: '영어점수' },
  { key: 'eng_lifetime', label: '영어평생인정(TRUE/FALSE)' },
  { key: 'eng2_pts', label: '제2외국어점수' },
  { key: 'eng2_lifetime', label: '제2외국어평생인정(TRUE/FALSE)' },
  { key: 'cert_pts', label: '자격가점' },
  { key: 'award_pts', label: '포상가점' },
  { key: 'currentPts', label: '(참고)현재포인트' },
]
const CSV_EDITABLE_KEYS = ['name', 'dept', 'team', 'rank', 'track', 'level', 'backfill_full_tenure', 'eng_pts', 'eng_lifetime', 'eng2_pts', 'eng2_lifetime', 'cert_pts', 'award_pts']
const CSV_BOOL_KEYS = new Set(['backfill_full_tenure', 'eng_lifetime', 'eng2_lifetime'])
const CSV_NUM_KEYS = new Set(['level', 'eng_pts', 'eng2_pts', 'cert_pts', 'award_pts'])

export default function EmployeeList() {
  const navigate = useNavigate()
  const [employees, setEmployees] = useState(null)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [trackF, setTrackF] = useState('all') // 'all' | CATEGORIES[].key
  const [rankF, setRankF] = useState('all')
  const [deptF, setDeptF] = useState('all')
  const [teamF, setTeamF] = useState('all')
  const [statusF, setStatusF] = useState('all')
  const [sortKey, setSortKey] = useState('currentPts')
  const [sortAsc, setSortAsc] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [showExportImport, setShowExportImport] = useState(false)

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
  const deptOptions = useMemo(() => [...new Set(scopedByTrack.map((e) => e.dept).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko')), [scopedByTrack])
  const teamOptions = useMemo(() => [...new Set(scopedByTrack.map((e) => e.team).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko')), [scopedByTrack])

  const filtered = useMemo(() => {
    if (!employees) return []
    let l = scopedByTrack.filter((e) => {
      if (search && !e.name.includes(search) && !e.dept.includes(search) && !(e.team || '').includes(search)) return false
      if (rankF !== 'all' && e.rank !== rankF) return false
      if (deptF !== 'all' && e.dept !== deptF) return false
      if (teamF !== 'all' && e.team !== teamF) return false
      if (statusF === 'possible' && e.status !== 'possible') return false
      if (statusF === 'short' && e.status === 'possible') return false
      return true
    })
    l.sort((a, b) => (sortAsc ? (a[sortKey] > b[sortKey] ? 1 : -1) : a[sortKey] < b[sortKey] ? 1 : -1))
    return l
  }, [employees, scopedByTrack, search, rankF, deptF, teamF, statusF, sortKey, sortAsc])

  // 직군 탭을 바꾸면 그 탭에 없는 값으로 걸려있던 직급/부서/팀 필터는 초기화
  useEffect(() => {
    setRankF('all'); setDeptF('all'); setTeamF('all')
  }, [trackF])

  const hs = (k) => {
    if (sortKey === k) setSortAsc(!sortAsc)
    else { setSortKey(k); setSortAsc(false) }
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
        <input style={{ ...inp, minWidth: 200 }} placeholder="🔍  이름 · 부서 · 팀" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select style={{ ...inp, cursor: 'pointer' }} value={rankF} onChange={(e) => setRankF(e.target.value)}>
          <option value="all">전체 직급</option>
          {rankOptions.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select style={{ ...inp, cursor: 'pointer' }} value={deptF} onChange={(e) => setDeptF(e.target.value)}>
          <option value="all">전체 부서</option>
          {deptOptions.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select style={{ ...inp, cursor: 'pointer' }} value={teamF} onChange={(e) => setTeamF(e.target.value)}>
          <option value="all">전체 팀</option>
          {teamOptions.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select style={{ ...inp, cursor: 'pointer' }} value={statusF} onChange={(e) => setStatusF(e.target.value)}>
          <option value="all">전체 상태</option>
          <option value="possible">승진 가능</option>
          <option value="short">미충족</option>
        </select>
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
                <th style={{ ...thS, cursor: 'pointer' }} onClick={() => hs('dept')}>소속{ar('dept')}</th>
                <th style={{ ...thS, cursor: 'pointer' }} onClick={() => hs('rank')}>직급{ar('rank')}</th>
                <th style={{ ...thS, cursor: 'pointer' }} onClick={() => hs('track')}>직군{ar('track')}</th>
                <th style={thS}>평가 이력</th>
                <th style={{ ...thS, cursor: 'pointer' }} onClick={() => hs('backfillPts')}>백필P{ar('backfillPts')}</th>
                <th style={{ ...thS, cursor: 'pointer' }} onClick={() => hs('currentPts')}>포인트{ar('currentPts')}</th>
                <th style={{ ...thS, cursor: 'pointer' }} onClick={() => hs('gap')}>잔여{ar('gap')}</th>
                <th style={{ ...thS, cursor: 'pointer' }} onClick={() => hs('level')}>연차{ar('level')}</th>
                <th style={thS}>상태</th>
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
                  <td style={{ ...tdS, color: '#64748b' }}>{e.dept}{e.team ? ` · ${e.team}` : ''}</td>
                  <td style={tdS}>{e.rank}</td>
                  <td style={tdS}><Bd color={(TRACK_BADGE[e.track] || TRACK_BADGE.사무).c} bg={(TRACK_BADGE[e.track] || TRACK_BADGE.사무).bg}>{TRACK_LABEL[e.track] || e.track}</Bd></td>
                  <td style={tdS}><div style={{ display: 'flex' }}>{e.history.slice(-6).map((h) => <GB key={h.period} grade={h.grade} />)}</div></td>
                  <td style={{ ...tdS, color: e.backfillPts > 0 ? P : '#d1d5db' }}>{e.backfillPts || 0}P</td>
                  <td style={tdS}><Prog current={e.currentPts} max={e.threshold} /></td>
                  <td style={tdS}><span style={{ color: e.gap > 0 ? R : G, fontWeight: 600 }}>{e.gap > 0 ? `-${e.gap}P` : '충족'}</span></td>
                  <td style={tdS}><TenureBar level={e.level} reqTenure={e.req_tenure} /></td>
                  <td style={tdS}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {e.issues.map((i) => {
                        const cfg = STATUS_LABEL[i] || STATUS_LABEL.short
                        return <Bd key={i} color={cfg.color} bg={cfg.bg}>{cfg.label}</Bd>
                      })}
                    </div>
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
    </div>
  )
}

// ═══ 전체 데이터 CSV 다운로드 / 업로드 (엑셀에서 편집 후 재반영) ═══
function ExportImportModal({ employees, onClose, onApplied }) {
  const [rows, setRows] = useState(null) // 업로드 후 분류된 변경사항
  const [error, setError] = useState('')
  const [applying, setApplying] = useState(false)
  const [result, setResult] = useState(null)

  const download = () => {
    const today = new Date().toISOString().slice(0, 10)
    downloadCSV(`employees_${today}.csv`, employees, CSV_COLUMNS)
  }

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
          <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.7, marginBottom: 16 }}>
            1. 아래 버튼으로 전체 명단을 CSV로 받아서 엑셀에서 열어 수정하세요 (맨 앞 <b>id</b> 칸은 지우거나 바꾸지 마세요 — 어떤 사람인지 매칭하는 용도예요).<br />
            2. 수정 끝나면 <b>CSV로 저장</b>한 다음, 그 파일을 아래에서 업로드하세요.<br />
            3. id가 있는 행은 <b>수정</b>으로, id를 비워두고 이름만 채운 행은 <b>신규 추가</b>로 처리돼요. 행을 통째로 지우는 건 삭제로 인식하지 않아요(안전을 위해 — 퇴사 처리는 "입·퇴사 관리"에서 해주세요).
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button type="button" style={btnPrimary} onClick={download}>⬇ CSV 다운로드 ({employees.length}명)</button>
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
    dept: (raw['소속'] || '').trim(),
    team: (raw['팀'] || '').trim() || null,
    rank: (raw['직급'] || '').trim(),
    track: (raw['직군(사무/사무영어필수/연구)'] || '').trim(),
    level: Number(raw['연차']) || 0,
    backfill_full_tenure: /^(true|1|y|yes)$/i.test((raw['경력직백필(TRUE/FALSE)'] || '').trim()),
    eng_pts: Number(raw['영어점수']) || 0,
    eng_lifetime: /^(true|1|y|yes)$/i.test((raw['영어평생인정(TRUE/FALSE)'] || '').trim()),
    eng2_pts: Number(raw['제2외국어점수']) || 0,
    eng2_lifetime: /^(true|1|y|yes)$/i.test((raw['제2외국어평생인정(TRUE/FALSE)'] || '').trim()),
    cert_pts: Number(raw['자격가점']) || 0,
    award_pts: Number(raw['포상가점']) || 0,
  }
  return patch
}

function validatePatch(patch) {
  const errs = []
  if (!patch.name) errs.push('이름이 비어있어요')
  if (!patch.dept) errs.push('소속이 비어있어요')
  if (!patch.rank) errs.push('직급이 비어있어요')
  if (!TRACKS.some((t) => t.value === patch.track)) errs.push(`직군 값이 이상해요: "${patch.track}" (사무/사무영어필수/연구 중 하나여야 해요)`)
  return errs
}
