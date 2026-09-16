-- 부장 / 수석연구원 진급포인트 재도입 (2026.09.16 기준표 개정)
-- 기존엔 rank_criteria가 (0,0,0)이라 "해당없음"으로만 표시됐지만, 이제 체류연한·진급포인트 기준을
-- 채우면 "임원 심사 대상자"로 표시됩니다(자동 승진 아님 — 앱 로직에서 처리, 이 마이그레이션은 기준값만 변경).
-- 경력직 백필용 기준점수(연차당, backfill_rate)는 아직 미정이라 0으로 유지합니다.
-- Supabase SQL Editor에서 실행하세요.

update rank_criteria set req_tenure = 5, threshold = 40 where rank = '부장';
update rank_criteria set req_tenure = 4, threshold = 32 where rank = '수석연구원';
