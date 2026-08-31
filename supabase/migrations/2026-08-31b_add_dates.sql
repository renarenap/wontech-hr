-- 입사일 / 휴직 시작·종료일 컬럼 추가. Supabase SQL Editor에서 실행하세요.
alter table employees add column if not exists join_date date;
alter table employees add column if not exists leave_start_date date;
alter table employees add column if not exists leave_end_date date;

alter table employees_archive add column if not exists join_date date;
alter table employees_archive add column if not exists leave_start_date date;
alter table employees_archive add column if not exists leave_end_date date;
