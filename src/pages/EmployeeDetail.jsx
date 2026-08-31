import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { sortByPeriod, GRADE_COLOR, GRADE_HEIGHT, SIM_GRADE_POINTS, TRACK_LABEL, orgPath, O, P, G, Y, R, B } from '../lib/constants'
import { deriveEmployee, fetchRankCriteria } from '../lib/promotion'
import { SB, Bd, LocationBadges, Prog, TenureBar, crd, Loading, ErrorBox } from '../components/ui'

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
      const [{ data: e, error: e1 }, { data: evals, error: e2 }, rankCriteria] = await Promise.all([
        supabase.from('employees').select('*').eq('id', id).single(),
        supabase.from('evaluations').select('*').eq('employee_id', id),
        fetchRankCriteria(),
      ])
      if (cancelled) return
      if (e1 || e2) { setError(e1 || e2); return }
      const hist = sortByPeriod(evals || [])
      setEmp(deriveEmployee(e, hist, rankCriteria))
      setHistory(hist)
    }
    load().catch((err) => { if (!cancelled) setError(err) })
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
    { l: '경력인정 포인트', v: emp.backfillPts || 0, c: P },
    { l: '휴직 포인트', v: emp.leavePts || 0, c: B },
    { l: '전문/직무 자격·기술성과 가점', v: emp.cert_pts || 0, c: '#6366f1' },
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <LocationBadges locations={emp.locations} />
              <div style={{ fontSize: 12, color: '#64748b' }}>
                {orgPath(emp)}{emp.role ? ` · ${emp.role}` : ''}
              </div>
            </div>
            {emp.note && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>📝 {emp.note}</div>}
          </div>
          <SB status={emp.status} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16 }}>
          <div><div style={fl}>직급</div><div style={fv}>{emp.rank}</div></div>
          <div><div style={fl}>직군</div><div style={fv}>{TRACK_LABEL[emp.track] || emp.track}</div></div>
          {emp.hasCriteria ? (
            <>
              <div>
                <div style={fl}>체류연한{emp.leaveYears > 0 ? ` (근무 ${emp.level || 0}년 + 휴직 ${emp.leaveYears}년)` : ''}</div>
                <div style={fv}><TenureBar level={emp.effectiveLevel} reqTenure={emp.req_tenure} /></div>
              </div>
              <div><div style={fl}>진급 기준</div><div style={fv}>{emp.threshold}P</div></div>
            </>
          ) : (
            <div style={{ gridColumn: 'span 2' }}><div style={fl}>승진포인트 기준</div><div style={{ ...fv, color: '#94a3b8' }}>해당없음 (임원/부장/수석연구원은 별도 승진 기준을 두지 않음)</div></div>
          )}
        </div>
        {(emp.engGated || emp.eng_pts > 0 || emp.eng2_pts > 0) && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #f1f5f9' }}>
            <div style={fl}>어학 (승진포인트 합계에는 포함되지 않는 별도 필수요건 필드)</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 4, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: '#64748b' }}>
                영어 {emp.eng_pts || 0}P{emp.eng_lifetime ? ' · AL/IH 평생인정' : ''}
              </span>
              {emp.eng2_pts > 0 && (
                <span style={{ fontSize: 12, color: '#64748b' }}>
                  제2외국어 {emp.eng2_pts}P{emp.eng2_lifetime ? ' · 평생인정' : ''}
                </span>
              )}
              {emp.engGated && (
                <>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>승진요건(Im3 이상):</span>
                  <Bd color={emp.engOk ? G : '#c026d3'} bg={emp.engOk ? '#dcfce7' : '#fae8ff'}>
                    {emp.engOk ? '✅ 충족' : '❌ 미충족'}
                  </Bd>
                </>
              )}
            </div>
          </div>
        )}
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
                    <span style={{ fontSize: 10, fontWeight: 700, color: GRADE_COLOR[h.grade] || '#94a3b8' }}>{h.grade}</span>
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
          {emp.hasCriteria ? (
            <div style={{ marginTop: 8 }}><Prog current={emp.currentPts} max={emp.threshold} /></div>
          ) : (
            <div style={{ marginTop: 8, fontSize: 11, color: '#94a3b8' }}>승진포인트 추적 대상이 아니에요.</div>
          )}
        </div>
      </div>

      {emp.hasCriteria && (
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
      )}
    </div>
  )
}
