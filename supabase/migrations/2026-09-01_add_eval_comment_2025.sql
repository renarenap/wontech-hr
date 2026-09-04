-- 2025년도 평가결과 코멘트(정성적, 연간 통합 1건) 컬럼 추가. Supabase SQL Editor에서 실행하세요.
alter table employees add column if not exists eval_comment_2025 text;
