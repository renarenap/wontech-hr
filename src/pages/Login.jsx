import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { AuthShell, authInput, authLabel, authBtn } from '../components/ui'

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
    <AuthShell>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 14 }}>
          <label style={authLabel}>이메일</label>
          <input
            type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="name@wontech.co.kr" style={authInput}
          />
        </div>
        <div style={{ marginBottom: 8 }}>
          <label style={authLabel}>비밀번호</label>
          <input
            type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••" style={authInput}
          />
        </div>
        <div style={{ textAlign: 'right', marginBottom: 20 }}>
          <Link to="/forgot-password" style={{ fontSize: 11, color: '#94a3b8', textDecoration: 'none' }}>비밀번호를 잊으셨나요?</Link>
        </div>
        {error && <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 14 }}>{error}</div>}
        <button type="submit" disabled={loading} style={{ ...authBtn, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1 }}>
          {loading ? '로그인 중…' : '로그인'}
        </button>
        <div style={{ marginTop: 16, fontSize: 11, color: '#94a3b8', textAlign: 'center' }}>
          계정이 없으신가요? <Link to="/signup" style={{ color: '#FF4800', fontWeight: 600, textDecoration: 'none' }}>가입하기</Link>
        </div>
      </form>
    </AuthShell>
  )
}
