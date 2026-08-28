import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { P, G, O, B, Y, orgPath } from '../lib/constants'
import { Bd, Check, DdayBd, KpiRow, LocationBadges, LocationPicker, Prog, crd, thS, tdS, Loading, ErrorBox, EmptyState, dDayFrom, Modal, field, label as lbl, btnPrimary, btnGhost, AddButton } from '../components/ui'

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

export default function Hire({ hideAdd = false }) {
  const [hires, setHires] = useState(null)
  const [error, setError] = useState(null)
  const [sel, setSel] = useState(null)
  const [showAdd, setShowAdd] = useState(false)

  const load = async () => {
    const { data, error } = await supabase.from('hires').select('*').order('join_date')
    if (error) { setError(error); return }
    setHires((data || []).map(withDerived))
  }

  useEffect(() => { load() }, [])

  const toggle = async (field) => {
    const h = hires.find((x) => x.id === sel)
    if (!h) return
    const next = !h[field]
    setHires(hires.map((x) => (x.id === sel ? withDerived({ ...x, [field]: next }) : x)))
    const { error } = await supabase.from('hires').update({ [field]: next }).eq('id', sel)
    if (error) setError(error)
  }

  const remove = async (h) => {
    if (!window.confirm(`${h.name} 입사 항목을 삭제할까요?`)) return
    const { error } = await supabase.from('hires').delete().eq('id', h.id)
    if (error) { setError(error); return }
    setHires(hires.filter((x) => x.id !== h.id))
    if (sel === h.id) setSel(null)
  }

  if (error) return <ErrorBox error={error} />
  if (!hires) return <Loading />

  const s = hires.find((h) => h.id === sel)
  const stCfg = { 입사확정: { c: G, bg: '#dcfce7' }, 처우협의중: { c: Y, bg: '#fef9c3' } }

  return (
    <div>
      {!hideAdd && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <AddButton onClick={() => setShowAdd(true)}>+ 입사자 추가</AddButton>
        </div>
      )}
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
              <thead><tr>{['이름', '위치', '소속', '직급', '채용유형', '입사일', 'D-Day', '상태', '준비율', ''].map((h) => <th key={h} style={thS}>{h}</th>)}</tr></thead>
              <tbody>
                {hires.map((h) => {
                  const st = stCfg[h.status] || { c: '#64748b', bg: '#f1f5f9' }
                  return (
                    <tr key={h.id} style={{ cursor: 'pointer', background: sel === h.id ? '#FFF5F0' : 'transparent' }}
                      onClick={() => setSel(h.id === sel ? null : h.id)}
                      onMouseEnter={(ev) => { if (sel !== h.id) ev.currentTarget.style.background = '#f8fafc' }}
                      onMouseLeave={(ev) => { if (sel !== h.id) ev.currentTarget.style.background = 'transparent' }}>
                      <td style={{ ...tdS, fontWeight: 600 }}>{h.name}</td>
                      <td style={tdS}><LocationBadges locations={h.locations} /></td>
                      <td style={{ ...tdS, color: '#64748b' }}>{orgPath(h)}</td>
                      <td style={tdS}>{h.rank}</td>
                      <td style={tdS}><Bd color="#475569" bg="#f1f5f9">{h.hire_type}</Bd></td>
                      <td style={tdS}>{h.join_date}</td>
                      <td style={tdS}><DdayBd d={h.dDay} /></td>
                      <td style={tdS}><Bd color={st.c} bg={st.bg}>{h.status}</Bd></td>
                      <td style={tdS}><Prog current={h.done} max={h.total} /></td>
                      <td style={tdS}><button style={{ ...btnGhost, padding: '4px 9px', fontSize: 11 }} onClick={(e) => { e.stopPropagation(); remove(h) }}>삭제</button></td>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <LocationBadges locations={s.locations} />
              <div style={{ fontSize: 12, color: '#64748b' }}>{orgPath(s)} · {s.rank} · {s.hire_type}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div style={{ background: '#f8fafc', borderRadius: 8, padding: 12 }}><div style={{ fontSize: 11, color: '#64748b' }}>입사일</div><div style={{ fontSize: 14, fontWeight: 600 }}>{s.join_date}</div></div>
              <div style={{ background: '#f8fafc', borderRadius: 8, padding: 12 }}><div style={{ fontSize: 11, color: '#64748b' }}>D-Day</div><div style={{ fontSize: 14, fontWeight: 600, color: s.dDay <= 14 ? O : P }}>{s.dDay <= 0 ? `D${s.dDay}` : `D-${s.dDay}`}</div></div>
              <div style={{ background: '#f8fafc', borderRadius: 8, padding: 12 }}><div style={{ fontSize: 11, color: '#64748b' }}>준비율</div><div style={{ fontSize: 14, fontWeight: 600, color: s.pct >= 100 ? G : P }}>{s.pct}%</div></div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>📋 입사 준비 체크리스트</div>
            {CHECK_FIELDS.map(([f, text]) => (
              <Check key={f} done={s[f]} label={text} onToggle={() => toggle(f)} />
            ))}
          </div>
        )}
      </div>
      {showAdd && <AddHireModal onClose={() => setShowAdd(false)} onCreated={() => { setShowAdd(false); load() }} />}
    </div>
  )
}

function AddHireModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', division: '', dept: '', team: '', locations: [], rank: '', hire_type: '경력', join_date: '', status: '처우협의중' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    const { error } = await supabase.from('hires').insert({ ...form, division: form.division || null, team: form.team || null })
    setSaving(false)
    if (error) { setError(error.message); return }
    onCreated()
  }

  return (
    <Modal title="입사 예정자 추가" onClose={onClose}>
      <form onSubmit={submit}>
        <label style={lbl}>이름</label>
        <input style={field} required value={form.name} onChange={set('name')} />
        <label style={lbl}>위치</label>
        <LocationPicker value={form.locations} onChange={(v) => setForm({ ...form, locations: v })} />
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}><label style={lbl}>실</label><input style={field} value={form.division} onChange={set('division')} /></div>
          <div style={{ flex: 1 }}><label style={lbl}>팀</label><input style={field} required value={form.dept} onChange={set('dept')} /></div>
          <div style={{ flex: 1 }}><label style={lbl}>파트</label><input style={field} value={form.team} onChange={set('team')} /></div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}><label style={lbl}>직급</label><input style={field} value={form.rank} onChange={set('rank')} /></div>
          <div style={{ flex: 1 }}>
            <label style={lbl}>채용유형</label>
            <select style={field} value={form.hire_type} onChange={set('hire_type')}>
              <option value="경력">경력</option><option value="신입">신입</option>
            </select>
          </div>
        </div>
        <label style={lbl}>입사 예정일</label>
        <input style={field} type="date" required value={form.join_date} onChange={set('join_date')} />
        <label style={lbl}>상태</label>
        <select style={field} value={form.status} onChange={set('status')}>
          <option value="처우협의중">처우협의중</option><option value="입사확정">입사확정</option>
        </select>
        {error && <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 10 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <button type="button" style={btnGhost} onClick={onClose}>취소</button>
          <button type="submit" style={btnPrimary} disabled={saving}>{saving ? '저장 중…' : '추가'}</button>
        </div>
      </form>
    </Modal>
  )
}
