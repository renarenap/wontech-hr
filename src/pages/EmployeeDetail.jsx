import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { deriveEmployee, sortByPeriod, GRADE_LABEL, GRADE_COLOR, GRADE_HEIGHT, SIM_GRADE_POINTS, O, P, G, Y, R } from '../lib/constants'
import { SB, Prog, crd, Loading, ErrorBox } from '../components/ui'

export default function EmployeeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [emp, setEmp] = useState(null)
  const [history, setHistory] = useState([])
  const [error, setError] = useState(null)
  const [sim, setSim] = useState('GD')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setError(null)
      setEmp(null)
      const [{ data: e, error: e1 }, { data: evals, error: e2 }] = await Promise.all([
        supabase.from('employees').select('*').eq('id', id).single(),
        supabase.from('evaluations').select('*').eq('employee_id', id),
      ])
      if (cancelled) return
      if (e1 || e2) { setError(e1 || e2); return }
      const hist = sortByPeriod(evals || [])
      const sum = hist.reduce((a, h) => a + Number(h.points || 0), 0)
      setEmp(deriveEmployee(e, sum))
      setHistory(hist)
    }
    load()
    return () => { cancelled = true }
  }, [id])

  if (error) return <ErrorBox error={error} />
  if (!emp) return <Loading />

  const sp = SIM_GRADE_POINTS
  const proj = emp.currentPts + (sp[sim] || 6)
  const pg = Math.max(0, emp.threshold - proj)
  const fl = { fontSize: 11, color: '#64748b', marginBottom: 4 }
  const fv = { fontSize: 14, fontWeight: 600 }

  const breakdown = [
    { l: '평가 포인트', v: emp.evalPts, c: O },
    { l: '기본 포인트 (연차)', v: emp.base_pts || 0, c: P },
    { l: '기술성과 가점 (해외/국제)', v: emp.eng_pts || 0, c: '#0284c7' },
    { l: '기술성과 가점 (국내)', v: emp.eng2_pts || 0, c: '#14b8a6' },
    { l: '전문/직무 자격 가점', v: emp.cert_pts || 0, c: '#6366f1' },
    { l: '포상 가점', v: emp.award_pts || 0, c: '#ca8a04' },
  ]

  return (
    <div>
      <button
        onClick={() => navigate('/employees')}
        style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 16px', color: '#64748b', fontSize: 12, cursor: 'pointer' }}
      >
        ← 목록으로
      </button>

      <div style={{ ...crd, marginTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{emp.name}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
              {emp.dept}{emp.team ? ` · ${emp.team}` : ''}{emp.role ? ` · ${emp.role}` : ''}
            </div>
          </div>
          <SB status={emp.status} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16 }}>
          <div><div style={fl}>직급</div><div style={fv}>{emp.rank}</div></div>
          <div><div style={fl}>직군</div><div style={fv}>{emp.track}</div></div>
          <div><div style={fl}>체류연한</div><div style={fv}>{emp.level}년/{emp.req_tenure}년 {emp.tenureMet ? '✅' : '❌'}</div></div>
          <div><div style={fl}>진급 기준</div><div style={fv}>{emp.threshold}P</div></div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={crd}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>📊 평가 이력</div>
          {history.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>평가 이력이 없습니다</div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', height: 120, padding: '0 8px', marginBottom: 10 }}>
              {history.map((h) => {
                const height = (GRADE_HEIGHT[h.grade] || 0) * 10
                return (
                  <div key={h.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: GRADE_COLOR[h.grade] || '#94a3b8' }}>{GRADE_LABEL[h.grade] || h.grade}</span>
                    <div style={{ width: 32, height, borderRadius: 5, background: GRADE_COLOR[h.grade] || '#e2e8f0' }} />
                    <span style={{ fontSize: 9, color: '#94a3b8' }}>{h.period}</span>
                  </div>
                )
              })}
            </div>
          )}
          <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 10, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#64748b', fontSize: 12 }}>평가 포인트 합계</span>
            <span style={{ color: O, fontWeight: 700, fontSize: 14 }}>{emp.evalPts}P</span>
          </div>
        </div>

        <div style={crd}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>🏅 포인트 구성</div>
          {breakdown.map(({ l, v, c }) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: 4, background: c }} />
                <span style={{ fontSize: 12, color: '#64748b' }}>{l}</span>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: v > 0 ? c : '#d1d5db' }}>{v}P</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0 0' }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>총 승진포인트</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: O }}>{emp.currentPts}P</span>
          </div>
          <div style={{ marginTop: 8 }}><Prog current={emp.currentPts} max={emp.threshold} /></div>
        </div>
      </div>

      <div style={crd}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>🔮 2026 시뮬레이션</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
          <span style={{ fontSize: 12, color: '#64748b' }}>26년 예상 등급 :</span>
          {['EX', 'VG', 'GD', 'NI'].map((g) => (
            <button
              key={g} onClick={() => setSim(g)}
              style={{ padding: '6px 16px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: sim === g ? '#fff' : '#64748b', background: sim === g ? P : '#f1f5f9' }}
            >
              {g}
            </button>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          {[
            { l: '추가', v: `+${sp[sim]}P`, c: P },
            { l: '예상 총', v: `${proj}P`, c: proj >= emp.threshold ? G : Y },
            { l: '잔여', v: pg > 0 ? `-${pg}P` : '✅ 충족', c: pg > 0 ? R : G },
          ].map(({ l, v, c }) => (
            <div key={l} style={{ background: '#f8fafc', borderRadius: 10, padding: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{l}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: c }}>{v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
