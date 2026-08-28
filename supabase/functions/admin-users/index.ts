// Edge Function: admin-users
// 로그인한 사용자만 호출할 수 있으며, service role 권한으로 계정을 조회/생성/수정/삭제합니다.
// service role 키는 이 함수 안에서만 쓰이고 브라우저(프론트엔드)에는 절대 노출되지 않습니다.
//
// 배포: supabase functions deploy admin-users
// (SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY는 Supabase가 자동으로 주입합니다)
//
// 요청 형식: POST { action: 'list'|'create'|'update'|'delete'|'reset_password', ...payload }

import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

function toUserRow(u: any) {
  const meta = u.user_metadata || {}
  return {
    id: u.id,
    email: u.email,
    name: meta.name || '',
    dept: meta.dept || '',
    rank: meta.rank || '',
    role: meta.role || '부서원',
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }
  if (req.method !== 'POST') {
    return json({ error: 'POST만 지원합니다.' }, 405)
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace('Bearer ', '').trim()
    if (!token) return json({ error: '로그인 후 이용해주세요.' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // 호출자가 실제로 로그인된 사용자인지 검증 (anon 클라이언트 + 호출자 토큰)
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: callerData, error: callerErr } = await callerClient.auth.getUser()
    if (callerErr || !callerData?.user) {
      return json({ error: '로그인한 계정만 이용할 수 있습니다.' }, 401)
    }

    const body = await req.json().catch(() => ({}))
    const action = body.action
    const adminClient = createClient(supabaseUrl, serviceKey)

    if (action === 'list') {
      const users: any[] = []
      let page = 1
      // 페이지네이션 순회 (기본 perPage 1000이면 대부분 한 번에 끝남)
      while (true) {
        const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 })
        if (error) return json({ error: error.message }, 400)
        users.push(...data.users)
        if (data.users.length < 1000) break
        page += 1
      }
      return json({ ok: true, users: users.map(toUserRow) }, 200)
    }

    if (action === 'create') {
      const email = (body.email || '').trim()
      const password = body.password || ''
      if (!email || !password) return json({ error: '이메일과 비밀번호를 입력하세요.' }, 400)
      if (password.length < 8) return json({ error: '비밀번호는 8자 이상이어야 합니다.' }, 400)
      const { data, error } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          name: body.name || '',
          dept: body.dept || '',
          rank: body.rank || '',
          role: body.role || '부서원',
        },
      })
      if (error) return json({ error: error.message }, 400)
      return json({ ok: true, user: toUserRow(data.user) }, 200)
    }

    if (action === 'update') {
      const id = body.id
      if (!id) return json({ error: 'id가 필요합니다.' }, 400)
      const { data, error } = await adminClient.auth.admin.updateUserById(id, {
        user_metadata: {
          name: body.name || '',
          dept: body.dept || '',
          rank: body.rank || '',
          role: body.role || '부서원',
        },
      })
      if (error) return json({ error: error.message }, 400)
      return json({ ok: true, user: toUserRow(data.user) }, 200)
    }

    if (action === 'reset_password') {
      const id = body.id
      const password = body.password || ''
      if (!id || !password) return json({ error: 'id와 새 비밀번호가 필요합니다.' }, 400)
      if (password.length < 8) return json({ error: '비밀번호는 8자 이상이어야 합니다.' }, 400)
      const { error } = await adminClient.auth.admin.updateUserById(id, { password })
      if (error) return json({ error: error.message }, 400)
      return json({ ok: true }, 200)
    }

    if (action === 'delete') {
      const id = body.id
      if (!id) return json({ error: 'id가 필요합니다.' }, 400)
      if (id === callerData.user.id) return json({ error: '본인 계정은 삭제할 수 없습니다.' }, 400)
      const { error } = await adminClient.auth.admin.deleteUser(id)
      if (error) return json({ error: error.message }, 400)
      return json({ ok: true }, 200)
    }

    return json({ error: '알 수 없는 action 입니다.' }, 400)
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
