import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { P, G, O, Y, R, B, DEPT_OPTIONS, ORG_LEVEL_LABEL, ORG_HEAD_ROLES, orgPath, concurrentPostsOf, postLabel } from '../lib/constants'
import { Bd, KpiRow, LocationBadges, crd, thS, tdS, inp, Loading, ErrorBox, EmptyState, Modal, field, label as lbl, btnPrimary, btnGhost, AddButton, CascadeSelect } from '../components/ui'

const TYPE_CFG = {
  부서이동: { c: B, bg: '#e0f2fe' }, 승진: { c: G, bg: '#dcfce7' }, 파견: { c: P, bg: '#f3e8ff' }, 직무변경: { c: O, bg: '#fff7ed' },
  휴직: { c: Y, bg: '#fef9c3' }, 직책변경: { c: '#0d9488', bg: '#ccfbf1' }, 겸직: { c: '#4f46e5', bg: '#e0e7ff' },
  겸직해제: { c: '#64748b', bg: '#f1f5f9' }, 근무지변경: { c: '#b45309', bg: '#fef3c7' },
}
const TYPES = Object.keys(TYPE_CFG)
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
          {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
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
  // 부서이동일 때 "변경 후" 소속 — 부문/본부/팀 각각 '' | '__custom__' | 기존 값 (직접 입력값은 custom에)
  const [to, setTo] = useState({ division: '', dept: '', team: '' })
  const [toCustom, setToCustom] = useState({ division: '', dept: '', team: '' })
  const [applyOrg, setApplyOrg] = useState(true)
  const [postRole, setPostRole] = useState('') // 겸직 발령일 때 겸직 직책
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  useEffect(() => {
    // concurrent_posts는 마이그레이션 전엔 컬럼이 없을 수 있어서 '*'로 가져옴
    supabase.from('employees').select('*').order('name').then(({ data }) => setEmployees(data || []))
  }, [])

  const toVal = (k) => (to[k] === '__custom__' ? toCustom[k].trim() : to[k]) || null
  const toOrg = { division: toVal('division'), dept: toVal('dept'), team: toVal('team') }

  // "변경 후" 선택지 — 실제 employees 데이터의 부문/본부/팀 조합(+ 조직도 기준 본부 목록).
  // 상위 단계를 고르면 그 밑에 실제로 있는 것만 보여주고, 없으면 전체 목록
  const orgOptions = useMemo(() => {
    const uniq = (arr) => [...new Set(arr.filter(Boolean).map((v) => v.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko'))
    const under = (k, filters) => uniq(employees.filter((e) => Object.entries(filters).every(([fk, fv]) => !fv || e[fk]?.trim() === fv)).map((e) => e[k]))
    const depts = toOrg.division ? under('dept', { division: toOrg.division }) : []
    const teams = toOrg.dept ? under('team', { dept: toOrg.dept }) : toOrg.division ? under('team', { division: toOrg.division }) : []
    return {
      division: uniq(employees.map((e) => e.division)),
      dept: depts.length ? depts : uniq([...DEPT_OPTIONS, ...employees.map((e) => e.dept)]),
      team: teams.length ? teams : uniq(employees.map((e) => e.team)),
    }
  }, [employees, toOrg.division, toOrg.dept])

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
    // 변경 후 소속은 현재 소속으로 채워두고, 바뀌는 칸만 고르면 되게(겸직은 빈 칸에서 새로 고름)
    if (form.type === '겸직') { setTo({ division: '', dept: '', team: '' }); setToCustom({ division: '', dept: '', team: '' }); return }
    setTo({ division: e.division?.trim() || '', dept: e.dept?.trim() || '', team: e.team?.trim() || '' })
    setToCustom({ division: '', dept: '', team: '' })
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.type === '휴직' && !form.leave_start) { setError('휴직시작일을 입력해주세요.'); return }
    const isMove = form.type === '부서이동'
    const isPost = form.type === '겸직'
    if ((isMove || isPost) && !orgPath(toOrg)) { setError(`변경 후 ${ORG_LEVEL_LABEL.division}·${ORG_LEVEL_LABEL.dept}·${ORG_LEVEL_LABEL.team} 중 최소 하나는 선택하거나 입력해주세요.`); return }
    setSaving(true)
    // 휴직 유형은 변경전/후 대신 휴직시작~종료일을 그대로 그 두 칸에 담음(스키마 변경 없이 재사용)
    // 부서이동은 "변경 후"에 부문 · 본부 · 팀을 이어 붙여 저장
    const payload = form.type === '휴직'
      ? { ...form, from_value: form.leave_start, to_value: form.leave_end || '(진행중)' }
      : isMove ? { ...form, to_value: orgPath(toOrg) }
      : isPost ? { ...form, from_value: orgPath(picked || {}) || form.from_value || '—', to_value: postLabel({ ...toOrg, role: postRole }) } : form
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

    // 부서이동 발령이고 명단에 있는 직원이면 실제 소속(부문/본부/팀)도 바로 바꿈 — 반려 건은 제외
    if (isMove && picked?.id && applyOrg && form.status !== '반려') {
      const { error: empErr } = await supabase.from('employees').update(toOrg).eq('id', picked.id)
      if (empErr) { setSaving(false); setError(`발령은 등록됐지만 소속 변경에 실패했어요: ${empErr.message}`); return }
    }

    // 겸직 발령이면 그 직원의 겸직 목록에도 추가 — 반려 건은 제외
    if (isPost && picked?.id && applyOrg && form.status !== '반려') {
      const post = { ...toOrg, role: postRole.trim() || null }
      const { error: empErr } = await supabase.from('employees')
        .update({ concurrent_posts: [...concurrentPostsOf(picked), post] }).eq('id', picked.id)
      if (empErr) {
        setSaving(false)
        setError(/concurrent_posts/.test(empErr.message)
          ? '발령은 등록됐지만 겸직 칸이 아직 DB에 없어요 — supabase/migrations/2026-10-20_concurrent_posts.sql 을 먼저 실행해주세요.'
          : `발령은 등록됐지만 겸직 반영에 실패했어요: ${empErr.message}`)
        return
      }
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
            <select
              style={field} value={form.type}
              onChange={(e) => {
                const type = e.target.value
                setForm({ ...form, type })
                // 겸직 ↔ 부서이동 전환 시 "변경 후" 소속 기본값을 맞춤(겸직은 빈 칸, 부서이동은 현재 소속)
                if (type === '겸직') setTo({ division: '', dept: '', team: '' })
                else if (picked) setTo({ division: picked.division?.trim() || '', dept: picked.dept?.trim() || '', team: picked.team?.trim() || '' })
              }}
            >
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
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
            {form.type === '겸직' ? (
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>
                본 소속({picked ? orgPath(picked) || '—' : '직원 선택'})은 그대로 두고, 아래 소속을 겸직으로 추가해요.
              </div>
            ) : (
              <>
                <label style={lbl}>변경 전</label>
                <input style={field} required value={form.from_value} onChange={set('from_value')} placeholder="예: 글로벌영업팀 · 지역영업파트" />
              </>
            )}
            <label style={lbl}>{form.type === '겸직' ? '겸직 소속' : '변경 후'}</label>
            {form.type === '부서이동' || form.type === '겸직' ? (
              <>
                <div style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 12px 2px', marginBottom: 10 }}>
                  {['division', 'dept', 'team'].map((k) => (
                    <CascadeSelect
                      key={k} label={ORG_LEVEL_LABEL[k]} value={to[k]}
                      onChange={(v) => {
                        // 상위 단계를 바꾸면 하위 선택은 비움(다른 부문의 본부가 남아 있지 않게)
                        const lower = k === 'division' ? { dept: '', team: '' } : k === 'dept' ? { team: '' } : {}
                        setTo((t) => ({ ...t, [k]: v, ...lower }))
                      }}
                      customValue={toCustom[k]} onCustomChange={(v) => setToCustom((c) => ({ ...c, [k]: v }))}
                      options={orgOptions[k]}
                    />
                  ))}
                  {form.type === '겸직' && (
                    <>
                      <label style={lbl}>겸직 직책</label>
                      <input style={field} list="transfer-head-roles" value={postRole} onChange={(e) => setPostRole(e.target.value)} placeholder="예: 팀장" />
                      <datalist id="transfer-head-roles">{ORG_HEAD_ROLES.map((r) => <option key={r} value={r} />)}</datalist>
                    </>
                  )}
                </div>
                {picked ? (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, marginBottom: 10, cursor: 'pointer' }}>
                    <input type="checkbox" checked={applyOrg} onChange={(e) => setApplyOrg(e.target.checked)} />
                    {form.type === '겸직'
                      ? <>{picked.name}님의 겸직에 <b style={{ color: P }}>{postLabel({ ...toOrg, role: postRole })}</b> 바로 추가</>
                      : <>{picked.name}님의 소속을 <b style={{ color: P }}>{orgPath(toOrg) || '—'}</b>(으)로 바로 변경</>}
                  </label>
                ) : (
                  <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 10 }}>목록에서 직원을 선택해야 {form.type === '겸직' ? '겸직이' : '소속이'} 자동으로 {form.type === '겸직' ? '추가돼요' : '바뀌어요'}.</div>
                )}
                {picked && applyOrg && form.status === '반려' && (
                  <div style={{ fontSize: 11, color: '#b45309', marginBottom: 10 }}>반려 상태로 등록하면 소속은 바뀌지 않아요.</div>
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
