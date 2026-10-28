-- 채용 지원자 — 담당자가 상황에 따라 직접 더하거나 빼는 연차(±년)와 그 사유
-- 인정 연차 = 인정 경력(올림) + 학력 가감 + 수동 조정
-- Supabase SQL Editor에서 실행하세요.

alter table recruit_candidates add column if not exists manual_adj int not null default 0;
alter table recruit_candidates add column if not exists manual_note text;
