-- 자격가점(cert_pts)을 숫자 하나 직접입력 대신, 자격증/기술성과를 건별로 입력받아
-- 카테고리별 상한(전문자격 최대6P, 직무자격 최대3P, 기술성과 최대6P)을 자동 적용해 합산하는 구조로 확장.
-- employees.cert_pts는 그대로 유지(캐시값) — 건별 입력이 바뀔 때마다 앱이 재계산해서 이 컬럼에 다시 씀.
-- employees.tech_pts는 새 컬럼(기술성과 합계 캐시) — 지금까지 없던 항목이라 새로 추가.
-- Supabase SQL Editor에서 실행하세요.

alter table employees add column if not exists tech_pts numeric default 0;

create table if not exists cert_entries (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id) on delete cascade,
  category text not null check (category in ('전문자격','직무자격')),
  name text not null,           -- 자격증명
  valid_until date,             -- 유효기간(만료일). 평생인정이면 null
  points numeric not null default 0,
  created_at timestamptz default now()
);
create index if not exists cert_entries_employee_id_idx on cert_entries(employee_id);

create table if not exists tech_entries (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id) on delete cascade,
  category text not null check (category in ('국내특허','해외특허','국내논문','국제논문')),
  name text not null,           -- 특허/논문명
  achieved_date date,           -- 등록/게재 일자
  points numeric not null default 0,
  created_at timestamptz default now()
);
create index if not exists tech_entries_employee_id_idx on tech_entries(employee_id);

alter table cert_entries enable row level security;
drop policy if exists "authenticated_select_cert_entries" on cert_entries;
drop policy if exists "authenticated_insert_cert_entries" on cert_entries;
drop policy if exists "authenticated_update_cert_entries" on cert_entries;
drop policy if exists "authenticated_delete_cert_entries" on cert_entries;
create policy "authenticated_select_cert_entries" on cert_entries for select to authenticated using (true);
create policy "authenticated_insert_cert_entries" on cert_entries for insert to authenticated with check (true);
create policy "authenticated_update_cert_entries" on cert_entries for update to authenticated using (true) with check (true);
create policy "authenticated_delete_cert_entries" on cert_entries for delete to authenticated using (true);

alter table tech_entries enable row level security;
drop policy if exists "authenticated_select_tech_entries" on tech_entries;
drop policy if exists "authenticated_insert_tech_entries" on tech_entries;
drop policy if exists "authenticated_update_tech_entries" on tech_entries;
drop policy if exists "authenticated_delete_tech_entries" on tech_entries;
create policy "authenticated_select_tech_entries" on tech_entries for select to authenticated using (true);
create policy "authenticated_insert_tech_entries" on tech_entries for insert to authenticated with check (true);
create policy "authenticated_update_tech_entries" on tech_entries for update to authenticated using (true) with check (true);
create policy "authenticated_delete_tech_entries" on tech_entries for delete to authenticated using (true);

-- 기존에 이미 입력돼있던 cert_pts(전 항목 뭉쳐진 숫자)는 건별 내역을 알 수 없어서 그대로 두되,
-- "전문자격"으로 뭉뚱그려 항목 하나로 이관해서 최소한 숫자가 안 사라지게 함(나중에 상세 내역으로 쪼개 정리 가능).
insert into cert_entries (employee_id, category, name, points)
select id, '전문자격', '(기존 합산값, 상세 미상 — 필요시 항목별로 다시 정리해주세요)', cert_pts
from employees
where coalesce(cert_pts, 0) > 0
  and not exists (select 1 from cert_entries ce where ce.employee_id = employees.id);

-- 퇴사 스냅샷(employees_archive)에도 tech_pts와 두 이력 스냅샷 컬럼 추가
alter table employees_archive add column if not exists tech_pts numeric;
alter table employees_archive add column if not exists cert_entries_snapshot jsonb;
alter table employees_archive add column if not exists tech_entries_snapshot jsonb;
