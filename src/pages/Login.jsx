import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { O } from '../lib/constants'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      setError('이메일 또는 비밀번호가 올바르지 않습니다.')
      return
    }
    const dest = location.state?.from?.pathname || '/'
    navigate(dest, { replace: true })
  }

  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface)' }}>
      <form onSubmit={handleSubmit} style={{ width: 340, background: '#fff', border: '1px solid var(--border)', borderRadius: 16, padding: '36px 32px', boxShadow: '0 4px 24px rgba(0,0,0,.06)' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: O, letterSpacing: 1 }}>WONTECH</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>HR 관리 시스템</div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 6, fontWeight: 600 }}>이메일</label>
          <input
            type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="name@wontech.co.kr"
            style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 13, outline: 'none' }}
          />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 6, fontWeight: 600 }}>비밀번호</label>
          <input
            type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 13, outline: 'none' }}
          />
        </div>
        {error && <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 14 }}>{error}</div>}
        <button
          type="submit" disabled={loading}
          style={{ width: '100%', background: O, color: '#fff', border: 'none', borderRadius: 8, padding: '11px 0', fontSize: 13, fontWeight: 700, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1 }}
        >
          {loading ? '로그인 중…' : '로그인'}
        </button>
        <div style={{ marginTop: 16, fontSize: 11, color: '#94a3b8', textAlign: 'center' }}>
          계정이 없으신가요? 인사팀 관리자에게 초대를 요청하세요.
        </div>
      </form>
    </div>
  )
}
