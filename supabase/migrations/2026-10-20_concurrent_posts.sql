-- 겸직 — 본 소속(division/dept/team/role) 외에 추가로 맡는 소속·직책 목록.
-- [{ "division": "...", "dept": "...", "team": "...", "role": "팀장" }, ...] 형태의 배열.
-- Supabase SQL Editor에서 실행하세요.

alter table employees add column if not exists concurrent_posts jsonb not null default '[]'::jsonb;
alter table employees_archive add column if not exists concurrent_posts jsonb;
