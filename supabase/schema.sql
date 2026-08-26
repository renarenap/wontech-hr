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
  track text not null check (track in ('사무','사무영어필수','연구')),
  role text,
  level int default 0,          -- 연차
  -- req_tenure/threshold는 더 이상 계산에 쓰이지 않음(0 저장) — rank_criteria 테이블이 단일 소스
  req_tenure int not null default 0,
  threshold int not null default 0,
  base_pts numeric default 0,   -- 레거시 필드, 더 이상 계산에 사용 안 함(경력직 백필로 대체)
  backfill_full_tenure boolean default false,  -- true면 연차 전체 × 기준점수로 백필(경력직), false면 평가공백만 백필
  eng_pts numeric default 0,
  eng_lifetime boolean default false,   -- 영어 AL/IH 평생인정 여부 (유효기간 만료돼도 승진요건 충족)
  eng2_pts numeric default 0,
  eng2_lifetime boolean default false,
  cert_pts numeric default 0,
  award_pts numeric default 0,
  created_at timestamptz default now()
);

-- 직급별 승진 기준 파라미터 (하드코딩 대신 이 테이블로 관리 — '기준값 설정' 화면에서 편집)
create table if not exists rank_criteria (
  rank text primary key,
  req_tenure int not null default 0,
  threshold int not null default 0,
  backfill_rate numeric not null default 0,  -- 경력직 백필 기준점수(연차당)
  updated_at timestamptz default now()
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

-- 퇴사자 아카이브 (employees에서 삭제되는 직원의 스냅샷 보관)
create table if not exists employees_archive (
  id uuid primary key default gen_random_uuid(),
  original_id uuid,
  name text not null,
  dept text, team text, rank text, track text, role text,
  level int, req_tenure int, threshold int,
  base_pts numeric, backfill_full_tenure boolean, eng_pts numeric, eng_lifetime boolean,
  eng2_pts numeric, eng2_lifetime boolean, cert_pts numeric, award_pts numeric,
  evaluations_snapshot jsonb,       -- 삭제 시점의 evaluations 이력 백업 (employees 삭제 시 evaluations는 cascade 삭제되므로)
  transfer_ids uuid[],              -- 삭제 시점에 이 직원 소유였던 transfers.id 목록 (복구 시 재연결용)
  resign_date date not null,
  archived_at timestamptz default now()
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
alter table employees_archive enable row level security;
alter table rank_criteria enable row level security;
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
    'employees','employees_archive','rank_criteria','evaluations','onboarding','onboarding_tasks',
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
