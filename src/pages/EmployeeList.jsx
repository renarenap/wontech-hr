import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { sortByPeriod, TRACK_LABEL, STATUS_LABEL, P, B, G, R } from '../lib/constants'
import { deriveEmployee, fetchRankCriteria, CATEGORIES } from '../lib/promotion'
import { Bd, GB, Prog, thS, tdS, inp, Loading, ErrorBox, EmptyState } from '../components/ui'

const TRACK_BADGE = { 사무: { c: '#475569', bg: '#f1f5f9' }, 사무영어필수: { c: B, bg: '#e0f2fe' }, 연구: { c: P, bg: '#f3e8ff' } }
const CATEGORY_COLOR = { 사무: '#475569', 사무영어필수: B, 연구: P, 임원: '#92400e' }
const CATEGORY_LABEL = { ...TRACK_LABEL, 임원: '임원' }

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
  }, [])

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
                  <td style={tdS}><span style={{ color: e.tenureMet ? G : '#94a3b8' }}>{e.level}년/{e.req_tenure}년</span></td>
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
    </div>
  )
}
