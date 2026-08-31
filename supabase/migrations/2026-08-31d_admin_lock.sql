-- 관리자 개념 도입: wowbagger12@gmail.com을 관리자로 지정하고, 기준값(rank_criteria/point_settings)
-- 쓰기 권한을 관리자로만 제한합니다. 화면(기준값 설정/계정 관리)은 프론트에서도 이미 잠갔지만,
-- 이건 DB 단에서 실제로 막는 부분이라 같이 실행해야 진짜 잠깁니다.
-- Supabase SQL Editor에서 실행하세요.

-- 1) 관리자 지정 (필요하면 email 바꿔서 추가로 여러 번 실행 가능)
update auth.users
set raw_user_meta_data = raw_user_meta_data || '{"is_admin": true}'::jsonb
where email = 'wowbagger12@gmail.com';

-- 2) rank_criteria: 조회는 전 직원 공개(기준표 화면용), 쓰기는 관리자만
drop policy if exists "authenticated_insert_rank_criteria" on rank_criteria;
drop policy if exists "authenticated_update_rank_criteria" on rank_criteria;
drop policy if exists "authenticated_delete_rank_criteria" on rank_criteria;

create policy "admin_insert_rank_criteria" on rank_criteria for insert to authenticated
  with check (coalesce((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, false));
create policy "admin_update_rank_criteria" on rank_criteria for update to authenticated
  using (coalesce((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, false))
  with check (coalesce((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, false));
create policy "admin_delete_rank_criteria" on rank_criteria for delete to authenticated
  using (coalesce((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, false));

-- 3) point_settings: 조회는 전 직원 공개(휴직 포인트 계산용), 수정은 관리자만
drop policy if exists "authenticated_update_point_settings" on point_settings;
create policy "admin_update_point_settings" on point_settings for update to authenticated
  using (coalesce((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, false))
  with check (coalesce((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, false));

-- 4) CSV 다운로드 알림용 로그 테이블 (누가 언제 전체 명단을 내려받았는지 기록)
create table if not exists csv_download_log (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  row_count int,
  created_at timestamptz default now()
);
alter table csv_download_log enable row level security;
create policy "authenticated_insert_csv_download_log" on csv_download_log for insert to authenticated with check (true);
create policy "admin_select_csv_download_log" on csv_download_log for select to authenticated
  using (coalesce((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, false));

-- ⚠️ 실행 후 wowbagger12@gmail.com 계정으로 로그아웃 → 재로그인 한 번 해주세요
-- (지금 로그인된 세션의 토큰엔 is_admin이 아직 안 실려있어서, 재로그인해야 반영돼요)
