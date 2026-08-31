-- 휴직(leave_years) 컬럼 추가 — 평가 없이 1년당 6P 고정 가산 + 체류연한에도 합산.
-- 겸사겸사 employees_archive에 빠져있던 note(비고) 컬럼도 같이 채워둡니다.
-- Supabase SQL Editor에서 실행하세요.

alter table employees add column if not exists leave_years numeric default 0;
alter table employees_archive add column if not exists leave_years numeric;
alter table employees_archive add column if not exists note text;
