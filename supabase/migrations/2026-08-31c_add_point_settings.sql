-- 휴직 포인트 요율(연차당 P) 등 직급과 무관한 전역 설정값을 담는 싱글턴 테이블.
-- Supabase SQL Editor에서 실행하세요.

create table if not exists point_settings (
  id int primary key default 1,
  leave_rate_per_year numeric not null default 6,  -- 휴직 1년당 인정 포인트(기존엔 6으로 하드코딩돼있던 값)
  updated_at timestamptz default now(),
  constraint point_settings_single_row check (id = 1)
);

insert into point_settings (id) values (1) on conflict (id) do nothing;

alter table point_settings enable row level security;
create policy "authenticated_select_point_settings" on point_settings for select to authenticated using (true);
create policy "authenticated_update_point_settings" on point_settings for update to authenticated using (true) with check (true);
