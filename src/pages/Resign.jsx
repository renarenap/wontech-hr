import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { P, O, R, orgPath } from '../lib/constants'
import { Bd, Check, DdayBd, KpiRow, LocationBadges, LocationPicker, Prog, crd, thS, tdS, Loading, ErrorBox, EmptyState, dDayFrom, Modal, field, label as lbl, btnPrimary, btnGhost, AddButton } from '../components/ui'

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

export default function Resign({ hideAdd = false }) {
  const [list, setList] = useState(null)
  const [error, setError] = useState(null)
  const [sel, setSel] = useState(null)
  const [showAdd, setShowAdd] = useState(false)

  const load = async () => {
    // 최종근무일이 한 달 넘게 지난 건은 여기(퇴사 현황)엔 안 보이고 "퇴사(삭제) 이력"에서만 확인 가능
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 30)
    const cutoffStr = cutoff.toISOString().slice(0, 10)
    const { data, error } = await supabase.from('resignations').select('*').gte('last_day', cutoffStr).order('last_day')
    if (error) { setError(error); return }
    setList((data || []).map(withDerived))
  }

  useEffect(() => { load() }, [])

  const toggle = async (field) => {
    const r = list.find((x) => x.id === sel)
    if (!r) return
    const next = !r[field]
    setList(list.map((x) => (x.id === sel ? withDerived({ ...x, [field]: next }) : x)))
    const { error } = await supabase.from('resignations').update({ [field]: next }).eq('id', sel)
    if (error) setError(error)
  }

  const remove = async (r) => {
    if (!window.confirm(`${r.name} 퇴사 항목을 삭제할까요?`)) return
    const { error } = await supabase.from('resignations').delete().eq('id', r.id)
    if (error) { setError(error); return }
    setList(list.filter((x) => x.id !== r.id))
    if (sel === r.id) setSel(null)
  }

  if (error) return <ErrorBox error={error} />
  if (!list) return <Loading />

  const s = list.find((r) => r.id === sel)
  const stCfg = { 진행중: { c: O, bg: '#fff7ed' }, 완료: { c: '#64748b', bg: '#f1f5f9' } }

  return (
    <div>
      {!hideAdd && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <AddButton onClick={() => setShowAdd(true)}>+ 퇴사자 추가</AddButton>
        </div>
      )}
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
              <thead><tr>{['이름', '위치', '소속', '직급', '사유', '퇴사 신청일', '최종 근무일', 'D-Day', '상태', '처리율', ''].map((h) => <th key={h} style={thS}>{h}</th>)}</tr></thead>
              <tbody>
                {list.map((r) => {
                  const st = stCfg[r.status] || stCfg['완료']
                  return (
                    <tr key={r.id} style={{ cursor: 'pointer', background: sel === r.id ? '#FFF5F0' : 'transparent' }}
                      onClick={() => setSel(r.id === sel ? null : r.id)}
                      onMouseEnter={(ev) => { if (sel !== r.id) ev.currentTarget.style.background = '#f8fafc' }}
                      onMouseLeave={(ev) => { if (sel !== r.id) ev.currentTarget.style.background = 'transparent' }}>
                      <td style={{ ...tdS, fontWeight: 600 }}>{r.name}</td>
                      <td style={tdS}><LocationBadges locations={r.locations} /></td>
                      <td style={{ ...tdS, color: '#64748b' }}>{orgPath(r)}</td>
                      <td style={tdS}>{r.rank}</td>
                      <td style={tdS}><Bd color="#475569" bg="#f1f5f9">{r.reason}</Bd></td>
                      <td style={tdS}>{r.submit_date}</td>
                      <td style={tdS}>{r.last_day}</td>
                      <td style={tdS}><DdayBd d={r.dDay} /></td>
                      <td style={tdS}><Bd color={st.c} bg={st.bg}>{r.status}</Bd></td>
                      <td style={tdS}><Prog current={r.done} max={r.total} /></td>
                      <td style={tdS}><button style={{ ...btnGhost, padding: '4px 9px', fontSize: 11 }} onClick={(e) => { e.stopPropagation(); remove(r) }}>삭제</button></td>
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
              <div style={{ fontSize: 12, color: '#64748b' }}>{orgPath(s)} · {s.rank}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div style={{ background: '#f8fafc', borderRadius: 8, padding: 12 }}><div style={{ fontSize: 11, color: '#64748b' }}>퇴사 사유</div><div style={{ fontSize: 14, fontWeight: 600 }}>{s.reason}</div></div>
              <div style={{ background: '#f8fafc', borderRadius: 8, padding: 12 }}><div style={{ fontSize: 11, color: '#64748b' }}>최종 근무일</div><div style={{ fontSize: 14, fontWeight: 600 }}>{s.last_day}</div></div>
              <div style={{ background: '#f8fafc', borderRadius: 8, padding: 12 }}><div style={{ fontSize: 11, color: '#64748b' }}>D-Day</div><div style={{ fontSize: 14, fontWeight: 600, color: s.dDay <= 0 ? '#64748b' : R }}>{s.dDay <= 0 ? '퇴사 완료' : `D-${s.dDay}`}</div></div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>📋 퇴사 처리 체크리스트</div>
            {CHECK_FIELDS.map(([f, text]) => (
              <Check key={f} done={s[f]} label={text} onToggle={() => toggle(f)} />
            ))}
          </div>
        )}
      </div>
      {showAdd && <AddResignModal onClose={() => setShowAdd(false)} onCreated={() => { setShowAdd(false); load() }} />}
    </div>
  )
}

function AddResignModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', division: '', dept: '', team: '', locations: [], rank: '', reason: '개인사유', submit_date: '', last_day: '', status: '진행중' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    const { error } = await supabase.from('resignations').insert({ ...form, division: form.division || null, team: form.team || null })
    setSaving(false)
    if (error) { setError(error.message); return }
    onCreated()
  }

  return (
    <Modal title="퇴사자 추가" onClose={onClose}>
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
            <label style={lbl}>사유</label>
            <select style={field} value={form.reason} onChange={set('reason')}>
              <option value="개인사유">개인사유</option><option value="이직">이직</option><option value="계약만료">계약만료</option><option value="기타">기타</option>
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}><label style={lbl}>퇴사 신청일</label><input style={field} type="date" required value={form.submit_date} onChange={set('submit_date')} /></div>
          <div style={{ flex: 1 }}><label style={lbl}>최종 근무일</label><input style={field} type="date" required value={form.last_day} onChange={set('last_day')} /></div>
        </div>
        <label style={lbl}>상태</label>
        <select style={field} value={form.status} onChange={set('status')}>
          <option value="진행중">진행중</option><option value="완료">완료</option>
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
