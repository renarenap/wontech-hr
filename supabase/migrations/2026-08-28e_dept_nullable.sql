-- 실→파트로 바로 이어지고 "팀" 단계가 없는 조직도 있어서(예: 글로벌영업실 > 영업전략파트,
-- 팀 단계 없이) dept(팀) 컬럼을 필수에서 해제합니다. 대신 앱에서 실/팀/파트 중 최소 하나는
-- 있어야 한다고 검증합니다. Supabase SQL Editor에서 실행하세요.

alter table employees alter column dept drop not null;
alter table hires alter column dept drop not null;
alter table resignations alter column dept drop not null;
alter table recruit_positions alter column dept drop not null;
