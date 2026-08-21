import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { AuthShell, authInput, authLabel, authBtn } from '../components/ui'

export default function ResetPassword() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState('exchanging') // exchanging | ready | invalid
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const code = params.get('code')
    if (!code) { setStatus('invalid'); return }
    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      setStatus(error ? 'invalid' : 'ready')
    })
  }, [params])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('비밀번호는 8자 이상이어야 합니다.'); return }
    if (password !== password2) { setError('비밀번호가 일치하지 않습니다.'); return }
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (error) { setError(error.message); return }
    setDone(true)
    setTimeout(() => navigate('/', { replace: true }), 1500)
  }

  if (status === 'exchanging') {
    return (
      <AuthShell>
        <div style={{ textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>확인 중…</div>
      </AuthShell>
    )
  }

  if (status === 'invalid') {
    return (
      <AuthShell>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, color: '#dc2626' }}>링크가 유효하지 않아요</div>
          <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.7, marginBottom: 24 }}>
            이미 사용된 링크이거나 만료됐어요.<br />요청했던 브라우저가 맞는지도 확인해주세요.
          </div>
          <Link to="/forgot-password" style={{ ...authBtn, display: 'block', textDecoration: 'none', boxSizing: 'border-box' }}>다시 요청하기</Link>
        </div>
      </AuthShell>
    )
  }

  if (done) {
    return (
      <AuthShell>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>비밀번호가 변경됐어요 ✅</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>잠시 후 대시보드로 이동합니다…</div>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 18, textAlign: 'center' }}>새 비밀번호 설정</div>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 14 }}>
          <label style={authLabel}>새 비밀번호</label>
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="8자 이상" style={authInput} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={authLabel}>새 비밀번호 확인</label>
          <input type="password" required value={password2} onChange={(e) => setPassword2(e.target.value)} style={authInput} />
        </div>
        {error && <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 14 }}>{error}</div>}
        <button type="submit" disabled={saving} style={{ ...authBtn, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1 }}>
          {saving ? '저장 중…' : '비밀번호 변경'}
        </button>
      </form>
    </AuthShell>
  )
}
