import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { P, G, O, Y, R, B, DEPT_OPTIONS, orgPath } from '../lib/constants'
import { Bd, KpiRow, LocationBadges, crd, thS, tdS, inp, Loading, ErrorBox, EmptyState, Modal, field, label as lbl, btnPrimary, btnGhost, AddButton } from '../components/ui'

const TYPE_CFG = {
  부서이동: { c: B, bg: '#e0f2fe' }, 승진: { c: G, bg: '#dcfce7' }, 파견: { c: P, bg: '#f3e8ff' }, 직무변경: { c: O, bg: '#fff7ed' },
  휴직: { c: Y, bg: '#fef9c3' },
}
const STATUS_CFG = { 승인완료: { c: G, bg: '#dcfce7' }, 승인대기: { c: Y, bg: '#fef9c3' }, 반려: { c: R, bg: '#fee2e2' } }

export default function Transfer() {
  const [list, setList] = useState(null)
  const [error, setError] = useState(null)
  const [f, setF] = useState('all')
  const [showAdd, setShowAdd] = useState(false)

  const load = async () => {
    const { data, error } = await supabase.from('transfers').select('*').order('effective_date', { ascending: false })
    if (error) { setError(error); return }
    setList(data || [])
  }

  useEffect(() => { load() }, [])

  const remove = async (t) => {
    if (!window.confirm(`${t.name} 발령 항목을 삭제할까요?`)) return
    const { error } = await supabase.from('transfers').delete().eq('id', t.id)
    if (error) { setError(error); return }
    setList(list.filter((x) => x.id !== t.id))
  }

  if (error) return <ErrorBox error={error} />
  if (!list) return <Loading />

  const filtered = list.filter((t) => f === 'all' || t.type === f)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <select style={{ ...inp, cursor: 'pointer' }} value={f} onChange={(e) => setF(e.target.value)}>
          <option value="all">전체 유형</option>
          <option value="승진">승진</option>
          <option value="부서이동">부서이동</option>
          <option value="파견">파견</option>
          <option value="직무변경">직무변경</option>
          <option value="휴직">휴직</option>
        </select>
        <AddButton onClick={() => setShowAdd(true)}>+ 발령 추가</AddButton>
      </div>
      <KpiRow items={[
        { v: list.length, l: '발령 건수', c: P },
        { v: list.filter((t) => t.type === '승진').length, l: '승진', c: G },
        { v: list.filter((t) => t.type === '부서이동').length, l: '부서이동', c: B },
        { v: list.filter((t) => t.status === '승인대기').length, l: '승인 대기', c: Y },
      ]} />
      <div style={crd}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>발령 현황</div>
        {filtered.length === 0 ? <EmptyState /> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['이름', '유형', '변경 전', '→', '변경 후', '직급', '발령일', '상태', ''].map((h) => <th key={h} style={thS}>{h}</th>)}</tr></thead>
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
                    <td style={tdS}><Bd color={st.c} bg={st.bg}>{t.status}</Bd></td>
                    <td style={tdS}><button style={{ ...btnGhost, padding: '4px 9px', fontSize: 11 }} onClick={() => remove(t)}>삭제</button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
      {showAdd && <AddTransferModal onClose={() => setShowAdd(false)} onCreated={() => { setShowAdd(false); load() }} />}
    </div>
  )
}

// 휴직시작일·종료일이 둘 다 있으면 그 사이 개월수를 계산(EmployeeList.jsx의 동일 함수와 같은 규칙)
function monthsBetween(startStr, endStr) {
  const s = startStr && startStr.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const e = endStr && endStr.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!s || !e) return null
  const sy = Number(s[1]), sm = Number(s[2]), sd = Number(s[3])
  const ey = Number(e[1]), em = Number(e[2]), ed = Number(e[3])
  let months = (ey - sy) * 12 + (em - sm)
  if (ed < sd) months -= 1
  return Math.max(0, months)
}

function AddTransferModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    name: '', type: '부서이동', from_value: '', to_value: '', rank: '', effective_date: '', status: '승인대기',
    leave_start: '', leave_end: '',
  })
  const [employees, setEmployees] = useState([])
  const [picked, setPicked] = useState(null)
  const [toDeptSel, setToDeptSel] = useState('') // 부서이동일 때 "변경 후" 선택값 — '' | '__custom__' | 실제 팀명
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  useEffect(() => {
    supabase.from('employees').select('id, name, division, dept, team, locations, rank').order('name').then(({ data }) => setEmployees(data || []))
  }, [])

  // 조직도 기준 팀 목록 + 실제 employees 데이터에 있는 팀을 합쳐서 "변경 후" 선택지로 씀
  const deptOptions = useMemo(() => {
    const live = employees.map((e) => e.dept).filter(Boolean)
    return [...new Set([...DEPT_OPTIONS, ...live])].sort((a, b) => a.localeCompare(b, 'ko'))
  }, [employees])

  const matches = useMemo(() => {
    if (picked || !form.name.trim()) return []
    const q = form.name.trim().toLowerCase()
    return employees.filter((e) => e.name.toLowerCase().includes(q)).slice(0, 8)
  }, [employees, form.name, picked])

  const pick = (e) => {
    setPicked(e)
    setForm((f) => ({
      ...f, name: e.name, rank: f.rank || e.rank,
      from_value: f.from_value || orgPath(e),
    }))
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.type === '휴직' && !form.leave_start) { setError('휴직시작일을 입력해주세요.'); return }
    setSaving(true)
    // 휴직 유형은 변경전/후 대신 휴직시작~종료일을 그대로 그 두 칸에 담음(스키마 변경 없이 재사용)
    const payload = form.type === '휴직'
      ? { ...form, from_value: form.leave_start, to_value: form.leave_end || '(진행중)' }
      : form
    const { leave_start, leave_end, ...rest } = payload
    const { error } = await supabase.from('transfers').insert({ ...rest, employee_id: picked?.id || null })
    if (error) { setSaving(false); setError(error.message); return }

    // 휴직 발령이고 명단에 있는 직원이면, 발령 기록만 남기는 게 아니라 실제 직원 데이터(휴직 시작·종료일 +
    // 계산 가능하면 휴직연차)에도 반영해서 포인트/체류연한에 바로 잡히게 함
    if (form.type === '휴직' && picked?.id) {
      const months = monthsBetween(form.leave_start, form.leave_end)
      const empPatch = { leave_start_date: form.leave_start, leave_end_date: form.leave_end || null }
      if (months !== null) empPatch.leave_years = months / 12
      const { error: empErr } = await supabase.from('employees').update(empPatch).eq('id', picked.id)
      if (empErr) { setSaving(false); setError(`발령은 등록됐지만 직원 정보 반영에 실패했어요: ${empErr.message}`); return }
    }

    setSaving(false)
    onCreated()
  }

  return (
    <Modal title="발령 추가" onClose={onClose}>
      <form onSubmit={submit}>
        <label style={lbl}>이름</label>
        <div style={{ position: 'relative' }}>
          <input
            style={field} required value={form.name} placeholder="이름을 입력해서 검색"
            onChange={(e) => { setForm({ ...form, name: e.target.value }); setPicked(null) }}
          />
          {matches.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, marginTop: -6, zIndex: 10,
              background: '#fff', border: '1px solid var(--border)', borderRadius: 8,
              boxShadow: '0 8px 20px rgba(0,0,0,.1)', maxHeight: 200, overflow: 'auto',
            }}>
              {matches.map((e) => (
                <div
                  key={e.id} onClick={() => pick(e)}
                  style={{ padding: '9px 12px', fontSize: 12, cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}
                  onMouseEnter={(ev) => { ev.currentTarget.style.background = '#f8fafc' }}
                  onMouseLeave={(ev) => { ev.currentTarget.style.background = 'transparent' }}
                >
                  <span style={{ fontWeight: 600 }}>{e.name}</span>
                  <span style={{ color: '#94a3b8', marginLeft: 8 }}>{orgPath(e)} · {e.rank}</span>
                  <span style={{ marginLeft: 8 }}><LocationBadges locations={e.locations} /></span>
                </div>
              ))}
            </div>
          )}
        </div>
        {picked ? (
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 10 }}>✅ {picked.name}님으로 선택됨 (승진포인트 데이터와 연결돼요)</div>
        ) : form.name.trim() && (
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 10 }}>목록에 없는 이름이면 그냥 텍스트로만 저장돼요.</div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={lbl}>유형</label>
            <select style={field} value={form.type} onChange={set('type')}>
              <option value="부서이동">부서이동</option><option value="승진">승진</option><option value="파견">파견</option><option value="직무변경">직무변경</option><option value="휴직">휴직</option>
            </select>
          </div>
          <div style={{ flex: 1 }}><label style={lbl}>직급</label><input style={field} value={form.rank} onChange={set('rank')} /></div>
        </div>
        {form.type === '휴직' ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}><label style={lbl}>휴직시작일</label><input style={field} type="date" required value={form.leave_start} onChange={set('leave_start')} /></div>
            <div style={{ flex: 1 }}><label style={lbl}>휴직종료일 (미정이면 비워두세요)</label><input style={field} type="date" value={form.leave_end} onChange={set('leave_end')} /></div>
          </div>
        ) : (
          <>
            <label style={lbl}>변경 전</label>
            <input style={field} required value={form.from_value} onChange={set('from_value')} placeholder="예: 글로벌영업팀 · 지역영업파트" />
            <label style={lbl}>변경 후</label>
            {form.type === '부서이동' ? (
              <>
                <select
                  style={field} required
                  value={toDeptSel || (deptOptions.includes(form.to_value) ? form.to_value : (form.to_value ? '__custom__' : ''))}
                  onChange={(e) => {
                    const v = e.target.value
                    setToDeptSel(v)
                    setForm({ ...form, to_value: v === '__custom__' ? '' : v })
                  }}
                >
                  <option value="" disabled>팀을 선택하세요</option>
                  {deptOptions.map((d) => <option key={d} value={d}>{d}</option>)}
                  <option value="__custom__">+ 새 팀 직접 입력</option>
                </select>
                {(toDeptSel === '__custom__' || (!toDeptSel && form.to_value && !deptOptions.includes(form.to_value))) && (
                  <input style={field} required placeholder="새 팀명" value={form.to_value} onChange={set('to_value')} />
                )}
              </>
            ) : (
              <input style={field} required value={form.to_value} onChange={set('to_value')} placeholder="예: B2C사업부 · B2C사업팀" />
            )}
          </>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}><label style={lbl}>발령일</label><input style={field} type="date" required value={form.effective_date} onChange={set('effective_date')} /></div>
        </div>
        <label style={lbl}>상태</label>
        <select style={field} value={form.status} onChange={set('status')}>
          <option value="승인대기">승인대기</option><option value="승인완료">승인완료</option><option value="반려">반려</option>
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
