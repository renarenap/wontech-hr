import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { AuthShell, authInput, authLabel, authBtn } from '../components/ui'

export default function Signup() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [dept, setDept] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(null) // 'session' | 'needsConfirm'
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다.')
      return
    }
    if (password !== password2) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }
    setLoading(true)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, dept, rank: '', role: '팀원' } },
    })
    setLoading(false)
    if (error) {
      setError(error.message.includes('already registered') ? '이미 가입된 이메일입니다.' : error.message)
      return
    }
    if (data.session) {
      // 프로젝트에서 이메일 인증을 요구하지 않는 경우 → 가입과 동시에 로그인됨
      navigate('/', { replace: true })
      return
    }
    setDone('needsConfirm')
  }

  if (done === 'needsConfirm') {
    return (
      <AuthShell>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>가입 신청 완료 🎉</div>
          <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.7, marginBottom: 24 }}>
            <b>{email}</b>로 인증 메일을 보냈어요.<br />메일함(스팸함 포함)에서 링크를 눌러 인증을 완료한 뒤 로그인해주세요.
          </div>
          <Link to="/login" style={{ ...authBtn, display: 'block', textDecoration: 'none', boxSizing: 'border-box' }}>로그인 화면으로</Link>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 14 }}>
          <label style={authLabel}>이메일</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@wontech.co.kr" style={authInput} />
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <label style={authLabel}>이름</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} style={authInput} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={authLabel}>부서</label>
            <input value={dept} onChange={(e) => setDept(e.target.value)} style={authInput} />
          </div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={authLabel}>비밀번호</label>
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="8자 이상" style={authInput} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={authLabel}>비밀번호 확인</label>
          <input type="password" required value={password2} onChange={(e) => setPassword2(e.target.value)} style={authInput} />
        </div>
        {error && <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 14 }}>{error}</div>}
        <button type="submit" disabled={loading} style={{ ...authBtn, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1 }}>
          {loading ? '가입 처리 중…' : '가입하기'}
        </button>
        <div style={{ marginTop: 16, fontSize: 11, color: '#94a3b8', textAlign: 'center' }}>
          이미 계정이 있으신가요? <Link to="/login" style={{ color: '#FF4800', fontWeight: 600, textDecoration: 'none' }}>로그인</Link>
        </div>
      </form>
    </AuthShell>
  )
}
