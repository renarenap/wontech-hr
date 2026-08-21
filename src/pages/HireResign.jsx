import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { R, OFFICE_RANKS, RESEARCH_RANKS, EXEC_RANKS, RANK_DEFAULTS } from '../lib/constants'
import { crd, thS, tdS, Modal, field, label as lbl, btnPrimary, btnGhost, Loading, EmptyState, Bd } from '../components/ui'
import { parseChangesDocx, isTrackedRank } from '../lib/docxChanges'
import Hire from './Hire'
import Resign from './Resign'
import Onboarding, { DEFAULT_TASKS } from './Onboarding'

function SectionTitle({ icon, children }) {
  return <div style={{ fontSize: 16, fontWeight: 800, margin: '28px 0 12px' }}>{icon} {children}</div>
}

// ═══ 공용 로직: 승진포인트 employees 데이터에 입사자 추가 (+ 온보딩/입사체크리스트) ═══
async function addHireToRoster({ name, dept, rank, join_date }) {
  const track = RESEARCH_RANKS.includes(rank) ? '연구' : '사무' // 임원 등 트랙 구분 없는 직급은 사무로 저장(추적용 필드 아님)
  const defaults = RANK_DEFAULTS[rank]
  if (!defaults) throw new Error(`승진포인트 대상 직급이 아니에요: ${rank}`)

  const { data: emp, error: e1 } = await supabase
    .from('employees')
    .insert({ name, dept, rank, track, role: '팀원', level: 0, req_tenure: defaults.req_tenure, threshold: defaults.threshold, base_pts: 0 })
    .select()
    .single()
  if (e1) throw new Error(e1.message)

  const { data: ob, error: e2 } = await supabase
    .from('onboarding')
    .insert({ employee_id: emp.id, join_date })
    .select()
    .single()
  if (e2) throw new Error(e2.message)

  const tasks = DEFAULT_TASKS.map((t, i) => ({ onboarding_id: ob.id, task_name: t, done: false, sort_order: i }))
  const { error: e3 } = await supabase.from('onboarding_tasks').insert(tasks)
  if (e3) throw new Error(e3.message)

  const { error: e4 } = await supabase.from('hires').insert({ name, dept, rank, join_date, status: '입사확정' })
  if (e4) throw new Error(e4.message)

  return emp
}

// ═══ 공용 로직: employees_archive로 스냅샷 이동 후 employees에서 제거 ═══
async function resignEmployee(picked, lastDay) {
  const { data: evals, error: e1 } = await supabase.from('evaluations').select('*').eq('employee_id', picked.id)
  if (e1) throw new Error(e1.message)

  const { error: e2 } = await supabase.from('employees_archive').insert({
    original_id: picked.id, name: picked.name, dept: picked.dept, team: picked.team, rank: picked.rank,
    track: picked.track, role: picked.role, level: picked.level, req_tenure: picked.req_tenure, threshold: picked.threshold,
    base_pts: picked.base_pts, eng_pts: picked.eng_pts, eng2_pts: picked.eng2_pts, cert_pts: picked.cert_pts, award_pts: picked.award_pts,
    evaluations_snapshot: evals || [], resign_date: lastDay,
  })
  if (e2) throw new Error(e2.message)

  // 발령(transfers) 이력은 남기되, employees FK만 풀어줘야 삭제가 막히지 않음
  await supabase.from('transfers').update({ employee_id: null }).eq('employee_id', picked.id)

  const { error: e3 } = await supabase.from('employees').delete().eq('id', picked.id)
  if (e3) throw new Error(e3.message)

  const { error: e4 } = await supabase.from('resignations').insert({
    name: picked.name, dept: picked.dept, team: picked.team, rank: picked.rank,
    submit_date: lastDay, last_day: lastDay, status: '진행중',
  })
  if (e4) throw new Error(e4.message)
}

export default function HireResign() {
  const [refreshKey, setRefreshKey] = useState(0)
  const [showAddHire, setShowAddHire] = useState(false)
  const [showAddResign, setShowAddResign] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const bump = () => setRefreshKey((k) => k + 1)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
        <button style={btnGhost} onClick={() => setShowImport(true)}>📄 변동현황 워드파일 업로드</button>
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
      {showImport && (
        <ImportChangesModal onClose={() => setShowImport(false)} onApplied={() => { setShowImport(false); bump() }} />
      )}
    </div>
  )
}

