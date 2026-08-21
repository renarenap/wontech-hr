import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { R, OFFICE_RANKS, RESEARCH_RANKS, RANK_DEFAULTS } from '../lib/constants'
import { crd, thS, tdS, Modal, field, label as lbl, btnPrimary, btnGhost, Loading, EmptyState } from '../components/ui'
import Hire from './Hire'
import Resign from './Resign'
import Onboarding, { DEFAULT_TASKS } from './Onboarding'

function SectionTitle({ icon, children }) {
  return <div style={{ fontSize: 16, fontWeight: 800, margin: '28px 0 12px' }}>{icon} {children}</div>
}

export default function HireResign() {
  const [refreshKey, setRefreshKey] = useState(0)
  const [showAddHire, setShowAddHire] = useState(false)
  const [showAddResign, setShowAddResign] = useState(false)
  const bump = () => setRefreshKey((k) => k + 1)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 4 }}>
        <button style={{ ...btnPrimary, background: R }} onClick={() => setShowAddResign(true)}>− 퇴사자 등록</button>
        <button style={btnPrimary} onClick={() => setShowAddHire(true)}>+ 입사자 등록</button>
      </div>

      <SectionTitle icon="📥">입사 예정자</SectionTitle>
      <Hire key={`hire-${refreshKey}`} hideAdd />

      <SectionTitle icon="📤">퇴사 현황</SectionTitle>
      <Resign key={`resign-${refreshKey}`} hideAdd />

      <SectionTitle icon="🚀">온보딩 현황</SectionTitle>
      <Onboarding key={`onboarding-${refreshKey}`} hideAdd />

      <SectionTitle icon="🗂">퇴사(삭제) 이력</SectionTitle>
      <ArchiveList key={`archive-${refreshKey}`} />

      {showAddHire && (
        <QuickAddHireModal onClose={() => setShowAddHire(false)} onCreated={() => { setShowAddHire(false); bump() }} />
      )}
      {showAddResign && (
        <QuickAddResignModal onClose={() => setShowAddResign(false)} onCreated={() => { setShowAddResign(false); bump() }} />
      )}
    </div>
  )
}

// ═══ 입사자 등록 (승진포인트 employees 데이터에 바로 추가 + 온보딩/입사체크리스트 자동 생성) ═══
function QuickAddHireModal({ onClose, onCreated }) {
  const [depts, setDepts] = useState([])
  const [name, setName] = useState('')
  const [dept, setDept] = useState('')
  const [customDept, setCustomDept] = useState('')
  const [joinDate, setJoinDate] = useState('')
  const [rank, setRank] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('employees').select('dept').then(({ data }) => {
      const uniq = [...new Set((data || []).map((d) => d.dept).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko'))
      setDepts(uniq)
    })
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    const deptVal = dept === '__custom__' ? customDept.trim() : dept
    if (!deptVal) { setError('부서를 선택하거나 입력해주세요.'); return }
    if (!rank) { setError('직위를 선택해주세요.'); return }
    const track = OFFICE_RANKS.includes(rank) ? '사무' : '연구'
    const { req_tenure, threshold } = RANK_DEFAULTS[rank]

    setSaving(true)
    // 1) 승진포인트 대상 employees 레코드 생성
    const { data: emp, error: e1 } = await supabase
      .from('employees')
      .insert({ name, dept: deptVal, rank, track, role: '팀원', level: 0, req_tenure, threshold, base_pts: 0 })
      .select()
      .single()
    if (e1) { setError(e1.message); setSaving(false); return }

    // 2) 온보딩 레코드 + 기본 체크리스트
    const { data: ob, error: e2 } = await supabase
      .from('onboarding')
      .insert({ employee_id: emp.id, join_date: joinDate })
      .select()
      .single()
    if (e2) { setError(e2.message); setSaving(false); return }
    const tasks = DEFAULT_TASKS.map((t, i) => ({ onboarding_id: ob.id, task_name: t, done: false, sort_order: i }))
    const { error: e3 } = await supabase.from('onboarding_tasks').insert(tasks)
    if (e3) { setError(e3.message); setSaving(false); return }

    // 3) 입사 준비 체크리스트(hires) 레코드 생성
    const { error: e4 } = await supabase.from('hires').insert({ name, dept: deptVal, rank, join_date: joinDate, status: '입사확정' })
    setSaving(false)
    if (e4) { setError(e4.message); return }
    onCreated()
  }

  return (
    <Modal title="입사자 등록" onClose={onClose}>
      <form onSubmit={submit}>
        <label style={lbl}>이름</label>
        <input style={field} required value={name} onChange={(e) => setName(e.target.value)} />

        <label style={lbl}>부서</label>
        <select style={field} required value={dept} onChange={(e) => setDept(e.target.value)}>
          <option value="" disabled>선택하세요</option>
          {depts.map((d) => <option key={d} value={d}>{d}</option>)}
          <option value="__custom__">+ 새 부서 직접 입력</option>
        </select>
        {dept === '__custom__' && (
          <input style={field} required placeholder="새 부서명" value={customDept} onChange={(e) => setCustomDept(e.target.value)} />
        )}

        <label style={lbl}>입사일</label>
        <input style={field} type="date" required value={joinDate} onChange={(e) => setJoinDate(e.target.value)} />

        <label style={lbl}>직위</label>
        <select style={field} required value={rank} onChange={(e) => setRank(e.target.value)}>
          <option value="" disabled>선택하세요</option>
          <optgroup label="사무직">
            {OFFICE_RANKS.map((r) => <option key={r} value={r}>{r}</option>)}
          </optgroup>
          <optgroup label="연구직">
            {RESEARCH_RANKS.map((r) => <option key={r} value={r}>{r}</option>)}
          </optgroup>
        </select>
        <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 10 }}>
          임원급(이사 이상)은 승진포인트 추적 대상이 아니라 이 목록에는 없어요.
        </div>

        {error && <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 10 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <button type="button" style={btnGhost} onClick={onClose}>취소</button>
          <button type="submit" style={btnPrimary} disabled={saving}>{saving ? '등록 중…' : '등록'}</button>
        </div>
      </form>
    </Modal>
  )
}

