// ═══ 연차 일괄 +1 — 기준년도 추적 + 되돌리기(undo) ═══
import { supabase } from '../supabaseClient'

export async function fetchLevelReferenceYear() {
  const { data, error } = await supabase.from('point_settings').select('level_reference_year').eq('id', 1).maybeSingle()
  if (error) throw error
  return Number(data?.level_reference_year) || new Date().getFullYear()
}

// 아직 되돌리지 않은 것 중 가장 최근 배치 — "되돌리기" 버튼을 보여줄지 판단하는 데 씀
export async function fetchLatestBumpBatch() {
  const { data, error } = await supabase
    .from('level_bump_batches')
    .select('*')
    .is('undone_at', null)
    .order('applied_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

// items: [{ employeeId, oldLevel, newLevel, freeze: null | heldPoints }]
export async function applyLevelBump(items, previousYear, newYear, appliedBy) {
  const { data: batch, error: e1 } = await supabase
    .from('level_bump_batches')
    .insert({ previous_reference_year: previousYear, new_reference_year: newYear, applied_by: appliedBy })
    .select()
    .single()
  if (e1) throw e1

  for (const it of items) {
    let pendingLogId = null
    if (it.freeze != null) {
      const { error: eLevel } = await supabase.from('employees').update({
        level: it.newLevel, has_pending_backfill: true, pending_points: it.freeze, pending_resolved: false, pending_release_points: 0,
      }).eq('id', it.employeeId)
      if (eLevel) throw eLevel
      const { data: log, error: eLog } = await supabase.from('pending_point_log')
        .insert({ employee_id: it.employeeId, event_type: 'frozen', held_points: it.freeze, changed_by: appliedBy })
        .select()
        .single()
      if (eLog) throw eLog
      pendingLogId = log.id
    } else {
      const { error: eLevel } = await supabase.from('employees').update({ level: it.newLevel }).eq('id', it.employeeId)
      if (eLevel) throw eLevel
    }
    const { error: eItem } = await supabase.from('level_bump_items').insert({
      batch_id: batch.id, employee_id: it.employeeId, old_level: it.oldLevel, new_level: it.newLevel, pending_log_id: pendingLogId,
    })
    if (eItem) throw eItem
  }

  const { error: e2 } = await supabase.from('point_settings').update({ level_reference_year: newYear }).eq('id', 1)
  if (e2) throw e2

  return batch
}

// 가장 최근 배치를 되돌림 — 사람별 연차를 old_level로 복원하고, 그 배치에서 새로 얼려진 보류 포인트는
// (그 사이 담당자가 이미 반영여부·반영포인트를 건드리지 않았다면) 얼린 기록까지 같이 정리함
export async function undoLevelBump(batch, undoneBy) {
  const { data: items, error: eItems } = await supabase.from('level_bump_items').select('*').eq('batch_id', batch.id)
  if (eItems) throw eItems

  for (const it of items || []) {
    const { error: eLevel } = await supabase.from('employees').update({ level: it.old_level }).eq('id', it.employee_id)
    if (eLevel) throw eLevel

    if (it.pending_log_id) {
      const { data: emp, error: eEmp } = await supabase.from('employees').select('pending_resolved, pending_release_points').eq('id', it.employee_id).single()
      if (eEmp) throw eEmp
      const untouched = !emp.pending_resolved && Number(emp.pending_release_points || 0) === 0
      if (untouched) {
        const { error: eClear } = await supabase.from('employees').update({
          has_pending_backfill: false, pending_points: null, pending_resolved: false, pending_release_points: 0,
        }).eq('id', it.employee_id)
        if (eClear) throw eClear
        await supabase.from('pending_point_log').delete().eq('id', it.pending_log_id)
      }
      // 이미 담당자가 처리했으면(untouched=false) 그 처리 결과는 그대로 두고 연차만 되돌림 —
      // 연차가 다시 마이너스가 되면 그 보류 상태는 화면 계산에서 어차피 무시되니 데이터 손실은 없음
    }
  }

  const { error: eBatch } = await supabase.from('level_bump_batches').update({ undone_at: new Date().toISOString(), undone_by: undoneBy }).eq('id', batch.id)
  if (eBatch) throw eBatch

  const { error: eSettings } = await supabase.from('point_settings').update({ level_reference_year: batch.previous_reference_year }).eq('id', 1)
  if (eSettings) throw eSettings
}
