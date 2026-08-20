import { GRADE_LABEL, GRADE_COLOR, STATUS_LABEL, G, P, Y, R, B } from '../lib/constants'

// ═══ 공통 스타일 ═══
export const thS = {
  textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text-sub)',
  borderBottom: '2px solid var(--border)', position: 'sticky', top: 0, background: '#fff',
  whiteSpace: 'nowrap', zIndex: 1,
}
export const tdS = { padding: '10px 12px', borderBottom: '1px solid #f1f5f9', fontSize: 12, whiteSpace: 'nowrap' }
export const crd = {
  background: '#fff', borderRadius: 12, border: '1px solid var(--border)', padding: '20px 24px',
  marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,.04)',
}
export const inp = {
  background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 14px',
  color: 'var(--text)', fontSize: 12, outline: 'none',
}

// ═══ 공통 컴포넌트 ═══
export function Bd({ children, color, bg }) {
  return (
    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, color, background: bg, whiteSpace: 'nowrap' }}>
      {children}
    </span>
  )
}

export function GB({ grade }) {
  const g = grade || '0'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 22, borderRadius: 5, fontSize: 10, fontWeight: 700, color: '#fff', background: GRADE_COLOR[g] || '#cbd5e1', marginRight: 2 }}>
      {GRADE_LABEL[g] || g}
    </span>
  )
}

export function SB({ status }) {
  const c = STATUS_LABEL[status] || STATUS_LABEL.short
  return <Bd color={c.color} bg={c.bg}>{c.label}</Bd>
}

export function Prog({ current, max, showLabel = true }) {
  const pct = max > 0 ? (current / max) * 100 : 0
  const color = pct >= 100 ? G : pct >= 70 ? P : pct >= 40 ? Y : R
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 120 }}>
      <div style={{ flex: 1, height: 7, borderRadius: 4, background: '#f1f5f9' }}>
        <div style={{ height: 7, borderRadius: 4, background: color, width: `${Math.min(100, pct)}%`, transition: 'width .4s' }} />
      </div>
      {showLabel && <span style={{ fontSize: 11, color, fontWeight: 700, minWidth: 50, textAlign: 'right' }}>{current}/{max}</span>}
    </div>
  )
}

export function KpiRow({ items }) {
  return (
    <div style={{ display: 'flex', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
      {items.map(({ v, l, c }) => (
        <div key={l} style={{ flex: '1 1 130px', background: '#fff', borderRadius: 12, border: '1px solid var(--border)', padding: '18px 22px', boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: c, lineHeight: 1 }}>{v}</div>
          <div style={{ fontSize: 11, color: 'var(--text-sub)', marginTop: 5, fontWeight: 500 }}>{l}</div>
        </div>
      ))}
    </div>
  )
}

export function Check({ done, label, onToggle }) {
  return (
    <div
      onClick={onToggle}
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px', borderBottom: '1px solid #f1f5f9', cursor: onToggle ? 'pointer' : 'default' }}
    >
      <div style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${done ? G : '#d1d5db'}`, background: done ? '#dcfce7' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: G, flexShrink: 0 }}>
        {done ? '✓' : ''}
      </div>
      <span style={{ fontSize: 12, color: done ? '#94a3b8' : 'var(--text)', textDecoration: done ? 'line-through' : 'none' }}>{label}</span>
    </div>
  )
}

export function DdayBd({ d }) {
  return (
    <Bd color={d <= 0 ? R : d <= 7 ? Y : d <= 30 ? B : 'var(--text-sub)'} bg={d <= 0 ? '#fee2e2' : d <= 7 ? '#fef9c3' : d <= 30 ? '#e0f2fe' : '#f1f5f9'}>
      {d <= 0 ? `D${d}` : `D-${d}`}
    </Bd>
  )
}

export function dDayFrom(dateStr) {
  const d = new Date(dateStr)
  const n = new Date()
  n.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  return Math.ceil((d - n) / 864e5)
}

export function Loading() {
  return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-sub)', fontSize: 13 }}>불러오는 중…</div>
}

export function ErrorBox({ error }) {
  if (!error) return null
  return (
    <div style={{ ...crd, borderColor: '#fecaca', background: '#fef2f2', color: '#b91c1c', fontSize: 12 }}>
      오류가 발생했습니다: {error.message || String(error)}
    </div>
  )
}

export function EmptyState({ label = '데이터가 없습니다' }) {
  return <div style={{ padding: 30, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>{label}</div>
}
