-- 재직자 자유메모(겸직 등) 컬럼 추가. Supabase SQL Editor에서 실행하세요.
alter table employees add column if not exists note text;
