import { supabase } from '../supabaseClient'

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users`

// admin-users Edge Function 호출 헬퍼. 항상 현재 로그인 세션의 access_token을 실어 보냅니다.
export async function callAdminUsers(payload) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('로그인이 필요합니다.')

  const res = await fetch(FUNCTIONS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(payload),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok || body.error) {
    throw new Error(body.error || `요청에 실패했습니다 (${res.status})`)
  }
  return body
}
