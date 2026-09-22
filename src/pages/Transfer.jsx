import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { P, G, O, Y, R, B, DEPT_OPTIONS, ORG_LEVEL_LABEL, OFFICE_RANKS, RESEARCH_RANKS, EXEC_RANKS, baseRank, orgPath } from '../lib/constants'
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

// 발령 유형별로 직급 선택지를 좁혀줌 — 직군을 모르면(직원 미선택) 사무+연구 전부 보여주고, 언제나 임원 직급까지 포함
const RANKS_BY_TRACK = { 사무: OFFICE_RANKS, 사무외국어필수: OFFICE_RANKS, 연구: RESEARCH_RANKS }

function AddTransferModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    name: '', type: '부서이동', from_value: '', to_value: '', rank: '', effective_date: '', status: '승인대기',
    leave_start: '', leave_end: '',
  })
  const [employees, setEmployees] = useState([])
  const [picked, setPicked] = useState(null)
  // 부서이동 "변경 후"는 부문 → 본부 → 팀 3단계로 내려가며 고름 — 각각 '' | '__custom__' | 실제 값
  const [toDiv, setToDiv] = useState('')
  const [toDivCustom, setToDivCustom] = useState('')
  const [toDept, setToDept] = useState('')
  const [toDeptCustom, setToDeptCustom] = useState('')
  const [toTeam, setToTeam] = useState('')
  const [toTeamCustom, setToTeamCustom] = useState('')
  const [rankSel, setRankSel] = useState('') // 직급 select 선택값 — '' | '__custom__' | 실제 직급명
  const [resetTenure, setResetTenure] = useState(true) // 직급이 바뀔 때 연차(체류연한)를 0년부터 다시 계산할지
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  useEffect(() => {
    supabase.from('employees').select('id, name, division, dept, team, locations, rank, track').order('name').then(({ data }) => setEmployees(data || []))
  }, [])

  // 실제 employees 데이터에서 부문→본부→팀 연결관계를 뽑아 캐스케이딩 선택지로 씀
  const orgTree = useMemo(() => {
    const divisions = new Set()
    const deptsByDiv = {}
    const teamsByDept = {}
    employees.forEach((e) => {
      if (e.division) divisions.add(e.division)
      if (e.division && e.dept) {
        if (!deptsByDiv[e.division]) deptsByDiv[e.division] = new Set()
        deptsByDiv[e.division].add(e.dept)
      }
      if (e.dept && e.team) {
        if (!teamsByDept[e.dept]) teamsByDept[e.dept] = new Set()
        teamsByDept[e.dept].add(e.team)
      }
    })
    return { divisions: [...divisions].sort((a, b) => a.localeCompare(b, 'ko')), deptsByDiv, teamsByDept }
  }, [employees])

  const finalDivision = toDiv === '__custom__' ? toDivCustom.trim() : toDiv
  const finalDept = toDept === '__custom__' ? toDeptCustom.trim() : toDept
  const finalTeam = toTeam === '__custom__' ? toTeamCustom.trim() : toTeam

  // 본부 선택지: 부문을 골랐으면 그 부문 산하로 좁히고, 아니면 조직도 기준(DEPT_OPTIONS) + 실제 데이터 전체
  const deptOptions = useMemo(() => {
    if (finalDivision && orgTree.deptsByDiv[finalDivision]) {
      return [...orgTree.deptsByDiv[finalDivision]].sort((a, b) => a.localeCompare(b, 'ko'))
    }
    const live = employees.map((e) => e.dept).filter(Boolean)
    return [...new Set([...DEPT_OPTIONS, ...live])].sort((a, b) => a.localeCompare(b, 'ko'))
  }, [orgTree, finalDivision, employees])

  // 팀 선택지: 본부를 골랐으면 그 본부 산하로 좁히고, 아니면 실제 데이터에 있는 팀 전체
  const teamOptions = useMemo(() => {
    if (finalDept && orgTree.teamsByDept[finalDept]) {
      return [...orgTree.teamsByDept[finalDept]].sort((a, b) => a.localeCompare(b, 'ko'))
    }
    return [...new Set(employees.map((e) => e.team).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko'))
  }, [orgTree, finalDept, employees])

  // 직급 선택지: 선택된 직원의 직군(사무/연구)에 맞는 직급만 + 임원 직급은 항상 포함(부장→이사 등 승진 대비)
  const rankOptions = useMemo(() => {
    const base = (picked?.track && RANKS_BY_TRACK[picked.track]) || [...OFFICE_RANKS, ...RESEARCH_RANKS]
    return [...new Set([...base, ...EXEC_RANKS])]
  }, [picked])

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
    // 직급 select에 그 직원의 현재 직급을 기본 선택 — 선택지 목록에 없는 값(괄호 역할 표기 등)이면 직접입력 칸으로
    if (!rankSel) {
      const base = (e.track && RANKS_BY_TRACK[e.track]) || [...OFFICE_RANKS, ...RESEARCH_RANKS]
      const opts = [...new Set([...base, ...EXEC_RANKS])]
      setRankSel(e.rank && opts.includes(e.rank) ? e.rank : (e.rank ? '__custom__' : ''))
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.type === '휴직' && !form.leave_start) { setError('휴직시작일을 입력해주세요.'); return }
    if (form.type === '부서이동' && !finalDivision && !finalDept && !finalTeam) {
      setError(`${ORG_LEVEL_LABEL.division}/${ORG_LEVEL_LABEL.dept}/${ORG_LEVEL_LABEL.team} 중 최소 하나는 선택해주세요.`)
      return
    }
    setSaving(true)
    // 휴직 유형은 변경전/후 대신 휴직시작~종료일을 그대로 그 두 칸에 담음(스키마 변경 없이 재사용).
    // 부서이동은 부문·본부·팀 선택값을 합쳐서 to_value에 담음(안 바뀐 단계는 건너뜀).
    const orgToValue = [finalDivision, finalDept, finalTeam].filter(Boolean).join(' · ')
    const payload = form.type === '휴직'
      ? { ...form, from_value: form.leave_start, to_value: form.leave_end || '(진행중)' }
      : form.type === '부서이동'
        ? { ...form, to_value: orgToValue }
        : form
    const { leave_start, leave_end, ...rest } = payload
    const { error } = await supabase.from('transfers').insert({ ...rest, employee_id: picked?.id || null })
    if (error) { setSaving(false); setError(error.message); return }

    // 명단에 있는 직원이면, 발령 기록만 남기는 게 아니라 실제 직원 데이터에도 바로 반영해서
    // 포인트/체류연한·소속·직급이 그 자리에서 바로 맞게 잡히게 함(전에는 휴직만 연계되고 있었음)
    if (picked?.id) {
      const empPatch = {}
      if (form.type === '휴직') {
        const months = monthsBetween(form.leave_start, form.leave_end)
        empPatch.leave_start_date = form.leave_start
        empPatch.leave_end_date = form.leave_end || null
        if (months !== null) empPatch.leave_years = months / 12
      }
      if (form.type === '부서이동') {
        if (finalDivision) empPatch.division = finalDivision
        if (finalDept) empPatch.dept = finalDept
        if (finalTeam) empPatch.team = finalTeam
      }
      const newRank = form.rank.trim()
      if (newRank && baseRank(newRank) !== baseRank(picked.rank)) {
        empPatch.rank = newRank
        if (resetTenure) empPatch.level = 0
      }
      if (Object.keys(empPatch).length > 0) {
        const { error: empErr } = await supabase.from('employees').update(empPatch).eq('id', picked.id)
        if (empErr) { setSaving(false); setError(`발령은 등록됐지만 직원 정보 반영에 실패했어요: ${empErr.message}`); return }
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
            <select style={field} value={form.type} onChange={set('type')}>
              <option value="부서이동">부서이동</option><option value="승진">승진</option><option value="파견">파견</option><option value="직무변경">직무변경</option><option value="휴직">휴직</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={lbl}>직급</label>
            <select
              style={field}
              value={rankSel || (rankOptions.includes(form.rank) ? form.rank : (form.rank ? '__custom__' : ''))}
              onChange={(e) => {
                const v = e.target.value
                setRankSel(v)
                setForm({ ...form, rank: v === '__custom__' ? '' : v })
              }}
            >
              <option value="">선택 안 함</option>
              {rankOptions.map((r) => <option key={r} value={r}>{r}</option>)}
              <option value="__custom__">+ 직접 입력</option>
            </select>
            {(rankSel === '__custom__' || (!rankSel && form.rank && !rankOptions.includes(form.rank))) && (
              <input style={field} placeholder="직급명" value={form.rank} onChange={set('rank')} />
            )}
          </div>
        </div>
        {picked && form.rank.trim() && baseRank(form.rank) !== baseRank(picked.rank) && (
          <label style={{ ...lbl, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={resetTenure} onChange={(e) => setResetTenure(e.target.checked)} />
            직급 변경으로 연차(체류연한) 0년부터 다시 계산 ({picked.rank} → {form.rank})
          </label>
        )}
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
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ ...lbl, marginTop: 0 }}>{ORG_LEVEL_LABEL.division}</label>
                    <select
                      style={field}
                      value={toDiv}
                      onChange={(e) => {
                        setToDiv(e.target.value); setToDivCustom('')
                        setToDept(''); setToDeptCustom(''); setToTeam(''); setToTeamCustom('')
                      }}
                    >
                      <option value="">(변경 없음)</option>
                      {orgTree.divisions.map((d) => <option key={d} value={d}>{d}</option>)}
                      <option value="__custom__">+ 새 {ORG_LEVEL_LABEL.division} 직접 입력</option>
                    </select>
                    {toDiv === '__custom__' && (
                      <input style={field} placeholder={`새 ${ORG_LEVEL_LABEL.division}명`} value={toDivCustom} onChange={(e) => setToDivCustom(e.target.value)} />
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ ...lbl, marginTop: 0 }}>{ORG_LEVEL_LABEL.dept}</label>
                    <select
                      style={field}
                      value={toDept}
                      onChange={(e) => {
                        setToDept(e.target.value); setToDeptCustom('')
                        setToTeam(''); setToTeamCustom('')
                      }}
                    >
                      <option value="">(변경 없음)</option>
                      {deptOptions.map((d) => <option key={d} value={d}>{d}</option>)}
                      <option value="__custom__">+ 새 {ORG_LEVEL_LABEL.dept} 직접 입력</option>
                    </select>
                    {toDept === '__custom__' && (
                      <input style={field} placeholder={`새 ${ORG_LEVEL_LABEL.dept}명`} value={toDeptCustom} onChange={(e) => setToDeptCustom(e.target.value)} />
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ ...lbl, marginTop: 0 }}>{ORG_LEVEL_LABEL.team}</label>
                    <select
                      style={field}
                      value={toTeam}
                      onChange={(e) => { setToTeam(e.target.value); setToTeamCustom('') }}
                    >
                      <option value="">(변경 없음)</option>
                      {teamOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                      <option value="__custom__">+ 새 {ORG_LEVEL_LABEL.team} 직접 입력</option>
                    </select>
                    {toTeam === '__custom__' && (
                      <input style={field} placeholder={`새 ${ORG_LEVEL_LABEL.team}명`} value={toTeamCustom} onChange={(e) => setToTeamCustom(e.target.value)} />
                    )}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 10 }}>
                  {ORG_LEVEL_LABEL.division}을 고르면 {ORG_LEVEL_LABEL.dept} 선택지가, {ORG_LEVEL_LABEL.dept}를 고르면 {ORG_LEVEL_LABEL.team} 선택지가 그 안으로 좁혀져요. 안 바뀐 단계는 비워두세요 — 선택한 단계만 직원 정보에 반영돼요.
                </div>
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
