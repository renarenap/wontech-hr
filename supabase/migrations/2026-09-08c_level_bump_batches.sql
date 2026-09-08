-- 연차 일괄 +1의 "기준년도" 추적 + 되돌리기(undo) 기능
-- Supabase SQL Editor에서 실행하세요.

-- 지금 연차 데이터가 몇 년도 기준인지(싱글턴 point_settings에 추가). 처음 값은 올해(2026)로 시작.
alter table point_settings add column if not exists level_reference_year int not null default 2026;

-- 연차 일괄 +1을 실행할 때마다 배치 하나 생성 — 되돌리기는 "가장 최근의 안 되돌려진 배치"를 되돌림
create table if not exists level_bump_batches (
  id uuid primary key default gen_random_uuid(),
  previous_reference_year int not null,
  new_reference_year int not null,
  applied_by text,
  applied_at timestamptz default now(),
  undone_at timestamptz,
  undone_by text
);

-- 배치 안에서 사람별로 무엇이 바뀌었는지(되돌릴 때 이 값 그대로 복원) + 이 사람이 이 배치에서
-- 보류 포인트가 새로 얼려졌으면 그 pending_point_log 행을 가리켜서, 되돌릴 때 그 얼린 기록도 같이 지움
-- (단, 그 사이에 담당자가 이미 반영여부/반영포인트를 건드렸으면 그 처리 결과는 보존하고 안 건드림)
create table if not exists level_bump_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references level_bump_batches(id) on delete cascade,
  employee_id uuid references employees(id) on delete cascade,
  old_level numeric not null,
  new_level numeric not null,
  pending_log_id uuid references pending_point_log(id)
);
create index if not exists level_bump_items_batch_id_idx on level_bump_items(batch_id);

alter table level_bump_batches enable row level security;
alter table level_bump_items enable row level security;
drop policy if exists "authenticated_select_level_bump_batches" on level_bump_batches;
drop policy if exists "authenticated_insert_level_bump_batches" on level_bump_batches;
drop policy if exists "authenticated_update_level_bump_batches" on level_bump_batches;
drop policy if exists "authenticated_delete_level_bump_batches" on level_bump_batches;
create policy "authenticated_select_level_bump_batches" on level_bump_batches for select to authenticated using (true);
create policy "authenticated_insert_level_bump_batches" on level_bump_batches for insert to authenticated with check (true);
create policy "authenticated_update_level_bump_batches" on level_bump_batches for update to authenticated using (true) with check (true);
create policy "authenticated_delete_level_bump_batches" on level_bump_batches for delete to authenticated using (true);
drop policy if exists "authenticated_select_level_bump_items" on level_bump_items;
drop policy if exists "authenticated_insert_level_bump_items" on level_bump_items;
drop policy if exists "authenticated_update_level_bump_items" on level_bump_items;
drop policy if exists "authenticated_delete_level_bump_items" on level_bump_items;
create policy "authenticated_select_level_bump_items" on level_bump_items for select to authenticated using (true);
create policy "authenticated_insert_level_bump_items" on level_bump_items for insert to authenticated with check (true);
create policy "authenticated_update_level_bump_items" on level_bump_items for update to authenticated using (true) with check (true);
create policy "authenticated_delete_level_bump_items" on level_bump_items for delete to authenticated using (true);
