-- 조직개편 대비: 소속을 실-팀-파트 3단계로 확장하고, 위치(대전/판교/해외법인) 컬럼을 추가합니다.
-- Supabase SQL Editor에서 전체 실행하세요.
--
-- ・기존 dept 컬럼은 '팀', team 컬럼은 '파트' 레벨로 재해석합니다 (컬럼명 자체는 마이그레이션 비용 때문에 유지).
-- ・division(실)은 신규 컬럼이라 기존 데이터는 전부 비어있는 상태로 시작합니다.
-- ・locations(위치)는 대전 소속인데 해외 파견 나간 경우처럼 한 사람이 여러 곳에 걸칠 수 있어 배열로 저장합니다.
-- ・기존 재직자 전원의 division/locations 값은 채우지 않습니다 — 담당자가 CSV로 다운로드해서 직접 채운 뒤 재업로드하세요.

alter table employees add column if not exists division text;
alter table employees add column if not exists locations text[] not null default '{}';

alter table employees_archive add column if not exists division text;
alter table employees_archive add column if not exists locations text[];

alter table hires add column if not exists division text;
alter table hires add column if not exists locations text[] not null default '{}';

alter table resignations add column if not exists division text;
alter table resignations add column if not exists locations text[] not null default '{}';

alter table recruit_positions add column if not exists division text;
alter table recruit_positions add column if not exists locations text[] not null default '{}';
