// ═══ 비고(근태 등 특이사항) 이력 — note(레거시 단일 텍스트) 대신, eval_comments와 같은 방식으로
// 날짜 찍어 계속 추가해나가는 시계열 로그. 목록에 뜨는 +/-/o 요약(employees.note_flag)은 별개 필드. ═══
import { supabase } from '../supabaseClient'

// 최신순(날짜 내림차순 → 같은 날짜면 최근 입력분 먼저)으로 반환
export async function fetchNoteEntries(employeeId) {
  const { data, error } = await supabase
    .from('note_entries')
    .select('*')
    .eq('employee_id', employeeId)
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function addNoteEntry(employeeId, entryDate, text) {
  const { error } = await supabase.from('note_entries').insert({
    employee_id: employeeId,
    entry_date: entryDate || new Date().toISOString().slice(0, 10),
    text,
  })
  if (error) throw error
}

export async function deleteNoteEntry(id) {
  const { error } = await supabase.from('note_entries').delete().eq('id', id)
  if (error) throw error
}
