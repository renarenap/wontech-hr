-- 마이너스 연차 조정 + 보류 포인트 처리 (스펙: 마이너스연차 포인트 처리 개발 스펙, 2026-09-08)
-- Supabase SQL Editor에서 실행하세요.

-- 연차가 마이너스→플러스로 넘어가는 "그 순간"("포인트 현황" 페이지의 "연차 일괄 +1" 실행 시점)에
-- 새 연차 기준으로 다시 계산한 평가+경력인정 포인트를 얼려서 저장해두는 필드들.
alter table employees add column if not exists has_pending_backfill boolean not null default false;
alter table employees add column if not exists pending_points numeric;              -- 얼린 시점의 평가+경력인정 포인트 합계(원본, 불변)
alter table employees add column if not exists pending_resolved boolean not null default false;  -- 반영 여부 체크박스
alter table employees add column if not exists pending_release_points numeric not null default 0; -- 반영 포인트(자유 입력)

-- 처리 이력(감사용) — 얼려질 때(frozen) 한 번, 반영여부/반영포인트를 바꿔 저장할 때(resolved)마다 계속 追加
create table if not exists pending_point_log (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id) on delete cascade,
  event_type text not null check (event_type in ('frozen','resolved')),
  held_points numeric,      -- frozen 이벤트: 그 시점 평가+경력인정 포인트 합계
  release_points numeric,   -- resolved 이벤트: 그때 입력한 반영 포인트
  resolved boolean,         -- resolved 이벤트: 그때 체크 상태
  changed_by text,          -- 처리자(로그인 이메일)
  created_at timestamptz default now()
);
create index if not exists pending_point_log_employee_id_idx on pending_point_log(employee_id);

alter table pending_point_log enable row level security;
drop policy if exists "authenticated_select_pending_point_log" on pending_point_log;
drop policy if exists "authenticated_insert_pending_point_log" on pending_point_log;
drop policy if exists "authenticated_update_pending_point_log" on pending_point_log;
drop policy if exists "authenticated_delete_pending_point_log" on pending_point_log;
create policy "authenticated_select_pending_point_log" on pending_point_log for select to authenticated using (true);
create policy "authenticated_insert_pending_point_log" on pending_point_log for insert to authenticated with check (true);
create policy "authenticated_update_pending_point_log" on pending_point_log for update to authenticated using (true) with check (true);
create policy "authenticated_delete_pending_point_log" on pending_point_log for delete to authenticated using (true);

-- 퇴사 스냅샷(employees_archive)에도 같은 필드 + 이력 스냅샷 추가
alter table employees_archive add column if not exists has_pending_backfill boolean;
alter table employees_archive add column if not exists pending_points numeric;
alter table employees_archive add column if not exists pending_resolved boolean;
alter table employees_archive add column if not exists pending_release_points numeric;
alter table employees_archive add column if not exists pending_point_log_snapshot jsonb;
