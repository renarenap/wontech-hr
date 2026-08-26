import { useState } from 'react'
import { GRADE_COLOR, STATUS_LABEL, G, P, Y, R, B, O } from '../lib/constants'

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

// 저장된 등급을 그대로 보여줌 — '23~'25 반기 기록은 S/A+/A/B+/B/C/D, '26년~ 기록은 EX/VG/GD/NI/UN
// (연도별로 다른 체계를 썼던 걸 하나로 바꿔 보여주면 오히려 헷갈려서 변환 안 함)
export function GB({ grade }) {
  const g = grade || '0'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 22, borderRadius: 5, fontSize: 10, fontWeight: 700, color: '#fff', background: GRADE_COLOR[g] || '#cbd5e1', marginRight: 2 }}>
      {g}
    </span>
  )
}

export function SB({ status }) {
  const c = STATUS_LABEL[status] || STATUS_LABEL.short
  return <Bd color={c.color} bg={c.bg}>{c.label}</Bd>
}

// 연차를 체류연한 기준으로 칸칸이 채워지는 막대(에너지바)로 보여줌. 기준을 넘긴 연차는 +N 뱃지로 눈에 띄게 표시.
export function TenureBar({ level, reqTenure }) {
  if (!reqTenure || reqTenure <= 0) return <span style={{ fontSize: 11, color: '#94a3b8' }}>해당없음</span>
  const lvl = level || 0
  const met = lvl >= reqTenure
  const filled = Math.min(lvl, reqTenure)
  const overflow = Math.max(0, lvl - reqTenure)
  const color = met ? G : Y
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ display: 'flex', gap: 2 }}>
        {Array.from({ length: reqTenure }).map((_, i) => (
          <div key={i} style={{ width: 12, height: 10, borderRadius: 2, background: i < filled ? color : '#e5e7eb' }} />
        ))}
      </div>
      {overflow > 0 && (
        <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', background: O, borderRadius: 10, padding: '1px 6px', whiteSpace: 'nowrap' }}>
          +{overflow}
        </span>
      )}
      <span style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
        <span style={{ color: overflow > 0 ? O : color, fontWeight: overflow > 0 ? 900 : 700 }}>{lvl}</span>
        <span style={{ color: '#94a3b8', fontWeight: 700 }}>/{reqTenure}년</span>
        {met && <span style={{ color: G, marginLeft: 3 }}>✓</span>}
      </span>
    </div>
  )
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

// 세부항목에 마우스를 올리면 예시/부연설명을 보여주는 툴팁
export function Tip({ children, content, width = 260 }) {
  const [show, setShow] = useState(false)
  if (!content) return children
  return (
    <span
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'help' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <span style={{ borderBottom: '1px dashed #cbd5e1' }}>{children}</span>
      <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700 }}>ⓘ</span>
      {show && (
        <span
          style={{
            position: 'absolute', bottom: 'calc(100% + 8px)', left: 0, zIndex: 30, width,
            background: '#1e293b', color: '#e2e8f0', fontSize: 11, lineHeight: 1.6,
            padding: '10px 12px', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.22)',
            whiteSpace: 'normal', fontWeight: 400, cursor: 'auto',
          }}
        >
          {content}
        </span>
      )}
    </span>
  )
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

// ═══ 로그인/가입/비밀번호 재설정 등 인증 화면 공통 요소 ═══
export const authInput = { width: '100%', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }
export const authLabel = { display: 'block', fontSize: 11, color: '#64748b', marginBottom: 6, fontWeight: 600 }
export const authBtn = { width: '100%', background: O, color: '#fff', border: 'none', borderRadius: 8, padding: '11px 0', fontSize: 13, fontWeight: 700, cursor: 'pointer' }

export function AuthShell({ children }) {
  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface)' }}>
      <div style={{ width: 340, background: '#fff', border: '1px solid var(--border)', borderRadius: 16, padding: '36px 32px', boxShadow: '0 4px 24px rgba(0,0,0,.06)' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: O, letterSpacing: 1 }}>WONTECH</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>HR 관리 시스템</div>
        </div>
        {children}
      </div>
    </div>
  )
}

// ═══ 폼 / 모달 공통 요소 ═══
export const field = { width: '100%', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', marginBottom: 10, boxSizing: 'border-box' }
export const label = { display: 'block', fontSize: 11, color: '#64748b', marginBottom: 5, fontWeight: 600 }
export const btnPrimary = { background: O, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }
export const btnGhost = { background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 16px', fontSize: 12, color: '#64748b', cursor: 'pointer' }
export const btnDanger = { ...btnGhost, color: '#dc2626', borderColor: '#fecaca' }

export function Modal({ title, onClose, children, width = 380 }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width, maxWidth: '92vw', maxHeight: '86vh', overflow: 'auto', background: '#fff', borderRadius: 14, padding: 24, boxShadow: '0 12px 40px rgba(0,0,0,.18)' }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>{title}</div>
        {children}
      </div>
    </div>
  )
}

export function AddButton({ children = '+ 추가', onClick }) {
  return <button style={btnPrimary} onClick={onClick}>{children}</button>
}
