-- 비고를 +/-/o 평가값으로, 2025년도 평가 코멘트를 계속 이어지는 시계열 코멘트로 확장.
-- Supabase SQL Editor에서 실행하세요.

-- 1) 비고 평가값: +(긍정 특이사항) / -(부정, 근태 등 문제) / o(특이사항 없음, 기본값)
--    기존 note(자유메모)는 그대로 두고, 이 컬럼은 목록에서 한눈에 보이는 요약 표시용
alter table employees add column if not exists note_flag text not null default 'o';
alter table employees drop constraint if exists employees_note_flag_check;
alter table employees add constraint employees_note_flag_check check (note_flag in ('+','-','o'));

-- 2) 정성평가 코멘트 이력 — 연도 하나에 고정된 단일 텍스트(eval_comment_2025) 대신,
--    문제 있을 때마다 날짜 찍어 계속 추가해나가는 로그
create table if not exists eval_comments (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id) on delete cascade,
  comment_date date not null default current_date,
  text text not null,
  created_at timestamptz default now()
);
create index if not exists eval_comments_employee_id_idx on eval_comments(employee_id);

alter table eval_comments enable row level security;
drop policy if exists "authenticated_select_eval_comments" on eval_comments;
drop policy if exists "authenticated_insert_eval_comments" on eval_comments;
drop policy if exists "authenticated_update_eval_comments" on eval_comments;
drop policy if exists "authenticated_delete_eval_comments" on eval_comments;
create policy "authenticated_select_eval_comments" on eval_comments for select to authenticated using (true);
create policy "authenticated_insert_eval_comments" on eval_comments for insert to authenticated with check (true);
create policy "authenticated_update_eval_comments" on eval_comments for update to authenticated using (true) with check (true);
create policy "authenticated_delete_eval_comments" on eval_comments for delete to authenticated using (true);

-- 3) 기존에 이미 입력해둔 2025년도 평가 코멘트(있는 사람만)를 새 로그의 첫 항목으로 그대로 이관.
--    eval_comment_2025 컬럼 자체는 지우지 않음(과거 CSV 호환용으로 남겨둠, 화면에서는 더 이상 직접 쓰지 않음).
--    이 DB엔 그 컬럼을 추가하는 예전 마이그레이션이 실제로 적용된 적이 없어서, 먼저 없으면 만들어둠(빈 상태로 시작해도 안전).
alter table employees add column if not exists eval_comment_2025 text;

insert into eval_comments (employee_id, comment_date, text)
select id, '2025-12-31'::date, eval_comment_2025
from employees
where eval_comment_2025 is not null and trim(eval_comment_2025) <> ''
  and not exists (
    select 1 from eval_comments ec where ec.employee_id = employees.id and ec.text = employees.eval_comment_2025
  );

-- 4) 퇴사 처리 시 employees_archive로 스냅샷 이동하는데, 이때 note_flag와 정성평가 코멘트 이력도 같이
--    보존해야 나중에 복구했을 때 그대로 이어볼 수 있음(evaluations_snapshot과 같은 방식)
alter table employees_archive add column if not exists note_flag text;
alter table employees_archive add column if not exists eval_comments_snapshot jsonb;
