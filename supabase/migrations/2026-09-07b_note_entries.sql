-- 비고(근태 등 특이사항)를 정성평가 코멘트처럼 날짜 찍어 계속 추가하는 시계열 로그로 확장.
-- 목록에 보이는 +/-/o 요약(note_flag)은 그대로 두고, 그 밑에 깔리는 상세 텍스트만 로그화함.
-- Supabase SQL Editor에서 실행하세요.

create table if not exists note_entries (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id) on delete cascade,
  entry_date date not null default current_date,
  text text not null,
  created_at timestamptz default now()
);
create index if not exists note_entries_employee_id_idx on note_entries(employee_id);

alter table employees_archive add column if not exists note_entries_snapshot jsonb;

alter table note_entries enable row level security;
drop policy if exists "authenticated_select_note_entries" on note_entries;
drop policy if exists "authenticated_insert_note_entries" on note_entries;
drop policy if exists "authenticated_update_note_entries" on note_entries;
drop policy if exists "authenticated_delete_note_entries" on note_entries;
create policy "authenticated_select_note_entries" on note_entries for select to authenticated using (true);
create policy "authenticated_insert_note_entries" on note_entries for insert to authenticated with check (true);
create policy "authenticated_update_note_entries" on note_entries for update to authenticated using (true) with check (true);
create policy "authenticated_delete_note_entries" on note_entries for delete to authenticated using (true);

-- 기존에 이미 입력해둔 비고 자유메모(있는 사람만)를 새 로그의 첫 항목으로 그대로 이관.
-- note 컬럼 자체는 지우지 않음(레거시로 남겨둠, 화면에서는 더 이상 직접 쓰지 않음).
insert into note_entries (employee_id, entry_date, text)
select id, current_date, note
from employees
where note is not null and trim(note) <> ''
  and not exists (
    select 1 from note_entries ne where ne.employee_id = employees.id and ne.text = employees.note
  );
