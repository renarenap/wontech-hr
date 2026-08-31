// Edge Function: notify-download
// 전체 직원 CSV를 다운로드할 때마다 프론트에서 호출 — 다운로드 기록을 csv_download_log에 남기고,
// 다운로드한 사람이 관리자 본인이 아니면 관리자에게 이메일로 알립니다.
//
// 이메일 발송은 Resend(https://resend.com)를 씁니다. 배포 전에 Supabase 시크릿 설정 필요:
//   supabase secrets set RESEND_API_KEY=re_xxxxxxxx
//   supabase secrets set ADMIN_NOTIFY_EMAIL=wowbagger12@gmail.com
// 배포: supabase functions deploy notify-download
//
// RESEND_API_KEY/ADMIN_NOTIFY_EMAIL이 설정 안 돼있으면 로그만 남기고 이메일은 조용히 건너뜁니다
// (즉 이 함수를 배포만 하고 시크릿을 안 넣어도 앱이 깨지진 않아요).
//
// 요청 형식: POST { rowCount: number }

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
    const resendKey = Deno.env.get('RESEND_API_KEY')
    const adminEmail = Deno.env.get('ADMIN_NOTIFY_EMAIL')

    // 호출자가 실제로 로그인된 사용자인지만 확인(관리자 여부는 안 따짐 — 누구나 다운로드는 하니까)
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: callerData, error: callerErr } = await callerClient.auth.getUser()
    if (callerErr || !callerData?.user) {
      return json({ error: '로그인한 계정만 이용할 수 있습니다.' }, 401)
    }

    const body = await req.json().catch(() => ({}))
    const rowCount = Number(body.rowCount) || 0
    const userEmail = callerData.user.email || '(알수없음)'

    // 1) 다운로드 로그 기록 (service role로 — 로그 테이블은 관리자만 조회 가능한 RLS라 우회 필요)
    const adminClient = createClient(supabaseUrl, serviceKey)
    await adminClient.from('csv_download_log').insert({ user_email: userEmail, row_count: rowCount })

    // 2) 관리자 본인이 다운로드한 거면 알림 스킵
    if (adminEmail && userEmail.toLowerCase() === adminEmail.toLowerCase()) {
      return json({ ok: true, notified: false }, 200)
    }

    // 3) 이메일 발송 시크릿 미설정이면 로그만 남기고 조용히 종료
    if (!resendKey || !adminEmail) {
      return json({ ok: true, notified: false, reason: 'email not configured' }, 200)
    }

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'WONTECH HR <onboarding@resend.dev>',
        to: [adminEmail],
        subject: `[승진포인트] ${userEmail}님이 전체 명단 CSV를 다운로드했어요`,
        text: `${userEmail} 님이 ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}에 전체 직원 데이터(${rowCount}명)를 CSV로 다운로드했습니다.`,
      }),
    })
    if (!emailRes.ok) {
      const errText = await emailRes.text()
      return json({ ok: true, notified: false, reason: errText }, 200)
    }
    return json({ ok: true, notified: true }, 200)
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
