-- ═══════════════════════════════════════════════════════════
-- WONTECH HR 관리 시스템 — 스키마
-- Supabase SQL Editor에서 전체 실행하세요.
-- ═══════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- 직원 (승진포인트 대상)
create table if not exists employees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  dept text not null,
  team text,
  rank text not null,
  track text not null check (track in ('사무','연구')),
  role text,
  level int default 0,          -- 연차
  req_tenure int not null,       -- 필요 체류연한
  threshold int not null,        -- 승진 포인트 기준
  base_pts numeric default 0,
  eng_pts numeric default 0,
  eng2_pts numeric default 0,
  cert_pts numeric default 0,
  award_pts numeric default 0,
  created_at timestamptz default now()
);

-- 평가 이력 (반기/연간 등급)
create table if not exists evaluations (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id) on delete cascade,
  period text not null,      -- '23상','23하'...'26'(연간 전환 후)
  grade text not null,       -- S,A+,A,B+,B,C,D / EX,VG,GD,NI,UN
  points numeric not null,
  created_at timestamptz default now()
);

-- 온보딩 (입사 3개월 이내)
create table if not exists onboarding (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id) on delete cascade,
  join_date date not null,
  mentor text,
  created_at timestamptz default now()
);

create table if not exists onboarding_tasks (
  id uuid primary key default gen_random_uuid(),
  onboarding_id uuid references onboarding(id) on delete cascade,
  task_name text not null,
  done boolean default false,
  sort_order int default 0
);

-- 입사 관리
create table if not exists hires (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  dept text not null,
  team text,
  rank text,
  hire_type text,             -- 신입/경력
  join_date date not null,
  status text default '처우협의중',  -- 처우협의중 / 입사확정
  offer_sent boolean default false,
  contract_signed boolean default false,
  equipment_ready boolean default false,
  account_created boolean default false,
  seat_assigned boolean default false,
  welcome_kit_sent boolean default false,
  created_at timestamptz default now()
);

-- 퇴사 관리
create table if not exists resignations (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id),
  name text not null,
  dept text not null,
  team text,
  rank text,
  reason text,                -- 개인사유/이직 등
  submit_date date not null,
  last_day date not null,
  status text default '진행중',      -- 진행중 / 완료
  handover_done boolean default false,
  equipment_returned boolean default false,
  account_disabled boolean default false,
  exit_interview_done boolean default false,
  certificate_issued boolean default false,
  created_at timestamptz default now()
);

-- 발령 관리 (승진/부서이동/파견/직무변경)
create table if not exists transfers (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id),
  name text not null,
  type text not null,          -- 승진/부서이동/파견/직무변경
  from_value text not null,
  to_value text not null,
  rank text,
  effective_date date not null,
  status text default '승인대기',    -- 승인대기 / 승인완료 / 반려
  approver text,
  created_at timestamptz default now()
);

-- 채용 (포지션 + 지원자)
create table if not exists recruit_positions (
  id uuid primary key default gen_random_uuid(),
  position text not null,
  dept text not null,
  team text,
  hire_type text,             -- 경력/신입/신입·경력
  level text,
  status text default '공고중', -- 공고중/서류심사/면접진행/최종협의/마감
  open_date date not null,
  created_at timestamptz default now()
);

create table if not exists recruit_candidates (
  id uuid primary key default gen_random_uuid(),
  position_id uuid references recruit_positions(id) on delete cascade,
  name text not null,          -- 익명 처리 표기 가능 (김○○ 등)
  stage text not null,         -- 서류심사/1차면접/2차면접/처우협의 등
  result text not null,        -- 검토중/통과/진행중/합격대기/탈락
  created_at timestamptz default now()
);

-- ═══════════════════════════════════════════════════════════
-- RLS: 로그인한 인사팀(authenticated)만 조회/등록/수정 가능
-- (초대되지 않은 사람은 로그인 자체가 불가하므로 회원가입은 없음)
-- ═══════════════════════════════════════════════════════════

alter table employees enable row level security;
alter table evaluations enable row level security;
alter table onboarding enable row level security;
alter table onboarding_tasks enable row level security;
alter table hires enable row level security;
alter table resignations enable row level security;
alter table transfers enable row level security;
alter table recruit_positions enable row level security;
alter table recruit_candidates enable row level security;

do $$
declare
  t text;
begin
  for t in select unnest(array[
    'employees','evaluations','onboarding','onboarding_tasks',
    'hires','resignations','transfers','recruit_positions','recruit_candidates'
  ])
  loop
    execute format(
      'create policy "authenticated_select_%1$s" on %1$s for select to authenticated using (true);', t
    );
    execute format(
      'create policy "authenticated_insert_%1$s" on %1$s for insert to authenticated with check (true);', t
    );
    execute format(
      'create policy "authenticated_update_%1$s" on %1$s for update to authenticated using (true) with check (true);', t
    );
    execute format(
      'create policy "authenticated_delete_%1$s" on %1$s for delete to authenticated using (true);', t
    );
  end loop;
end $$;
