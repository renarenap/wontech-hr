import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { P, G, O, Y } from '../lib/constants'
import { Bd, Check, KpiRow, Prog, crd, thS, tdS, Loading, ErrorBox, EmptyState } from '../components/ui'

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

export default function Onboarding() {
  const [list, setList] = useState(null)
  const [error, setError] = useState(null)
  const [sel, setSel] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error } = await supabase
        .from('onboarding')
        .select('*, employees(name, dept, team, rank), onboarding_tasks(*)')
        .order('join_date', { ascending: false })
      if (cancelled) return
      if (error) { setError(error); return }
      setList((data || []).map(withDerived))
    }
    load()
    return () => { cancelled = true }
  }, [])

  const toggle = async (taskId, current) => {
    setList(list.map((o) => (
      o.id === sel
        ? withDerived({ ...o, onboarding_tasks: o.tasks.map((t) => (t.id === taskId ? { ...t, done: !current } : t)) })
        : o
    )))
    const { error } = await supabase.from('onboarding_tasks').update({ done: !current }).eq('id', taskId)
    if (error) setError(error)
  }

  if (error) return <ErrorBox error={error} />
  if (!list) return <Loading />

  const s = list.find((o) => o.id === sel)

  return (
    <div>
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
              <thead><tr>{['이름', '소속', '직급', '입사일', 'D+', '멘토', '진행률'].map((h) => <th key={h} style={thS}>{h}</th>)}</tr></thead>
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
    </div>
  )
}
