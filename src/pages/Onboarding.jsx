import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { P, G, O, Y } from '../lib/constants'
import { Bd, Check, KpiRow, Prog, crd, thS, tdS, Loading, ErrorBox, EmptyState, Modal, field, label as lbl, btnPrimary, btnGhost, AddButton } from '../components/ui'

export const DEFAULT_TASKS = [
  '입사 오리엔테이션', '사내 시스템 교육', '부서 업무 소개', '보안 서약서 제출',
  '멘토 1:1 (1차)', '1개월 적응 면담', '2개월 중간 면담', '수습 평가 (3개월)',
]

function daysIn(joinDate) {
  const j = new Date(joinDate)
  const n = new Date()
  n.setHours(0, 0, 0, 0)
  j.setHours(0, 0, 0, 0)
  return Math.floor((n - j) / 864e5)
}

function withDerived(o) {
  const tasks = (o.onboarding_tasks || []).slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
  const done = tasks.filter((t) => t.done).length
  const total = tasks.length || 1
  return { ...o, tasks, done, total: tasks.length, pct: Math.round((done / total) * 100), daysIn: daysIn(o.join_date) }
}

export default function Onboarding({ hideAdd = false }) {
  const [list, setList] = useState(null)
  const [error, setError] = useState(null)
  const [sel, setSel] = useState(null)
  const [showAdd, setShowAdd] = useState(false)

  const load = async () => {
    const { data, error } = await supabase
      .from('onboarding')
      .select('*, employees(name, dept, team, rank), onboarding_tasks(*)')
      .order('join_date', { ascending: false })
    if (error) { setError(error); return }
    setList((data || []).map(withDerived))
  }

  useEffect(() => { load() }, [])

  const toggle = async (taskId, current) => {
    setList(list.map((o) => (
      o.id === sel
        ? withDerived({ ...o, onboarding_tasks: o.tasks.map((t) => (t.id === taskId ? { ...t, done: !current } : t)) })
        : o
    )))
    const { error } = await supabase.from('onboarding_tasks').update({ done: !current }).eq('id', taskId)
    if (error) setError(error)
  }

  const remove = async (o) => {
    if (!window.confirm(`${o.employees?.name || '이 사람'}의 온보딩 항목을 삭제할까요? (직원 정보 자체는 유지됩니다)`)) return
    const { error } = await supabase.from('onboarding').delete().eq('id', o.id)
    if (error) { setError(error); return }
    setList(list.filter((x) => x.id !== o.id))
    if (sel === o.id) setSel(null)
  }

  if (error) return <ErrorBox error={error} />
  if (!list) return <Loading />

  const s = list.find((o) => o.id === sel)

  return (
    <div>
      {!hideAdd && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <AddButton onClick={() => setShowAdd(true)}>+ 온보딩 대상 추가</AddButton>
        </div>
      )}
      <KpiRow items={[
        { v: list.length, l: '온보딩 진행중', c: P },
        { v: list.filter((o) => o.pct >= 80).length, l: '거의 완료', c: G },
        { v: list.filter((o) => o.daysIn <= 30).length, l: '입사 1개월↓', c: O },
        { v: list.filter((o) => o.daysIn > 60).length, l: '입사 2개월+', c: Y },
      ]} />
      <div style={{ display: 'grid', gridTemplateColumns: s ? '1fr 1fr' : '1fr', gap: 16 }}>
        <div style={crd}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>신규 입사자</div>
          {list.length === 0 ? <EmptyState /> : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['이름', '소속', '직급', '입사일', 'D+', '멘토', '진행률', ''].map((h) => <th key={h} style={thS}>{h}</th>)}</tr></thead>
              <tbody>
                {list.map((o) => {
                  const e = o.employees || {}
                  return (
                    <tr key={o.id} style={{ cursor: 'pointer', background: sel === o.id ? '#FFF5F0' : 'transparent' }}
                      onClick={() => setSel(o.id === sel ? null : o.id)}
                      onMouseEnter={(ev) => { if (sel !== o.id) ev.currentTarget.style.background = '#f8fafc' }}
                      onMouseLeave={(ev) => { if (sel !== o.id) ev.currentTarget.style.background = 'transparent' }}>
                      <td style={{ ...tdS, fontWeight: 600 }}>{e.name}</td>
                      <td style={{ ...tdS, color: '#64748b' }}>{e.dept}</td>
                      <td style={tdS}>{e.rank}</td>
                      <td style={tdS}>{o.join_date}</td>
                      <td style={tdS}><Bd color={o.daysIn > 60 ? Y : P} bg={o.daysIn > 60 ? '#fef9c3' : '#f3e8ff'}>D+{o.daysIn}</Bd></td>
                      <td style={tdS}>{o.mentor}</td>
                      <td style={tdS}><Prog current={o.done} max={o.total || 1} /></td>
                      <td style={tdS}><button style={{ ...btnGhost, padding: '4px 9px', fontSize: 11 }} onClick={(e2) => { e2.stopPropagation(); remove(o) }}>삭제</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
        {s && (
          <div style={crd}>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>{s.employees?.name}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>{s.employees?.dept} · {s.employees?.rank} · 멘토: {s.mentor}</div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1, background: '#f8fafc', borderRadius: 8, padding: 12 }}><div style={{ fontSize: 11, color: '#64748b' }}>입사일</div><div style={{ fontSize: 14, fontWeight: 600 }}>{s.join_date}</div></div>
              <div style={{ flex: 1, background: '#f8fafc', borderRadius: 8, padding: 12 }}><div style={{ fontSize: 11, color: '#64748b' }}>진행률</div><div style={{ fontSize: 14, fontWeight: 600, color: P }}>{s.pct}%</div></div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>📋 체크리스트</div>
            {s.tasks.length === 0 ? <EmptyState label="등록된 체크리스트가 없습니다" /> : s.tasks.map((t) => (
              <Check key={t.id} done={t.done} label={t.task_name} onToggle={() => toggle(t.id, t.done)} />
            ))}
          </div>
        )}
      </div>
      {showAdd && <AddOnboardingModal onClose={() => setShowAdd(false)} onCreated={() => { setShowAdd(false); load() }} />}
    </div>
  )
}

function AddOnboardingModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', dept: '', team: '', rank: '', track: '사무', join_date: '', mentor: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)

    // 1) 승진포인트 대상 employees 레코드 생성 (기본값: 연차 0, 체류연한 4년, 기준 24P — 필요시 포인트 현황에서 조정)
    const { data: emp, error: e1 } = await supabase
      .from('employees')
      .insert({
        name: form.name, dept: form.dept, team: form.team || null, rank: form.rank,
        track: form.track, role: '팀원', level: 0, req_tenure: 0, threshold: 0, base_pts: 0,
      })
      .select()
      .single()
    if (e1) { setError(e1.message); setSaving(false); return }

    // 2) 온보딩 레코드 생성
    const { data: ob, error: e2 } = await supabase
      .from('onboarding')
      .insert({ employee_id: emp.id, join_date: form.join_date, mentor: form.mentor || null })
      .select()
      .single()
    if (e2) { setError(e2.message); setSaving(false); return }

    // 3) 기본 체크리스트 생성
    const tasks = DEFAULT_TASKS.map((t, i) => ({ onboarding_id: ob.id, task_name: t, done: false, sort_order: i }))
    const { error: e3 } = await supabase.from('onboarding_tasks').insert(tasks)
    setSaving(false)
    if (e3) { setError(e3.message); return }
    onCreated()
  }

  return (
    <Modal title="온보딩 대상 추가" onClose={onClose}>
      <form onSubmit={submit}>
        <label style={lbl}>이름</label>
        <input style={field} required value={form.name} onChange={set('name')} />
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}><label style={lbl}>부서</label><input style={field} required value={form.dept} onChange={set('dept')} /></div>
          <div style={{ flex: 1 }}><label style={lbl}>팀</label><input style={field} value={form.team} onChange={set('team')} /></div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}><label style={lbl}>직급</label><input style={field} value={form.rank} onChange={set('rank')} /></div>
          <div style={{ flex: 1 }}>
            <label style={lbl}>직군</label>
            <select style={field} value={form.track} onChange={set('track')}>
              <option value="사무">사무</option><option value="연구">연구</option>
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}><label style={lbl}>입사일</label><input style={field} type="date" required value={form.join_date} onChange={set('join_date')} /></div>
          <div style={{ flex: 1 }}><label style={lbl}>멘토</label><input style={field} value={form.mentor} onChange={set('mentor')} /></div>
        </div>
        <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 10 }}>체크리스트 8개 항목이 기본으로 생성됩니다.</div>
        {error && <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 10 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <button type="button" style={btnGhost} onClick={onClose}>취소</button>
          <button type="submit" style={btnPrimary} disabled={saving}>{saving ? '저장 중…' : '추가'}</button>
        </div>
      </form>
    </Modal>
  )
}
