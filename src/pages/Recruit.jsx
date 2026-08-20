import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { P, G, O, Y, B } from '../lib/constants'
import { Bd, KpiRow, crd, thS, tdS, inp, Loading, ErrorBox, EmptyState, Modal, field, label as lbl, btnPrimary, btnGhost, AddButton } from '../components/ui'

const STATUS_CFG = {
  최종협의: { c: '#7c3aed', bg: '#f3e8ff' }, 면접진행: { c: O, bg: '#fff7ed' }, 서류심사: { c: B, bg: '#e0f2fe' }, 공고중: { c: G, bg: '#dcfce7' }, 마감: { c: '#64748b', bg: '#f1f5f9' },
}
const RESULT_CFG = {
  합격대기: { c: G, bg: '#dcfce7' }, 통과: { c: B, bg: '#e0f2fe' }, 진행중: { c: O, bg: '#fff7ed' }, 검토중: { c: Y, bg: '#fef9c3' }, 탈락: { c: '#94a3b8', bg: '#f1f5f9' },
}

export default function Recruit() {
  const [positions, setPositions] = useState(null)
  const [error, setError] = useState(null)
  const [sel, setSel] = useState(null)
  const [f, setF] = useState('all')
  const [showAddPos, setShowAddPos] = useState(false)
  const [showAddCand, setShowAddCand] = useState(false)

  const load = async () => {
    const { data, error } = await supabase
      .from('recruit_positions')
      .select('*, recruit_candidates(*)')
      .order('open_date', { ascending: false })
    if (error) { setError(error); return }
    setPositions(data || [])
  }

  useEffect(() => { load() }, [])

  const removePosition = async (p) => {
    if (!window.confirm(`"${p.position}" 포지션과 지원자 전체를 삭제할까요?`)) return
    const { error } = await supabase.from('recruit_positions').delete().eq('id', p.id)
    if (error) { setError(error); return }
    setPositions(positions.filter((x) => x.id !== p.id))
    if (sel === p.id) setSel(null)
  }

  const removeCandidate = async (c) => {
    if (!window.confirm(`${c.name} 지원자를 삭제할까요?`)) return
    const { error } = await supabase.from('recruit_candidates').delete().eq('id', c.id)
    if (error) { setError(error); return }
    setPositions(positions.map((p) => (p.id === sel ? { ...p, recruit_candidates: p.recruit_candidates.filter((x) => x.id !== c.id) } : p)))
  }

  if (error) return <ErrorBox error={error} />
  if (!positions) return <Loading />

  const filtered = positions.filter((p) => f === 'all' || p.status === f)
  const s = positions.find((p) => p.id === sel)
  const totalCands = positions.reduce((a, p) => a + (p.recruit_candidates || []).length, 0)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <select style={{ ...inp, cursor: 'pointer' }} value={f} onChange={(e) => setF(e.target.value)}>
          <option value="all">전체 상태</option>
          <option value="공고중">공고중</option>
          <option value="서류심사">서류심사</option>
          <option value="면접진행">면접진행</option>
          <option value="최종협의">최종협의</option>
          <option value="마감">마감</option>
        </select>
        <AddButton onClick={() => setShowAddPos(true)}>+ 포지션 추가</AddButton>
      </div>
      <KpiRow items={[
        { v: positions.length, l: '채용 포지션', c: P },
        { v: positions.filter((p) => p.status === '면접진행').length, l: '면접 진행중', c: O },
        { v: positions.filter((p) => p.status === '최종협의').length, l: '최종 협의', c: '#7c3aed' },
        { v: totalCands, l: '총 지원자', c: B },
      ]} />
      <div style={{ display: 'grid', gridTemplateColumns: s ? '1fr 1fr' : '1fr', gap: 16 }}>
        <div style={crd}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>채용 포지션</div>
          {filtered.length === 0 ? <EmptyState /> : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['포지션', '소속', '유형', '레벨', '지원자', '상태', ''].map((h) => <th key={h} style={thS}>{h}</th>)}</tr></thead>
              <tbody>
                {filtered.map((p) => {
                  const st = STATUS_CFG[p.status] || { c: '#64748b', bg: '#f1f5f9' }
                  const cands = p.recruit_candidates || []
                  return (
                    <tr key={p.id} style={{ cursor: 'pointer', background: sel === p.id ? '#FFF5F0' : 'transparent' }}
                      onClick={() => setSel(p.id === sel ? null : p.id)}
                      onMouseEnter={(ev) => { if (sel !== p.id) ev.currentTarget.style.background = '#f8fafc' }}
                      onMouseLeave={(ev) => { if (sel !== p.id) ev.currentTarget.style.background = 'transparent' }}>
                      <td style={{ ...tdS, fontWeight: 600 }}>{p.position}</td>
                      <td style={{ ...tdS, color: '#64748b' }}>{p.dept}</td>
                      <td style={tdS}>{p.hire_type}</td>
                      <td style={tdS}>{p.level}</td>
                      <td style={tdS}><span style={{ fontWeight: 600, color: cands.length ? P : '#94a3b8' }}>{cands.length}명</span></td>
                      <td style={tdS}><Bd color={st.c} bg={st.bg}>{p.status}</Bd></td>
                      <td style={tdS}><button style={{ ...btnGhost, padding: '4px 9px', fontSize: 11 }} onClick={(e) => { e.stopPropagation(); removePosition(p) }}>삭제</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
        {s && (
          <div style={crd}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>{s.position}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>{s.dept}{s.team ? ` · ${s.team}` : ''} · {s.hire_type} · {s.level}</div>
              </div>
              <button style={{ ...btnGhost, padding: '5px 12px', fontSize: 11 }} onClick={() => setShowAddCand(true)}>+ 지원자 추가</button>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>👤 지원자 ({(s.recruit_candidates || []).length}명)</div>
            {(s.recruit_candidates || []).length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>지원자 없음</div>
            ) : (
              s.recruit_candidates.map((c) => {
                const cx = RESULT_CFG[c.result] || RESULT_CFG['검토중']
                return (
                  <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 4px', borderBottom: '1px solid #f1f5f9' }}>
                    <div><div style={{ fontSize: 12, fontWeight: 600 }}>{c.name}</div><div style={{ fontSize: 11, color: '#94a3b8' }}>{c.stage}</div></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Bd color={cx.c} bg={cx.bg}>{c.result}</Bd>
                      <button style={{ ...btnGhost, padding: '3px 8px', fontSize: 10 }} onClick={() => removeCandidate(c)}>삭제</button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
      {showAddPos && <AddPositionModal onClose={() => setShowAddPos(false)} onCreated={() => { setShowAddPos(false); load() }} />}
      {showAddCand && s && <AddCandidateModal position={s} onClose={() => setShowAddCand(false)} onCreated={() => { setShowAddCand(false); load() }} />}
    </div>
  )
}

function AddPositionModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ position: '', dept: '', team: '', hire_type: '경력', level: '', status: '공고중', open_date: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    const { error } = await supabase.from('recruit_positions').insert({ ...form, team: form.team || null })
    setSaving(false)
    if (error) { setError(error.message); return }
    onCreated()
  }

  return (
    <Modal title="채용 포지션 추가" onClose={onClose}>
      <form onSubmit={submit}>
        <label style={lbl}>포지션명</label>
        <input style={field} required value={form.position} onChange={set('position')} />
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}><label style={lbl}>부서</label><input style={field} required value={form.dept} onChange={set('dept')} /></div>
          <div style={{ flex: 1 }}><label style={lbl}>팀</label><input style={field} value={form.team} onChange={set('team')} /></div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={lbl}>채용 유형</label>
            <select style={field} value={form.hire_type} onChange={set('hire_type')}>
              <option value="경력">경력</option><option value="신입">신입</option><option value="신입/경력">신입/경력</option>
            </select>
          </div>
          <div style={{ flex: 1 }}><label style={lbl}>레벨</label><input style={field} value={form.level} onChange={set('level')} placeholder="예: 대리~과장" /></div>
        </div>
        <label style={lbl}>공고 시작일</label>
        <input style={field} type="date" required value={form.open_date} onChange={set('open_date')} />
        <label style={lbl}>상태</label>
        <select style={field} value={form.status} onChange={set('status')}>
          <option value="공고중">공고중</option><option value="서류심사">서류심사</option><option value="면접진행">면접진행</option><option value="최종협의">최종협의</option><option value="마감">마감</option>
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

function AddCandidateModal({ position, onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', stage: '서류심사', result: '검토중' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    const { error } = await supabase.from('recruit_candidates').insert({ ...form, position_id: position.id })
    setSaving(false)
    if (error) { setError(error.message); return }
    onCreated()
  }

  return (
    <Modal title={`지원자 추가 — ${position.position}`} onClose={onClose}>
      <form onSubmit={submit}>
        <label style={lbl}>이름 (예: 김○○)</label>
        <input style={field} required value={form.name} onChange={set('name')} />
        <label style={lbl}>단계</label>
        <input style={field} required value={form.stage} onChange={set('stage')} placeholder="예: 서류심사 / 1차면접 / 처우협의" />
        <label style={lbl}>결과</label>
        <select style={field} value={form.result} onChange={set('result')}>
          <option value="검토중">검토중</option><option value="진행중">진행중</option><option value="통과">통과</option><option value="합격대기">합격대기</option><option value="탈락">탈락</option>
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
