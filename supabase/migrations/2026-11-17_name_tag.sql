-- 동명이인 구분(name_tag) 컬럼 추가. Supabase SQL Editor에서 전체를 한 번에 실행하세요.
--
-- 같은 이름의 직원이 여러 명일 때만 채우는 칸입니다. 화면에는 "이준영(생산)"처럼 이름 뒤 괄호로 붙어 보여서
-- 아마란스 표기와 똑같이 맞출 수 있습니다. 동명이인이 아니면 비워둡니다.
alter table employees add column if not exists name_tag text;
alter table employees_archive add column if not exists name_tag text;

-- 같은 이름 + 같은 구분이 두 명 생기지 않게 막음 (구분이 비어있는 사람끼리는 앱에서 확인)
create unique index if not exists employees_name_tag_uniq on employees (name, name_tag) where name_tag is not null;

-- (참고) 지금 동명이인 목록 — 여기 나오는 사람들은 앱의 직원 상세 → 수정에서 "구분"을 채워주세요.
select name, count(*) as 인원 from employees group by name having count(*) > 1 order by name;
