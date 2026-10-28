-- 채용 지원자 — 학력·경력 정보 + 경력 연차로 계산한 예상 직급/연차 저장, 입사 등록으로 이어진 직원 연결
-- (채용 탭에서 입력해두고, 합격 후 "입사 등록"을 누르면 입사자 등록 화면에 그대로 채워짐)
-- Supabase SQL Editor에서 실행하세요.

alter table recruit_candidates add column if not exists edu_level text;           -- 최종학력: 고졸/전문학사/학사/석사/박사
alter table recruit_candidates add column if not exists school text;
alter table recruit_candidates add column if not exists major text;
alter table recruit_candidates add column if not exists edu_years int not null default 0;      -- 학력 인정 연차(회사 기준에 따라 직접 입력)
alter table recruit_candidates add column if not exists career_months int not null default 0; -- 총 경력(개월)
alter table recruit_candidates add column if not exists career_rate int not null default 100; -- 경력 인정비율(%)
alter table recruit_candidates add column if not exists track text;               -- 사무/사무외국어필수/연구
alter table recruit_candidates add column if not exists est_rank text;            -- 예상 직급
alter table recruit_candidates add column if not exists est_level int;            -- 예상 연차(직급 내)
alter table recruit_candidates add column if not exists memo text;
alter table recruit_candidates add column if not exists hired_employee_id uuid references employees(id) on delete set null;
