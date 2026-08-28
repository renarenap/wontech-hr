-- "사무영어필수" -> "사무외국어필수"로 값·제약조건 변경
-- 영어뿐 아니라 제2외국어로도 요건을 채울 수 있는 트랙이라 이름을 명확히 합니다.
-- Supabase SQL Editor에서 전체 실행하세요.

alter table employees drop constraint if exists employees_track_check;
update employees set track = '사무외국어필수' where track = '사무영어필수';
alter table employees add constraint employees_track_check check (track in ('사무','사무외국어필수','연구'));
