// ═══ 정성평가 코멘트 이력 — 연도 하나짜리 단일 텍스트가 아니라, 날짜 찍어 계속 추가해나가는 시계열 로그 ═══
import { supabase } from '../supabaseClient'

// 최신순(날짜 내림차순 → 같은 날짜면 최근 입력분 먼저)으로 반환
export async function fetchEvalComments(employeeId) {
  const { data, error } = await supabase
    .from('eval_comments')
    .select('*')
    .eq('employee_id', employeeId)
    .order('comment_date', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function addEvalComment(employeeId, commentDate, text) {
  const { error } = await supabase.from('eval_comments').insert({
    employee_id: employeeId,
    comment_date: commentDate || new Date().toISOString().slice(0, 10),
    text,
  })
  if (error) throw error
}

export async function deleteEvalComment(id) {
  const { error } = await supabase.from('eval_comments').delete().eq('id', id)
  if (error) throw error
}
