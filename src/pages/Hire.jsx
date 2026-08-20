import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { P, G, O, B, Y } from '../lib/constants'
import { Bd, Check, DdayBd, KpiRow, Prog, crd, thS, tdS, Loading, ErrorBox, EmptyState, dDayFrom } from '../components/ui'

const CHECK_FIELDS = [
  ['offer_sent', '오퍼레터 발송'],
  ['contract_signed', '근로계약서 서명'],
  ['equipment_ready', '장비 준비 (PC/모니터/폰)'],
  ['account_created', '계정 생성 (이메일/ERP/그룹웨어)'],
  ['seat_assigned', '좌석 배정 완료'],
  ['welcome_kit_sent', '웰컴키트 발송'],
]

function withDerived(h) {
  const done = CHECK_FIELDS.filter(([f]) => h[f]).length
  const total = CHECK_FIELDS.length
  return { ...h, done, total, pct: Math.round((done / total) * 100), dDay: dDayFrom(h.join_date) }
}

export default function Hire() {
  const [hires, setHires] = useState(null)
  const [error, setError] = useState(null)
  const [sel, setSel] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error } = await supabase.from('hires').select('*').order('join_date')
      if (cancelled) return
      if (error) { setError(error); return }
      setHires((data || []).map(withDerived))
    }
    load()
    return () => { cancelled = true }
  }, [])

  const toggle = async (field) => {
    const h = hires.find((x) => x.id === sel)
    if (!h) return
    const next = !h[field]
    setHires(hires.map((x) => (x.id === sel ? withDerived({ ...x, [field]: next }) : x)))
    const { error } = await supabase.from('hires').update({ [field]: next }).eq('id', sel)
    if (error) setError(error)
  }

  if (error) return <ErrorBox error={error} />
  if (!hires) return <Loading />

  const s = hires.find((h) => h.id === sel)
  const stCfg = { 입사확정: { c: G, bg: '#dcfce7' }, 처우협의중: { c: Y, bg: '#fef9c3' } }

  return (
    <div>
      <KpiRow items={[
        { v: hires.length, l: '입사 예정', c: P },
        { v: hires.filter((h) => h.status === '입사확정').length, l: '입사 확정', c: G },
        { v: hires.filter((h) => h.dDay <= 14).length, l: '2주 이내 입사', c: O },
        { v: hires.filter((h) => h.pct === 100).length, l: '준비 완료', c: B },
      ]} />
      <div style={{ display: 'grid', gridTemplateColumns: s ? '1fr 1fr' : '1fr', gap: 16 }}>
        <div style={crd}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>입사 예정자</div>
          {hires.length === 0 ? <EmptyState /> : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['이름', '소속', '직급', '채용유형', '입사일', 'D-Day', '상태', '준비율'].map((h) => <th key={h} style={thS}>{h}</th>)}</tr></thead>
              <tbody>
                {hires.map((h) => {
                  const st = stCfg[h.status] || { c: '#64748b', bg: '#f1f5f9' }
                  return (
                    <tr key={h.id} style={{ cursor: 'pointer', background: sel === h.id ? '#FFF5F0' : 'transparent' }}
                      onClick={() => setSel(h.id === sel ? null : h.id)}
                      onMouseEnter={(ev) => { if (sel !== h.id) ev.currentTarget.style.background = '#f8fafc' }}
                      onMouseLeave={(ev) => { if (sel !== h.id) ev.currentTarget.style.background = 'transparent' }}>
                      <td style={{ ...tdS, fontWeight: 600 }}>{h.name}</td>
                      <td style={{ ...tdS, color: '#64748b' }}>{h.dept}{h.team ? ` · ${h.team}` : ''}</td>
                      <td style={tdS}>{h.rank}</td>
                      <td style={tdS}><Bd color="#475569" bg="#f1f5f9">{h.hire_type}</Bd></td>
                      <td style={tdS}>{h.join_date}</td>
                      <td style={tdS}><DdayBd d={h.dDay} /></td>
                      <td style={tdS}><Bd color={st.c} bg={st.bg}>{h.status}</Bd></td>
                      <td style={tdS}><Prog current={h.done} max={h.total} /></td>
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
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>{s.dept}{s.team ? ` · ${s.team}` : ''} · {s.rank} · {s.hire_type}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div style={{ background: '#f8fafc', borderRadius: 8, padding: 12 }}><div style={{ fontSize: 11, color: '#64748b' }}>입사일</div><div style={{ fontSize: 14, fontWeight: 600 }}>{s.join_date}</div></div>
              <div style={{ background: '#f8fafc', borderRadius: 8, padding: 12 }}><div style={{ fontSize: 11, color: '#64748b' }}>D-Day</div><div style={{ fontSize: 14, fontWeight: 600, color: s.dDay <= 14 ? O : P }}>{s.dDay <= 0 ? `D${s.dDay}` : `D-${s.dDay}`}</div></div>
              <div style={{ background: '#f8fafc', borderRadius: 8, padding: 12 }}><div style={{ fontSize: 11, color: '#64748b' }}>준비율</div><div style={{ fontSize: 14, fontWeight: 600, color: s.pct >= 100 ? G : P }}>{s.pct}%</div></div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>📋 입사 준비 체크리스트</div>
            {CHECK_FIELDS.map(([f, label]) => (
              <Check key={f} done={s[f]} label={label} onToggle={() => toggle(f)} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
