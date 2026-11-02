-- 전임연구원 → 선임연구원 승진 진급포인트 기준 24점 → 30점
-- Supabase SQL Editor에서 실행하세요. (또는 앱의 "기준값 설정"에서 전임연구원 기준점수를 30으로 저장해도 같음)

update rank_criteria set threshold = 30 where rank = '전임연구원';
