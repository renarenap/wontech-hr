import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { OFFICE_RANKS, RESEARCH_RANKS, G } from '../lib/constants'
import { crd, thS, tdS, inp, Loading, ErrorBox, btnPrimary } from '../components/ui'

const ORDER = [...OFFICE_RANKS, ...RESEARCH_RANKS]

export default function CriteriaSettings() {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(null) // rank being saved
  const [notice, setNotice] = useState('')

  const load = async () => {
    setError(null)
    const { data, error: err } = await supabase.from('rank_criteria').select('*')
    if (err) { setError(err); return }
    const byRank = Object.fromEntries((data || []).map((r) => [r.rank, r]))
    setRows(ORDER.map((rank) => byRank[rank] || { rank, req_tenure: 0, threshold: 0, backfill_rate: 0 }))
  }

  useEffect(() => { load() }, [])

  const update = (rank, field, value) => {
    setRows(rows.map((r) => (r.rank === rank ? { ...r, [field]: value } : r)))
  }

  const save = async (row) => {
    setSaving(row.rank)
    setNotice('')
    const { error: err } = await supabase.from('rank_criteria').upsert({
      rank: row.rank,
      req_tenure: Number(row.req_tenure) || 0,
      threshold: Number(row.threshold) || 0,
      backfill_rate: Number(row.backfill_rate) || 0,
    })
    setSaving(null)
    if (err) { setError(err); return }
    setNotice(`${row.rank} 기준값이 저장됐어요.`)
  }

  if (error) return <ErrorBox error={error} />
  if (!rows) return <Loading />

  return (
    <div>
      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 16, lineHeight: 1.6 }}>
        직급별 체류연한·진급포인트·인정포인트 기준점수(연차당)를 여기서 관리합니다. 코드에 하드코딩되어 있지 않고,
        이 화면에서 바꾸면 승진포인트 계산에 바로 반영돼요. 부장·수석연구원은 승진 기준을 정의하지 않기로 해서
        모두 0으로 비워두면 "해당없음"으로 표시됩니다.
      </div>
      <div style={{ ...crd, background: '#f8fafc' }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>ⓘ 아래 "인정포인트 기준" 값이 쓰이는 곳</div>
        <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.9 }}>
          평가 없이 포인트가 채워지는 경우가 3가지 있는데, 화면엔 전부 "경력인정P"로 합쳐서 보여요 — 헷갈리지 않게 정리해둘게요.<br />
          • <b>경력직 인정포인트</b> — 경력직 입사 등 평가 이력이 아예 없는 사람. <b>연차 × 아래 기준점수</b>를 통으로 인정 (직원 CSV의 "경력직인정포인트 적용"이 TRUE인 사람)<br />
          • <b>평가 인정포인트</b> — 재직 중인데 평가 이력에 공백이 있는 사람(위 TRUE가 아닌 나머지 전원). <b>공백 반기 수 × 아래 기준점수 ÷ 2</b>로 계산<br />
          • <b>휴직 포인트</b> — 휴직 기간이 있는 사람. <b>휴직 개월수 × 0.5P(1년 기준 6P)</b>로 고정 계산돼서, 아래 기준점수(직급별)와는 <u>무관</u>해요. 직원 CSV의 "휴직개월수"(또는 휴직시작·종료일)로 입력.
        </div>
      </div>
      {notice && <div style={{ ...crd, borderColor: '#bbf7d0', background: '#f0fdf4', color: '#166534', fontSize: 12 }}>{notice}</div>}
      <div style={crd}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['직급', '체류연한(년)', '진급포인트(P)', '인정포인트 기준(연차당, P)', ''].map((h) => <th key={h} style={thS}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.rank}>
                <td style={{ ...tdS, fontWeight: 600 }}>{r.rank}</td>
                <td style={tdS}>
                  <input style={{ ...inp, width: 80 }} type="number" min="0" value={r.req_tenure} onChange={(e) => update(r.rank, 'req_tenure', e.target.value)} />
                </td>
                <td style={tdS}>
                  <input style={{ ...inp, width: 80 }} type="number" min="0" value={r.threshold} onChange={(e) => update(r.rank, 'threshold', e.target.value)} />
                </td>
                <td style={tdS}>
                  <input style={{ ...inp, width: 100 }} type="number" min="0" step="0.5" value={r.backfill_rate} onChange={(e) => update(r.rank, 'backfill_rate', e.target.value)} />
                </td>
                <td style={tdS}>
                  <button style={{ ...btnPrimary, background: saving === r.rank ? '#94a3b8' : G, padding: '6px 14px' }} disabled={saving === r.rank} onClick={() => save(r)}>
                    {saving === r.rank ? '저장 중…' : '저장'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 11, color: '#94a3b8' }}>
        * 체류연한·진급포인트를 0/0으로 두면 해당 직급은 승진포인트 화면에서 "해당없음"으로 표시되고 승진 가능 여부 계산에서 제외됩니다.
      </div>
    </div>
  )
}
