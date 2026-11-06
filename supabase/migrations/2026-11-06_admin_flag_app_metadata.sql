-- 관리자 표시(is_admin)를 user_metadata → app_metadata로 옮깁니다.
--
-- 왜: user_metadata는 로그인한 사용자 본인이 supabase.auth.updateUser({ data: {...} })로 마음대로
-- 고칠 수 있는 칸이라, 일반 계정도 콘솔 한 줄로 is_admin: true를 넣고 관리자가 될 수 있었습니다.
-- app_metadata는 service role(서버)만 수정할 수 있어서 사용자가 스스로 바꿀 수 없습니다.
--
-- Supabase SQL Editor에서 전체를 한 번에 실행하세요.
-- ⚠️ 실행 후 관리자 계정은 로그아웃 → 재로그인해야 새 토큰에 반영됩니다.

-- 0) (참고) 지금 user_metadata에 is_admin이 들어간 계정 목록 — 본인 말고 다른 계정이 보이면
--    누군가 스스로 관리자 표시를 넣었다는 뜻이니 확인해보세요.
select email, raw_user_meta_data ->> 'is_admin' as user_meta_is_admin
from auth.users
where raw_user_meta_data ? 'is_admin';

-- 1) 관리자 지정 — app_metadata에 넣음 (관리자를 더 추가하려면 email만 바꿔서 다시 실행)
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"is_admin": true}'::jsonb
where email = 'wowbagger12@gmail.com';

-- 2) user_metadata에 남아있는 is_admin은 모든 계정에서 지움 (더 이상 아무 의미 없지만 혼동 방지)
update auth.users
set raw_user_meta_data = raw_user_meta_data - 'is_admin'
where raw_user_meta_data ? 'is_admin';

-- 3) DB 정책을 app_metadata 기준으로 다시 만듦
drop policy if exists "admin_update_point_settings" on point_settings;
create policy "admin_update_point_settings" on point_settings for update to authenticated
  using (coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false))
  with check (coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false));

drop policy if exists "admin_insert_rank_criteria" on rank_criteria;
drop policy if exists "admin_update_rank_criteria" on rank_criteria;
drop policy if exists "admin_delete_rank_criteria" on rank_criteria;
create policy "admin_insert_rank_criteria" on rank_criteria for insert to authenticated
  with check (coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false));
create policy "admin_update_rank_criteria" on rank_criteria for update to authenticated
  using (coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false))
  with check (coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false));
create policy "admin_delete_rank_criteria" on rank_criteria for delete to authenticated
  using (coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false));

drop policy if exists "admin_select_csv_download_log" on csv_download_log;
create policy "admin_select_csv_download_log" on csv_download_log for select to authenticated
  using (coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false));

-- 4) 확인 — 관리자 계정만 나와야 정상
select email, raw_app_meta_data ->> 'is_admin' as is_admin
from auth.users
where (raw_app_meta_data ->> 'is_admin')::boolean is true;
