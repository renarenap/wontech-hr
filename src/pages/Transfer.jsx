import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { P, G, O, Y, R, B } from '../lib/constants'
import { Bd, KpiRow, crd, thS, tdS, inp, Loading, ErrorBox, EmptyState } from '../components/ui'

const TYPE_CFG = {
  부서이동: { c: B, bg: '#e0f2fe' }, 승진: { c: G, bg: '#dcfce7' }, 파견: { c: P, bg: '#f3e8ff' }, 직무변경: { c: O, bg: '#fff7ed' },
}
const STATUS_CFG = { 승인완료: { c: G, bg: '#dcfce7' }, 승인대기: { c: Y, bg: '#fef9c3' }, 반려: { c: R, bg: '#fee2e2' } }

export default function Transfer() {
  const [list, setList] = useState(null)
  const [error, setError] = useState(null)
  const [f, setF] = useState('all')

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error } = await supabase.from('transfers').select('*').order('effective_date', { ascending: false })
      if (cancelled) return
      if (error) { setError(error); return }
      setList(data || [])
    }
    load()
    return () => { cancelled = true }
  }, [])

  if (error) return <ErrorBox error={error} />
  if (!list) return <Loading />

  const filtered = list.filter((t) => f === 'all' || t.type === f)

  return (
    <div>
      <KpiRow items={[
        { v: list.length, l: '발령 건수', c: P },
        { v: list.filter((t) => t.type === '승진').length, l: '승진', c: G },
        { v: list.filter((t) => t.type === '부서이동').length, l: '부서이동', c: B },
        { v: list.filter((t) => t.status === '승인대기').length, l: '승인 대기', c: Y },
      ]} />
      <div style={{ marginBottom: 16 }}>
        <select style={{ ...inp, cursor: 'pointer' }} value={f} onChange={(e) => setF(e.target.value)}>
          <option value="all">전체 유형</option>
          <option value="승진">승진</option>
          <option value="부서이동">부서이동</option>
          <option value="파견">파견</option>
          <option value="직무변경">직무변경</option>
        </select>
      </div>
      <div style={crd}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>발령 현황</div>
        {filtered.length === 0 ? <EmptyState /> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['이름', '유형', '변경 전', '→', '변경 후', '직급', '발령일', '결재자', '상태'].map((h) => <th key={h} style={thS}>{h}</th>)}</tr></thead>
            <tbody>
              {filtered.map((t) => {
                const tp = TYPE_CFG[t.type] || TYPE_CFG['부서이동']
                const st = STATUS_CFG[t.status] || STATUS_CFG['승인대기']
                return (
                  <tr key={t.id}
                    onMouseEnter={(ev) => (ev.currentTarget.style.background = '#f8fafc')}
                    onMouseLeave={(ev) => (ev.currentTarget.style.background = 'transparent')}>
                    <td style={{ ...tdS, fontWeight: 600 }}>{t.name}</td>
                    <td style={tdS}><Bd color={tp.c} bg={tp.bg}>{t.type}</Bd></td>
                    <td style={{ ...tdS, color: '#64748b' }}>{t.from_value}</td>
                    <td style={{ ...tdS, fontSize: 16, color: O }}>→</td>
                    <td style={{ ...tdS, fontWeight: 600, color: P }}>{t.to_value}</td>
                    <td style={tdS}>{t.rank}</td>
                    <td style={tdS}>{t.effective_date}</td>
                    <td style={tdS}>{t.approver}</td>
                    <td style={tdS}><Bd color={st.c} bg={st.bg}>{t.status}</Bd></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
