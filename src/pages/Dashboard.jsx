import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { O, P, G, Y, R, B } from '../lib/constants'
import { deriveEmployee, fetchRankCriteria } from '../lib/promotion'
import { KpiRow, Prog, crd, thS, tdS, Loading, ErrorBox, EmptyState } from '../components/ui'

// 임원은 track 값과 무관하게 "승진 기준이 없는 사람"으로 판단 (hasCriteria === false)
const CATEGORIES = [
  { key: '사무', label: '사무직', c: '#475569', test: (e) => e.hasCriteria && e.track === '사무' },
  { key: '사무영어필수', label: '사무직(영어필수)', c: B, test: (e) => e.hasCriteria && e.track === '사무영어필수' },
  { key: '연구', label: '연구직', c: P, test: (e) => e.hasCriteria && e.track === '연구' },
  { key: '임원', label: '임원', c: '#92400e', test: (e) => !e.hasCriteria },
]

export default function Dashboard() {
  const navigate = useNavigate()
  const [employees, setEmployees] = useState(null)
  const [error, setError] = useState(null)
  const [category, setCategory] = useState('사무')

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

    const categoryCounts = Object.fromEntries(CATEGORIES.map((c) => [c.key, employees.filter(c.test).length]))

    const imminent = tracked
      .filter((e) => e.threshold > 0 && e.currentPts / e.threshold >= 0.9 && e.status !== 'possible')
      .sort((a, b) => b.currentPts / b.threshold - a.currentPts / a.threshold)
      .slice(0, 8)

    return { total, possible, ptShort, tenureShort, engShort, short, avg, categoryCounts, imminent }
  }, [employees])

  const byRank = useMemo(() => {
    if (!employees) return {}
    const cat = CATEGORIES.find((c) => c.key === category)
    const scoped = cat ? employees.filter(cat.test) : employees
    const out = {}
    scoped.forEach((e) => {
      const r = e.rank
      if (!out[r]) out[r] = { t: 0, p: 0, s: 0 }
      out[r].t++
      if (e.status === 'possible') out[r].p++
      out[r].s += e.currentPts
    })
    return out
  }, [employees, category])

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
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>직급별 현황</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
            {CATEGORIES.map((c) => (
              <button
                key={c.key} onClick={() => setCategory(c.key)}
                style={{
                  padding: '6px 12px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  color: category === c.key ? '#fff' : c.c,
                  background: category === c.key ? c.c : '#f1f5f9',
                }}
              >
                {c.label} <span style={{ opacity: 0.85 }}>{stats.categoryCounts[c.key]}</span>
              </button>
            ))}
          </div>
          {Object.keys(byRank).length === 0 ? (
            <EmptyState />
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['직급', '인원', '승진가능', '평균'].map((h) => <th key={h} style={thS}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {Object.entries(byRank).map(([r, d]) => (
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
