import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // eslint-disable-next-line no-console
  console.error(
    'Supabase 환경변수가 설정되지 않았습니다. .env 파일에 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 를 설정하세요.'
  )
}

// flowType: 'pkce' — 비밀번호 재설정/이메일 인증 링크가 '#access_token=...' 형태 대신
// '?code=...' 형태로 오게 되어, HashRouter(#/경로)와 충돌하지 않습니다.
export const supabase = createClient(url, anonKey, {
  auth: { flowType: 'pkce' },
})