// ═══ 입사자 등록 ═══
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

    setSaving(true)
    try {
      await addHireToRoster({ name, dept: deptVal, rank, join_date: joinDate })
      onCreated()
    } catch (err) {
      setError(err.message)
    }
    setSaving(false)
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
          <optgroup label="임원">
            {EXEC_RANKS.map((r) => <option key={r} value={r}>{r}</option>)}
          </optgroup>
        </select>
        <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 10 }}>
          임원은 명단에는 포함되지만 승진포인트 추적 대상은 아니에요 (체류연한·기준P 없음).
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

// ═══ 퇴사자 등록 ═══
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
    try {
      await resignEmployee(picked, lastDay)
      onCreated()
    } catch (err) {
      setError(err.message)
    }
    setSaving(false)
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

// ═══ 워드파일(임직원변동현황) 업로드 → 미리보기 → 선택 반영 ═══
function ImportChangesModal({ onClose, onApplied }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [rows, setRows] = useState(null) // 분류된 항목 리스트
  const [checked, setChecked] = useState({}) // raw -> bool
  const [applying, setApplying] = useState(false)
  const [result, setResult] = useState(null) // { ok, fail }

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setBusy(true)
    setResult(null)
    try {
      const parsed = await parseChangesDocx(file)
      const [{ data: employees }, { data: archived }] = await Promise.all([
        supabase.from('employees').select('*'),
        supabase.from('employees_archive').select('name, resign_date'),
      ])
      const classified = classify(parsed, employees || [], archived || [])
      setRows(classified)
      const initChecked = {}
      classified.forEach((r) => { if (r.status === 'new') initChecked[r.key] = true })
      setChecked(initChecked)
    } catch (err) {
      setError(err.message || String(err))
    }
    setBusy(false)
  }

  const toggle = (key) => setChecked((c) => ({ ...c, [key]: !c[key] }))

  const selected = useMemo(() => (rows || []).filter((r) => checked[r.key]), [rows, checked])

  const apply = async () => {
    setApplying(true)
    let ok = 0
    const fail = []
    for (const r of selected) {
      try {
        if (r.kind === 'hire') {
          await addHireToRoster({ name: r.name, dept: r.dept, rank: r.rank, join_date: r.date })
        } else {
          await resignEmployee(r.matchedEmployee, r.date)
        }
        ok += 1
      } catch (err) {
        fail.push({ name: r.name, raw: r.raw, message: err.message })
      }
    }
    setApplying(false)
    setResult({ ok, fail })
    if (fail.length === 0) onApplied()
  }

  const hires = (rows || []).filter((r) => r.kind === 'hire')
  const resigns = (rows || []).filter((r) => r.kind === 'resign')

  return (
    <Modal title="변동현황 워드파일 업로드" onClose={onClose} width={760}>
      {!rows && (
        <div>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 14, lineHeight: 1.6 }}>
            매주 작성하시는 "임직원변동현황" 워드파일(.docx)을 올려주시면, 현재 데이터에 아직 반영 안 된
            입사/퇴사 항목만 찾아서 미리 보여드려요. 확인 후 원하는 것만 골라서 반영하시면 됩니다.
          </div>
          <input type="file" accept=".docx" onChange={onFile} disabled={busy} />
          {busy && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 10 }}>분석 중…</div>}
          {error && <div style={{ color: '#dc2626', fontSize: 12, marginTop: 10 }}>{error}</div>}
        </div>
      )}

      {rows && !result && (
        <div>
          <ChangeGroup title="📥 신규 입사 후보" items={hires} checked={checked} onToggle={toggle} kind="hire" />
          <ChangeGroup title="📤 퇴사 후보" items={resigns} checked={checked} onToggle={toggle} kind="resign" />
          {error && <div style={{ color: '#dc2626', fontSize: 12, margin: '10px 0' }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
            <div style={{ fontSize: 12, color: '#64748b' }}>{selected.length}건 선택됨</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" style={btnGhost} onClick={onClose}>취소</button>
              <button type="button" style={btnPrimary} disabled={applying || selected.length === 0} onClick={apply}>
                {applying ? '반영 중…' : `선택 항목 반영 (${selected.length})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {result && (
        <div>
          <div style={{ fontSize: 13, marginBottom: 10 }}>
            ✅ {result.ok}건 반영 완료{result.fail.length > 0 && ` · ⚠️ ${result.fail.length}건 실패`}
          </div>
          {result.fail.length > 0 && (
            <div style={{ background: '#fef2f2', borderRadius: 8, padding: 12, fontSize: 12, color: '#b91c1c', marginBottom: 10 }}>
              {result.fail.map((f, i) => <div key={i}>{f.name || f.raw}: {f.message}</div>)}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" style={btnPrimary} onClick={onApplied}>확인</button>
          </div>
        </div>
      )}
    </Modal>
  )
}

function classify(parsed, employees, archived) {
  const byName = new Map()
  employees.forEach((e) => {
    const k = e.name.trim()
    byName.set(k, [...(byName.get(k) || []), e])
  })
  const archivedNames = new Set(archived.map((a) => a.name.trim()))

  const out = []
  parsed.months.forEach(({ month, hires, resigns }) => {
    hires.forEach((h, i) => {
      const key = `h-${month}-${i}-${h.raw}`
      if (!h.ok) { out.push({ key, kind: 'hire', status: 'parse_failed', raw: h.raw, month }); return }
      if (!isTrackedRank(h.rank)) {
        out.push({ key, kind: 'hire', status: 'rank_untracked', ...h, month })
        return
      }
      const existing = byName.get(h.name) || []
      if (existing.length > 0) {
        out.push({ key, kind: 'hire', status: 'already_exists', ...h, month })
      } else {
        out.push({ key, kind: 'hire', status: 'new', ...h, month })
      }
    })
    resigns.forEach((r, i) => {
      const key = `r-${month}-${i}-${r.raw}`
      if (!r.ok) { out.push({ key, kind: 'resign', status: 'parse_failed', raw: r.raw, month }); return }
      const existing = byName.get(r.name) || []
      if (existing.length === 1) {
        out.push({ key, kind: 'resign', status: 'new', ...r, month, matchedEmployee: existing[0] })
      } else if (existing.length > 1) {
        out.push({ key, kind: 'resign', status: 'ambiguous', ...r, month })
      } else if (archivedNames.has(r.name)) {
        out.push({ key, kind: 'resign', status: 'already_processed', ...r, month })
      } else {
        out.push({ key, kind: 'resign', status: 'not_found', ...r, month })
      }
    })
  })
  return out
}

const STATUS_CFG = {
  new: { label: '반영 가능', c: '#166534', bg: '#dcfce7', selectable: true },
  already_exists: { label: '이미 등록됨', c: '#64748b', bg: '#f1f5f9', selectable: false },
  already_processed: { label: '이미 처리됨', c: '#64748b', bg: '#f1f5f9', selectable: false },
  rank_untracked: { label: '승진포인트 대상 아님', c: '#92400e', bg: '#fef3c7', selectable: false },
  not_found: { label: '명단에서 못 찾음 · 확인 필요', c: '#b91c1c', bg: '#fee2e2', selectable: false },
  ambiguous: { label: '동명이인 있음 · 직접 등록해주세요', c: '#b91c1c', bg: '#fee2e2', selectable: false },
  parse_failed: { label: '형식 인식 실패 · 직접 등록해주세요', c: '#b91c1c', bg: '#fee2e2', selectable: false },
}

function ChangeGroup({ title, items, checked, onToggle, kind }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{title} <span style={{ color: '#94a3b8', fontWeight: 400 }}>{items.length}건</span></div>
      {items.length === 0 ? (
        <div style={{ fontSize: 12, color: '#94a3b8', padding: '8px 0' }}>해당 항목이 없습니다.</div>
      ) : (
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, maxHeight: 220, overflow: 'auto' }}>
          {items.map((r) => {
            const cfg = STATUS_CFG[r.status] || STATUS_CFG.parse_failed
            return (
              <label
                key={r.key}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', fontSize: 12,
                  borderBottom: '1px solid #f1f5f9', cursor: cfg.selectable ? 'pointer' : 'default',
                  opacity: cfg.selectable ? 1 : 0.7,
                }}
              >
                <input
                  type="checkbox" disabled={!cfg.selectable}
                  checked={!!checked[r.key]} onChange={() => onToggle(r.key)}
                />
                <span style={{ flex: 1 }}>
                  {r.ok === false ? (
                    <span style={{ color: '#94a3b8' }}>{r.raw}</span>
                  ) : (
                    <>
                      <b>{r.name}</b> <span style={{ color: '#64748b' }}>{r.rank} · {r.dept} · {r.date}{kind === 'resign' && r.tenure != null ? ` · 근속 ${r.tenure}년` : ''}</span>
                    </>
                  )}
                </span>
                <Bd color={cfg.c} bg={cfg.bg}>{cfg.label}</Bd>
              </label>
            )
          })}
        </div>
      )}
    </div>
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
