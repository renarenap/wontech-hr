import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { supabase } from '../supabaseClient'
import { O, P } from '../lib/constants'

const NAV = [
  { to: '/', icon: '📊', label: '대시보드', g: '승진포인트', end: true },
  { to: '/employees', icon: '👥', label: '포인트 현황', g: '승진포인트' },
  { to: '/criteria', icon: '📋', label: '기준표', g: '승진포인트' },
  { to: '/hire-resign', icon: '🔁', label: '입·퇴사 관리', g: '인사관리' },
  { to: '/transfer', icon: '🔀', label: '발령', g: '인사관리' },
  { to: '/recruit', icon: '📢', label: '채용현황', g: '채용' },
  { to: '/accounts', icon: '🔑', label: '계정 관리', g: '관리자' },
]

const TITLES = {
  '/': '승진포인트 대시보드',
  '/employees': '승진포인트 현황',
  '/criteria': '기준표',
  '/recruit': '채용 현황',
  '/hire-resign': '입·퇴사 관리',
  '/transfer': '발령 관리',
  '/accounts': '계정 관리',
}

function pageTitle(pathname) {
  if (pathname.startsWith('/employees/')) return '직원 상세'
  return TITLES[pathname] || 'WONTECH HR'
}

// 이번 달 1일 ~ 다음 달 1일 (로컬 기준) 문자열 범위
function monthRange() {
  const now = new Date()
  const y = now.getFullYear(), m = now.getMonth()
  const pad = (n) => String(n).padStart(2, '0')
  const start = `${y}-${pad(m + 1)}-01`
  const nextY = m === 11 ? y + 1 : y
  const nextM = m === 11 ? 1 : m + 2
  const end = `${nextY}-${pad(nextM)}-01`
  return { start, end }
}

// 앱 전체에서 "이 데이터가 언제 기준인지" 감 잡을 수 있도록 하는 상단 요약
function useHrSummary() {
  const [summary, setSummary] = useState(null)

  useEffect(() => {
    let cancelled = false
    const { start, end } = monthRange()

    async function load() {
      const [
        totalRes,
        hiresRes,
        resignsRes,
        empLatest,
        archiveLatest,
      ] = await Promise.all([
        supabase.from('employees').select('id', { count: 'exact', head: true }),
        supabase.from('hires').select('id', { count: 'exact', head: true }).gte('join_date', start).lt('join_date', end),
        supabase.from('employees_archive').select('id', { count: 'exact', head: true }).gte('resign_date', start).lt('resign_date', end),
        supabase.from('employees').select('created_at').order('created_at', { ascending: false }).limit(1),
        supabase.from('employees_archive').select('archived_at').order('archived_at', { ascending: false }).limit(1),
      ])
      if (cancelled) return

      const dates = [empLatest.data?.[0]?.created_at, archiveLatest.data?.[0]?.archived_at].filter(Boolean)
      const asOf = dates.length ? dates.sort().slice(-1)[0].slice(0, 10) : null

      setSummary({
        total: totalRes.count ?? null,
        hiresThisMonth: hiresRes.count ?? null,
        resignsThisMonth: resignsRes.count ?? null,
        asOf,
      })
    }
    load()
    return () => { cancelled = true }
  }, [])

  return summary
}

function HeaderStats() {
  const s = useHrSummary()
  if (!s) return null
  return (
    <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500, marginLeft: 12 }}>
      {s.asOf && `기준일 ${s.asOf} · `}총 {s.total ?? '—'}명 · 이번달 입사 {s.hiresThisMonth ?? '—'} · 퇴사 {s.resignsThisMonth ?? '—'}
    </span>
  )
}

export default function Layout() {
  const { user, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const groups = [...new Set(NAV.map((n) => n.g))]
  const initial = (user?.email || '?').charAt(0).toUpperCase()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--surface)', color: 'var(--text)', fontSize: 13, overflow: 'hidden' }}>
      <div style={{ width: 220, background: '#fff', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div
          onClick={() => navigate('/')}
          style={{ padding: '22px 20px 18px', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
        >
          <div style={{ fontSize: 16, fontWeight: 800, color: O, letterSpacing: 1 }}>WONTECH</div>
          <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3 }}>HR 관리 시스템</div>
        </div>
        <div style={{ flex: 1, padding: '10px 10px', overflow: 'auto' }}>
          {groups.map((g) => (
            <div key={g}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', padding: '14px 14px 6px', letterSpacing: 1 }}>{g}</div>
              {NAV.filter((n) => n.g === g).map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.end}
                  style={({ isActive }) => ({
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8,
                    cursor: 'pointer', fontSize: 13, fontWeight: isActive ? 600 : 400,
                    color: isActive ? O : '#64748b', background: isActive ? 'var(--sidebar-active-bg)' : 'transparent',
                    textDecoration: 'none', marginBottom: 1,
                  })}
                >
                  <span style={{ width: 20, textAlign: 'center', fontSize: 14 }}>{n.icon}</span>
                  {n.label}
                </NavLink>
              ))}
            </div>
          ))}
        </div>
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', fontSize: 10, color: '#94a3b8' }}>
          v1.0 · HR Management System
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ height: 54, padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', background: '#fff', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline' }}>
            <span style={{ fontSize: 17, fontWeight: 700 }}>{pageTitle(location.pathname)}</span>
            <HeaderStats />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>{user?.email}</span>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: P, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff' }}>
              {initial}
            </div>
            <button
              onClick={handleSignOut}
              style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 14px', color: '#64748b', fontSize: 11, cursor: 'pointer' }}
            >
              로그아웃
            </button>
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '24px 28px' }}>
          <Outlet />
        </div>
      </div>
    </div>
  )
}
