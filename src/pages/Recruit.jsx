import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { P, G, O, Y, B } from '../lib/constants'
import { Bd, KpiRow, crd, thS, tdS, inp, Loading, ErrorBox, EmptyState } from '../components/ui'

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

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error } = await supabase
        .from('recruit_positions')
        .select('*, recruit_candidates(*)')
        .order('open_date', { ascending: false })
      if (cancelled) return
      if (error) { setError(error); return }
      setPositions(data || [])
    }
    load()
    return () => { cancelled = true }
  }, [])

  if (error) return <ErrorBox error={error} />
  if (!positions) return <Loading />

  const filtered = positions.filter((p) => f === 'all' || p.status === f)
  const s = positions.find((p) => p.id === sel)
  const totalCands = positions.reduce((a, p) => a + (p.recruit_candidates || []).length, 0)

  return (
    <div>
      <KpiRow items={[
        { v: positions.length, l: '채용 포지션', c: P },
        { v: positions.filter((p) => p.status === '면접진행').length, l: '면접 진행중', c: O },
        { v: positions.filter((p) => p.status === '최종협의').length, l: '최종 협의', c: '#7c3aed' },
        { v: totalCands, l: '총 지원자', c: B },
      ]} />
      <div style={{ marginBottom: 16 }}>
        <select style={{ ...inp, cursor: 'pointer' }} value={f} onChange={(e) => setF(e.target.value)}>
          <option value="all">전체 상태</option>
          <option value="공고중">공고중</option>
          <option value="서류심사">서류심사</option>
          <option value="면접진행">면접진행</option>
          <option value="최종협의">최종협의</option>
          <option value="마감">마감</option>
        </select>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: s ? '1fr 1fr' : '1fr', gap: 16 }}>
        <div style={crd}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>채용 포지션</div>
          {filtered.length === 0 ? <EmptyState /> : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['포지션', '소속', '유형', '레벨', '지원자', '상태'].map((h) => <th key={h} style={thS}>{h}</th>)}</tr></thead>
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
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
        {s && (
          <div style={crd}>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>{s.position}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>{s.dept}{s.team ? ` · ${s.team}` : ''} · {s.hire_type} · {s.level}</div>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>👤 지원자 ({(s.recruit_candidates || []).length}명)</div>
            {(s.recruit_candidates || []).length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>지원자 없음</div>
            ) : (
              s.recruit_candidates.map((c) => {
                const cx = RESULT_CFG[c.result] || RESULT_CFG['검토중']
                return (
                  <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 4px', borderBottom: '1px solid #f1f5f9' }}>
                    <div><div style={{ fontSize: 12, fontWeight: 600 }}>{c.name}</div><div style={{ fontSize: 11, color: '#94a3b8' }}>{c.stage}</div></div>
                    <Bd color={cx.c} bg={cx.bg}>{c.result}</Bd>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
    </div>
  )
}
