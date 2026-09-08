-- 입사자 등록 화면 버그(employees.join_date를 안 채우던 문제, 코드는 이미 수정됨)로
-- 입사일이 비어있는 기존 직원들을 hires 테이블 기록으로 역채움.
-- hires에는 employee_id가 없어서 이름으로 매칭 — 동명이인이거나, 같은 이름으로 hires에
-- 날짜가 여러 개 남아있어 헷갈리면 자동으로 스킵되니 안전합니다.
-- Supabase SQL Editor에서 실행하세요.

with candidate as (
  select name, min(join_date) as join_date, count(distinct join_date) as distinct_dates
  from hires
  group by name
)
update employees e
set join_date = c.join_date
from candidate c
where e.join_date is null
  and e.name = c.name
  and c.distinct_dates = 1
  and (select count(*) from employees e2 where e2.name = c.name) = 1;

-- 확인용: 실행 후 여전히 입사일이 비어있는 사람이 있는지 봐주세요(동명이인 등으로 자동 스킵된 경우).
select id, name, join_date from employees where join_date is null order by name;
