import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { O, P, G, Y, R } from '../lib/constants'
import { deriveEmployee, fetchRankCriteria } from '../lib/promotion'
import { KpiRow, Prog, crd, thS, tdS, Loading, ErrorBox, EmptyState } from '../components/ui'

export default function Dashboard() {
  const navigate = useNavigate()
  const [employees, setEmployees] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setError(null)
      const [{ data: emps, error: e1 }, { data: evals, error: e2 }, rankCriteria] = await Promise.all([
        supabase.from('employees').select('*'),
        supabase.from('evaluations').select('employee_id, period, points'),
        fetchRankCriteria(),
      ])
      if (cancelled) return
      if (e1 || e2) {
        setError(e1 || e2)
        return
      }
      const byEmp = {}
      ;(evals || []).forEach((ev) => {
        ;(byEmp[ev.employee_id] ||= []).push(ev)
      })
      setEmployees((emps || []).map((e) => deriveEmployee(e, byEmp[e.id] || [], rankCriteria)))
    }
    load().catch((err) => { if (!cancelled) setError(err) })
    return () => { cancelled = true }
  }, [])

  const stats = useMemo(() => {
    if (!employees) return null
    // "전체 대상"은 승진포인트 추적 대상(rank_criteria가 정의된 직급)만 — 임원/부장/수석연구원(해당없음)은 제외.
    // 회사 전체 인원수는 어느 화면에서든 상단 헤더에 따로 표시됨.
    const tracked = employees.filter((e) => e.hasCriteria)
    const total = tracked.length
    const possible = tracked.filter((e) => e.status === 'possible').length
    const ptShort = tracked.filter((e) => e.status === 'ptShort').length
    const tenureShort = tracked.filter((e) => e.status === 'tenureShort').length
    const engShort = tracked.filter((e) => e.status === 'engShort').length
    const short = tracked.filter((e) => e.status === 'short').length
    const avg = total ? (tracked.reduce((a, e) => a + e.currentPts, 0) / total).toFixed(1) : '0.0'

    const byRank = {}
    employees.forEach((e) => {
      const r = e.rank
      if (!byRank[r]) byRank[r] = { t: 0, p: 0, s: 0 }
      byRank[r].t++
      if (e.status === 'possible') byRank[r].p++
      byRank[r].s += e.currentPts
    })

    const imminent = tracked
      .filter((e) => e.threshold > 0 && e.currentPts / e.threshold >= 0.9 && e.status !== 'possible')
      .sort((a, b) => b.currentPts / b.threshold - a.currentPts / a.threshold)
      .slice(0, 8)

    return { total, possible, ptShort, tenureShort, engShort, short, avg, byRank, imminent }
  }, [employees])

  if (error) return <ErrorBox error={error} />
  if (!stats) return <Loading />

  return (
    <div>
      <KpiRow
        items={[
          { v: stats.total, l: '전체 대상', c: P },
          { v: stats.possible, l: '승진 가능', c: G },
          { v: stats.ptShort + stats.tenureShort, l: '연차/P 부족', c: Y },
          { v: stats.engShort, l: '영어 미충족', c: '#c026d3' },
          { v: stats.short, l: '미충족', c: R },
          { v: stats.avg, l: '평균 포인트', c: O },
        ]}
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={crd}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>직급별 현황</div>
          {Object.keys(stats.byRank).length === 0 ? (
            <EmptyState />
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['직급', '인원', '승진가능', '평균'].map((h) => <th key={h} style={thS}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {Object.entries(stats.byRank).map(([r, d]) => (
                  <tr key={r}>
                    <td style={tdS}>{r}</td>
                    <td style={tdS}>{d.t}명</td>
                    <td style={{ ...tdS, color: G, fontWeight: 600 }}>{d.p}명</td>
                    <td style={tdS}>{(d.s / d.t).toFixed(1)}P</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div style={crd}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>
            승진 임박자 <span style={{ fontSize: 11, fontWeight: 400, color: '#94a3b8' }}>(90%+)</span>
          </div>
          {stats.imminent.length === 0 ? (
            <EmptyState />
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['이름', '직급', '달성률'].map((h) => <th key={h} style={thS}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {stats.imminent.map((e) => (
                  <tr
                    key={e.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/employees/${e.id}`)}
                    onMouseEnter={(ev) => (ev.currentTarget.style.background = '#f8fafc')}
                    onMouseLeave={(ev) => (ev.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ ...tdS, color: O, fontWeight: 600 }}>{e.name}</td>
                    <td style={tdS}>{e.rank}</td>
                    <td style={tdS}><Prog current={e.currentPts} max={e.threshold} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
