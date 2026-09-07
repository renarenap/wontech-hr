-- 어학을 "영어 + 제2외국어" 2슬롯 대신 영어/중국어/일본어 각각 독립 필드로 확장.
-- 기존 제2외국어(eng2_pts/eng2_lifetime)는 컬럼 자체는 남겨두되(레거시), 화면에서는 더 이상 안 씀.
-- 기존에 입력돼있던 제2외국어 점수는 "말하기 외 기타 외국어 시험"과 같은 배점(직무자격 1P/최대3P) 취급이라
-- cert_entries에 직무자격 항목으로 이관함 — 숫자가 사라지지 않게.
-- Supabase SQL Editor에서 실행하세요.

alter table employees add column if not exists cn_pts numeric default 0;
alter table employees add column if not exists cn_lifetime boolean default false;
alter table employees add column if not exists jp_pts numeric default 0;
alter table employees add column if not exists jp_lifetime boolean default false;

insert into cert_entries (employee_id, category, name, points)
select id, '직무자격', '(기존 제2외국어 점수 이관 — 필요시 실제 시험명으로 다시 정리해주세요)', eng2_pts
from employees
where coalesce(eng2_pts, 0) > 0
  and not exists (
    select 1 from cert_entries ce where ce.employee_id = employees.id and ce.name like '(기존 제2외국어%'
  );

-- 방금 추가한 이관 항목이 즉시 반영되도록 employees.cert_pts(캐시값)를 카테고리 상한 적용해 다시 계산.
-- 주의: 제2외국어 점수가 3P를 넘었던 사람은 직무자격 상한(최대3P) 때문에 여기서 줄어들 수 있어요 —
-- 필요하면 상세화면 "자격증" 카드에서 실제 시험명으로 나눠 다시 정리해주세요.
update employees e
set cert_pts = coalesce((
  select least(coalesce(sum(ce.points) filter (where ce.category = '전문자격'), 0), 6)
       + least(coalesce(sum(ce.points) filter (where ce.category = '직무자격'), 0), 3)
  from cert_entries ce where ce.employee_id = e.id
), 0);

-- 퇴사 스냅샷(employees_archive)에도 같은 컬럼 추가
alter table employees_archive add column if not exists cn_pts numeric;
alter table employees_archive add column if not exists cn_lifetime boolean;
alter table employees_archive add column if not exists jp_pts numeric;
alter table employees_archive add column if not exists jp_lifetime boolean;
