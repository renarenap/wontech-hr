import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { deriveEmployee, sortByPeriod, P, G, R } from '../lib/constants'
import { Bd, GB, SB, Prog, thS, tdS, inp, Loading, ErrorBox, EmptyState } from '../components/ui'

export default function EmployeeList() {
  const navigate = useNavigate()
  const [employees, setEmployees] = useState(null)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [trackF, setTrackF] = useState('all')
  const [statusF, setStatusF] = useState('all')
  const [sortKey, setSortKey] = useState('currentPts')
  const [sortAsc, setSortAsc] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setError(null)
      const [{ data: emps, error: e1 }, { data: evals, error: e2 }] = await Promise.all([
        supabase.from('employees').select('*'),
        supabase.from('evaluations').select('employee_id, period, grade, points').order('period'),
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
        const sum = history.reduce((a, h) => a + Number(h.points || 0), 0)
        return { ...deriveEmployee(e, sum), history }
      })
      setEmployees(list)
    }
    load()
    return () => { cancelled = true }
  }, [])

  const filtered = useMemo(() => {
    if (!employees) return []
    let l = employees.filter((e) => {
      if (search && !e.name.includes(search) && !e.dept.includes(search) && !(e.team || '').includes(search)) return false
      if (trackF !== 'all' && e.track !== trackF) return false
      if (statusF === 'possible' && e.status !== 'possible') return false
      if (statusF === 'short' && e.status === 'possible') return false
      return true
    })
    l.sort((a, b) => (sortAsc ? (a[sortKey] > b[sortKey] ? 1 : -1) : a[sortKey] < b[sortKey] ? 1 : -1))
    return l
  }, [employees, search, trackF, statusF, sortKey, sortAsc])

  const hs = (k) => {
    if (sortKey === k) setSortAsc(!sortAsc)
    else { setSortKey(k); setSortAsc(false) }
  }
  const ar = (k) => (sortKey === k ? (sortAsc ? ' ↑' : ' ↓') : '')

  if (error) return <ErrorBox error={error} />
  if (!employees) return <Loading />

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input style={{ ...inp, minWidth: 200 }} placeholder="🔍  이름 · 부서 · 팀" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select style={{ ...inp, cursor: 'pointer' }} value={trackF} onChange={(e) => setTrackF(e.target.value)}>
          <option value="all">전체 직군</option>
          <option value="사무">사무직</option>
          <option value="연구">연구직</option>
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
                <th style={thS}>이름</th><th style={thS}>소속</th><th style={thS}>직급</th><th style={thS}>직군</th><th style={thS}>평가 이력</th>
                <th style={{ ...thS, cursor: 'pointer' }} onClick={() => hs('currentPts')}>포인트{ar('currentPts')}</th>
                <th style={{ ...thS, cursor: 'pointer' }} onClick={() => hs('gap')}>잔여{ar('gap')}</th>
                <th style={thS}>연차</th><th style={thS}>상태</th>
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
                  <td style={tdS}><Bd color={e.track === '연구' ? P : '#475569'} bg={e.track === '연구' ? '#f3e8ff' : '#f1f5f9'}>{e.track}</Bd></td>
                  <td style={tdS}><div style={{ display: 'flex' }}>{e.history.slice(-6).map((h) => <GB key={h.period} grade={h.grade} />)}</div></td>
                  <td style={tdS}><Prog current={e.currentPts} max={e.threshold} /></td>
                  <td style={tdS}><span style={{ color: e.gap > 0 ? R : G, fontWeight: 600 }}>{e.gap > 0 ? `-${e.gap}P` : '충족'}</span></td>
                  <td style={tdS}><span style={{ color: e.tenureMet ? G : '#94a3b8' }}>{e.level}년/{e.req_tenure}년</span></td>
                  <td style={tdS}><SB status={e.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