// ═══ 퇴사자 등록 (이름 검색 → employees_archive로 스냅샷 이동 후 employees에서 삭제) ═══
function QuickAddResignModal({ onClose, onCreated }) {
  const [employees, setEmployees] = useState([])
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState(null)
  const [lastDay, setLastDay] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('employees').select('*').order('name').then(({ data }) => setEmployees(data || []))
  }, [])

  const matches = useMemo(() => {
    if (picked || !query.trim()) return []
    const q = query.trim().toLowerCase()
    return employees.filter((e) => e.name.toLowerCase().includes(q)).slice(0, 8)
  }, [employees, query, picked])

  const pick = (e) => { setPicked(e); setQuery(e.name) }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!picked) { setError('이름을 입력해서 대상자를 먼저 선택해주세요.'); return }
    if (!lastDay) { setError('퇴사일자를 입력해주세요.'); return }
    setSaving(true)

    const { data: evals, error: e1 } = await supabase.from('evaluations').select('*').eq('employee_id', picked.id)
    if (e1) { setError(e1.message); setSaving(false); return }

    const { error: e2 } = await supabase.from('employees_archive').insert({
      original_id: picked.id, name: picked.name, dept: picked.dept, team: picked.team, rank: picked.rank,
      track: picked.track, role: picked.role, level: picked.level, req_tenure: picked.req_tenure, threshold: picked.threshold,
      base_pts: picked.base_pts, eng_pts: picked.eng_pts, eng2_pts: picked.eng2_pts, cert_pts: picked.cert_pts, award_pts: picked.award_pts,
      evaluations_snapshot: evals || [], resign_date: lastDay,
    })
    if (e2) { setError(e2.message); setSaving(false); return }

    // 발령(transfers) 이력은 남기되, employees FK만 풀어줘야 삭제가 막히지 않음
    await supabase.from('transfers').update({ employee_id: null }).eq('employee_id', picked.id)

    const { error: e3 } = await supabase.from('employees').delete().eq('id', picked.id)
    if (e3) { setError(e3.message); setSaving(false); return }

    const { error: e4 } = await supabase.from('resignations').insert({
      name: picked.name, dept: picked.dept, team: picked.team, rank: picked.rank,
      submit_date: lastDay, last_day: lastDay, status: '진행중',
    })
    setSaving(false)
    if (e4) { setError(e4.message); return }
    onCreated()
  }

  return (
    <Modal title="퇴사자 등록" onClose={onClose}>
      <form onSubmit={submit}>
        <label style={lbl}>이름</label>
        <div style={{ position: 'relative' }}>
          <input
            style={field} required placeholder="이름을 입력해서 검색"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPicked(null) }}
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
                  <span style={{ color: '#94a3b8', marginLeft: 8 }}>{e.dept}{e.team ? ` · ${e.team}` : ''} · {e.rank}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {picked && (
          <div style={{ background: '#f8fafc', borderRadius: 8, padding: 12, margin: '10px 0', fontSize: 12, lineHeight: 1.8 }}>
            <div><b>{picked.name}</b> · {picked.track}직 · {picked.rank}</div>
            <div style={{ color: '#64748b' }}>{picked.dept}{picked.team ? ` · ${picked.team}` : ''}</div>
          </div>
        )}

        <label style={lbl}>퇴사일자</label>
        <input style={field} type="date" required value={lastDay} onChange={(e) => setLastDay(e.target.value)} />

        <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 10 }}>
          등록하면 승진포인트 데이터에서 즉시 제외되고, 퇴사(삭제) 이력에 스냅샷으로 보관됩니다.
        </div>

        {error && <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 10 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <button type="button" style={btnGhost} onClick={onClose}>취소</button>
          <button type="submit" style={{ ...btnPrimary, background: R }} disabled={saving}>{saving ? '처리 중…' : '퇴사 처리'}</button>
        </div>
      </form>
    </Modal>
  )
}

// ═══ 퇴사(삭제) 이력 뷰어 ═══
function ArchiveList() {
  const [list, setList] = useState(null)

  useEffect(() => {
    supabase.from('employees_archive').select('*').order('resign_date', { ascending: false }).then(({ data }) => setList(data || []))
  }, [])

  if (!list) return <Loading />

  return (
    <div style={crd}>
      {list.length === 0 ? <EmptyState label="퇴사(삭제) 이력이 없습니다" /> : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['이름', '소속', '직급', '퇴사일', '보관일시'].map((h) => <th key={h} style={thS}>{h}</th>)}</tr></thead>
          <tbody>
            {list.map((a) => (
              <tr key={a.id}>
                <td style={{ ...tdS, fontWeight: 600 }}>{a.name}</td>
                <td style={{ ...tdS, color: '#64748b' }}>{a.dept}{a.team ? ` · ${a.team}` : ''}</td>
                <td style={tdS}>{a.rank}</td>
                <td style={tdS}>{a.resign_date}</td>
                <td style={{ ...tdS, color: '#94a3b8' }}>{a.archived_at?.slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
