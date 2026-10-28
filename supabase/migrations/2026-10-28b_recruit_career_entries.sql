-- 채용 지원자 — 경력을 회사별로 여러 건 입력(기간·유형·직무 유사도·예외 인정·비고) + 학력 졸업/수료 구분
-- career_entries: [{ "company": "...", "years": 2, "months": 3, "type": "정규·계약직", "similarity": "상", "exception": false, "note": "" }, ...]
-- (학력 인정: 박사 졸업 +4·수료 +3 / 석사 +2·+1 / 4년제 대졸 0 / 전문대졸 -1 / 고졸 -2 → edu_years에 가감 연차 저장)
-- (경력 인정: 유사도 상·중·하 100·80·50%, 프리랜서·개인사업자·인턴·6개월 미만 불인정(예외 인정 가능) → career_months에 인정 개월 저장)
-- 2026-10-28_recruit_candidate_profile.sql 실행 후에 실행하세요. Supabase SQL Editor에서 실행하세요.

alter table recruit_candidates add column if not exists career_entries jsonb not null default '[]'::jsonb;
alter table recruit_candidates add column if not exists edu_status text;  -- 졸업/수료
