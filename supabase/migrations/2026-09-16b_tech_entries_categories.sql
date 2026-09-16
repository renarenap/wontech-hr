-- 기술성과(tech_entries) 항목 세분화 — 실용신안·디자인 등록 신설, 배점/상한 조정 (2026.09.16 기준표 개정)
-- 기존: 국내특허 2P · 해외특허 3P · 국내논문 2P · 국제논문 3P, 합산 최대 6P
-- 변경: 해외특허 2P · 국제논문 2P · 국내특허 1.5P · 국내논문 1.5P · 실용신안(신규) 1P · 디자인(신규) 0.5P, 합산 최대 4P
-- 기존에 저장된 건별 점수(points)는 그대로 두고, category 체크 제약만 새 항목을 허용하도록 넓힙니다.
-- Supabase SQL Editor에서 실행하세요.

alter table tech_entries drop constraint if exists tech_entries_category_check;
alter table tech_entries add constraint tech_entries_category_check
  check (category in ('해외특허','국제논문','국내특허','국내논문','실용신안','디자인'));

-- 상한이 6P→4P로 줄어들어서, 기존에 6P 근처까지 인정됐던 사람은 캐시값(employees.tech_pts)을
-- 새 상한 기준으로 다시 계산해서 반영합니다(건별 원본 점수는 안 건드림 — 상한 적용 결과만 갱신).
update employees e
set tech_pts = coalesce((
  select round(least(4, sum(t.points))::numeric, 1)
  from tech_entries t where t.employee_id = e.id
), 0)
where exists (select 1 from tech_entries t where t.employee_id = e.id);
