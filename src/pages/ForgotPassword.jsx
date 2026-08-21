import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { AuthShell, authInput, authLabel, authBtn } from '../components/ui'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}#/reset-password`
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
    setLoading(false)
    // 존재하지 않는 이메일이어도 동일하게 성공 처리 (계정 존재 여부 노출 방지)
    if (error) { setError(error.message); return }
    setSent(true)
  }

  if (sent) {
    return (
      <AuthShell>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>이메일을 확인해주세요 📩</div>
          <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.7, marginBottom: 24 }}>
            <b>{email}</b>로 재설정 링크를 보냈어요.<br />
            <b>요청한 브라우저에서</b> 메일의 링크를 눌러 새 비밀번호를 설정해주세요.
          </div>
          <Link to="/login" style={{ ...authBtn, display: 'block', textDecoration: 'none', boxSizing: 'border-box' }}>로그인 화면으로</Link>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6, marginBottom: 20, textAlign: 'center' }}>
        가입하신 이메일을 입력하시면<br />비밀번호 재설정 링크를 보내드려요.
      </div>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 20 }}>
          <label style={authLabel}>이메일</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@wontech.co.kr" style={authInput} />
        </div>
        {error && <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 14 }}>{error}</div>}
        <button type="submit" disabled={loading} style={{ ...authBtn, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1 }}>
          {loading ? '보내는 중…' : '재설정 이메일 보내기'}
        </button>
        <div style={{ marginTop: 16, fontSize: 11, color: '#94a3b8', textAlign: 'center' }}>
          <Link to="/login" style={{ color: '#94a3b8', textDecoration: 'none' }}>← 로그인으로 돌아가기</Link>
        </div>
      </form>
    </AuthShell>
  )
}
