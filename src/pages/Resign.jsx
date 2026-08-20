import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { P, O, R } from '../lib/constants'
import { Bd, Check, DdayBd, KpiRow, Prog, crd, thS, tdS, Loading, ErrorBox, EmptyState, dDayFrom } from '../components/ui'

const CHECK_FIELDS = [
  ['handover_done', '업무 인수인계 완료'],
  ['equipment_returned', '장비 반납 (PC/모니터/사원증)'],
  ['account_disabled', '계정 비활성화 (이메일/ERP/VPN)'],
  ['exit_interview_done', '퇴직 면담 완료'],
  ['certificate_issued', '경력증명서 / 퇴직 서류 발급'],
]

function withDerived(r) {
  const done = CHECK_FIELDS.filter(([f]) => r[f]).length
  const total = CHECK_FIELDS.length
  return { ...r, done, total, pct: Math.round((done / total) * 100), dDay: dDayFrom(r.last_day) }
}

export default function Resign() {
  const [list, setList] = useState(null)
  const [error, setError] = useState(null)
  const [sel, setSel] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error } = await supabase.from('resignations').select('*').order('last_day')
      if (cancelled) return
      if (error) { setError(error); return }
      setList((data || []).map(withDerived))
    }
    load()
    return () => { cancelled = true }
  }, [])

  const toggle = async (field) => {
    const r = list.find((x) => x.id === sel)
    if (!r) return
    const next = !r[field]
    setList(list.map((x) => (x.id === sel ? withDerived({ ...x, [field]: next }) : x)))
    const { error } = await supabase.from('resignations').update({ [field]: next }).eq('id', sel)
    if (error) setError(error)
  }

  if (error) return <ErrorBox error={error} />
  if (!list) return <Loading />

  const s = list.find((r) => r.id === sel)
  const stCfg = { 진행중: { c: O, bg: '#fff7ed' }, 완료: { c: '#64748b', bg: '#f1f5f9' } }

  return (
    <div>
      <KpiRow items={[
        { v: list.length, l: '퇴사 건수', c: P },
        { v: list.filter((r) => r.status === '진행중').length, l: '진행중', c: O },
        { v: list.filter((r) => r.dDay <= 14 && r.dDay > 0).length, l: '2주 이내 퇴사', c: R },
        { v: list.filter((r) => r.status === '완료').length, l: '처리 완료', c: '#64748b' },
      ]} />
      <div style={{ display: 'grid', gridTemplateColumns: s ? '1fr 1fr' : '1fr', gap: 16 }}>
        <div style={crd}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>퇴사 현황</div>
          {list.length === 0 ? <EmptyState /> : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['이름', '소속', '직급', '사유', '퇴사 신청일', '최종 근무일', 'D-Day', '상태', '처리율'].map((h) => <th key={h} style={thS}>{h}</th>)}</tr></thead>
              <tbody>
                {list.map((r) => {
                  const st = stCfg[r.status] || stCfg['완료']
                  return (
                    <tr key={r.id} style={{ cursor: 'pointer', background: sel === r.id ? '#FFF5F0' : 'transparent' }}
                      onClick={() => setSel(r.id === sel ? null : r.id)}
                      onMouseEnter={(ev) => { if (sel !== r.id) ev.currentTarget.style.background = '#f8fafc' }}
                      onMouseLeave={(ev) => { if (sel !== r.id) ev.currentTarget.style.background = 'transparent' }}>
                      <td style={{ ...tdS, fontWeight: 600 }}>{r.name}</td>
                      <td style={{ ...tdS, color: '#64748b' }}>{r.dept}</td>
                      <td style={tdS}>{r.rank}</td>
                      <td style={tdS}><Bd color="#475569" bg="#f1f5f9">{r.reason}</Bd></td>
                      <td style={tdS}>{r.submit_date}</td>
                      <td style={tdS}>{r.last_day}</td>
                      <td style={tdS}><DdayBd d={r.dDay} /></td>
                      <td style={tdS}><Bd color={st.c} bg={st.bg}>{r.status}</Bd></td>
                      <td style={tdS}><Prog current={r.done} max={r.total} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
        {s && (
          <div style={crd}>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>{s.name}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>{s.dept}{s.team ? ` · ${s.team}` : ''} · {s.rank}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div style={{ background: '#f8fafc', borderRadius: 8, padding: 12 }}><div style={{ fontSize: 11, color: '#64748b' }}>퇴사 사유</div><div style={{ fontSize: 14, fontWeight: 600 }}>{s.reason}</div></div>
              <div style={{ background: '#f8fafc', borderRadius: 8, padding: 12 }}><div style={{ fontSize: 11, color: '#64748b' }}>최종 근무일</div><div style={{ fontSize: 14, fontWeight: 600 }}>{s.last_day}</div></div>
              <div style={{ background: '#f8fafc', borderRadius: 8, padding: 12 }}><div style={{ fontSize: 11, color: '#64748b' }}>D-Day</div><div style={{ fontSize: 14, fontWeight: 600, color: s.dDay <= 0 ? '#64748b' : R }}>{s.dDay <= 0 ? '퇴사 완료' : `D-${s.dDay}`}</div></div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>📋 퇴사 처리 체크리스트</div>
            {CHECK_FIELDS.map(([f, label]) => (
              <Check key={f} done={s[f]} label={label} onToggle={() => toggle(f)} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
