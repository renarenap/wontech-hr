// ═══ 마이너스 연차 조정 / 보류 포인트 처리 ═══
// 연차(level)가 마이너스인 동안엔 평가+경력인정 포인트를 라이브로 상쇄(마이너스연차 조정)하고,
// "연차 일괄 +1"로 마이너스→플러스로 넘어가는 순간엔 그 직전 값을 얼려서(has_pending_backfill)
// 담당자가 반영여부·반영포인트를 수동으로 승인하기 전까진 자동으로 총점에 안 들어가게 함.
import { supabase } from '../supabaseClient'

// 연차<0일 때 평가+경력인정 포인트를 그대로 상쇄하는 라이브 조정값(음수) — 매 렌더링마다 다시 계산됨
export function minusYearAdjustment(evalPts, backfillPts) {
  return -Math.round(((evalPts || 0) + (backfillPts || 0)) * 10) / 10
}

// employee(스프레드된 derive 결과)의 보류 상태를 총점 계산에 반영할 조정값 — level>=0이고
// has_pending_backfill인 사람만 해당(그 외는 0, 즉 일반 직원은 전혀 영향 없음)
export function pendingBackfillAdjustment(employee) {
  if (!employee?.has_pending_backfill) return 0
  const held = Number(employee.pending_points) || 0
  if (employee.pending_resolved) {
    return Math.round((-held + (Number(employee.pending_release_points) || 0)) * 10) / 10
  }
  return Math.round(-held * 10) / 10
}

export async function fetchPendingPointLog(employeeId) {
  const { data, error } = await supabase
    .from('pending_point_log')
    .select('*')
    .eq('employee_id', employeeId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

// 담당자가 상세화면에서 반영여부/반영포인트를 저장할 때 호출
// (얼리는 동작 자체는 src/lib/levelBump.js의 applyLevelBump에서 처리 — 되돌리기 때 필요한
// pending_point_log 행의 id를 그 자리에서 바로 받아야 해서 거기 직접 넣어둠)
export async function resolvePendingBackfill(employeeId, resolved, releasePoints, changedBy) {
  const release = Math.round((Number(releasePoints) || 0) * 10) / 10
  const { error: e1 } = await supabase.from('employees').update({
    pending_resolved: resolved, pending_release_points: release,
  }).eq('id', employeeId)
  if (e1) throw e1
  const { error: e2 } = await supabase.from('pending_point_log').insert({
    employee_id: employeeId, event_type: 'resolved', resolved, release_points: release, changed_by: changedBy,
  })
  if (e2) throw e2
}
