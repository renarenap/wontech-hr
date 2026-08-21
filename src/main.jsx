import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/tokens.css'

// Supabase의 비밀번호 재설정/이메일 인증 리다이렉트가 (Redirect URL 허용목록 설정에 따라)
// 우리 앱의 해시 경로(#/reset-password) 없이 그냥 사이트 루트 + '?code=...'로 떨어질 때가 있다.
// HashRouter는 '#' 뒤만 라우팅하므로 이 경우 code를 못 읽고 그냥 로그인 화면으로 빠진다.
// 그래서 진짜 쿼리스트링에 code/error가 있는데 해시가 비어있으면, 해시 라우트 쪽으로 옮겨준다.
function fixMisdeliveredAuthRedirect() {
  const search = window.location.search
  const hasAuthParam = /[?&](code|error)=/.test(search)
  const alreadyOnResetPage = window.location.hash.includes('reset-password')
  if (hasAuthParam && !alreadyOnResetPage) {
    window.location.replace(window.location.pathname + '#/reset-password' + search)
    return true
  }
  return false
}

if (!fixMisdeliveredAuthRedirect()) {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}
