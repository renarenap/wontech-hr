-- ═══════════════════════════════════════════════════════════
-- WONTECH HR 관리 시스템 — 스키마
-- Supabase SQL Editor에서 전체 실행하세요.
-- ═══════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- 직원 (승진포인트 대상)
create table if not exists employees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- 소속 3단계: 실(division, 신규) → 팀(dept, 기존 '소속') → 파트(team, 기존 '팀'). 컬럼명은 마이그레이션 비용 때문에 유지.
  division text,
  dept text,  -- 실→파트로 바로 이어지고 팀 단계가 없는 조직도 있어서 필수 아님(실/팀/파트 중 최소 하나는 앱에서 검증)
  team text,
  -- 지역: 대전(원텍연구원)/판교(경영그룹)/해외법인. 대전 소속인데 해외 파견 나간 경우처럼 복수 선택 가능해서 배열로 저장.
  locations text[] not null default '{}',
  rank text not null,
  track text not null check (track in ('사무','사무외국어필수','연구')),
  role text,
  level int default 0,          -- 연차
  -- req_tenure/threshold는 더 이상 계산에 쓰이지 않음(0 저장) — rank_criteria 테이블이 단일 소스
  req_tenure int not null default 0,
  threshold int not null default 0,
  base_pts numeric default 0,   -- 레거시 필드, 더 이상 계산에 사용 안 함(경력직 백필로 대체)
  backfill_full_tenure boolean default false,  -- true면 연차 전체 × 기준점수로 백필(경력직), false면 평가공백만 백필
  leave_years numeric default 0,  -- 휴직 연차: 평가 없이 1년당 6P 고정 가산 + 체류연한에도 합산
  join_date date,              -- 입사일 — 대부분 과거 일괄 이관 데이터라 비어있을 수 있음(CSV로 채워감)
  leave_start_date date,       -- 휴직 시작일
  leave_end_date date,         -- 휴직 종료일(복직일). 비어있으면 아직 휴직 중으로 볼 수 있음
  eng_pts numeric default 0,
  eng_lifetime boolean default false,   -- 영어 AL/IH 평생인정 여부 (유효기간 만료돼도 승진요건 충족)
  cn_pts numeric default 0,
  cn_lifetime boolean default false,
  jp_pts numeric default 0,
  jp_lifetime boolean default false,
  eng2_pts numeric default 0,           -- (레거시) 제2외국어 점수 — cn_pts/jp_pts로 대체됨, 과거 CSV 호환용으로만 보존
  eng2_lifetime boolean default false,  -- (레거시)
  cert_pts numeric default 0,   -- 자격가점 합계(캐시값) — cert_entries 건별 입력을 카테고리 상한 적용해 합산한 값, 앱이 자동 갱신
  tech_pts numeric default 0,   -- 기술성과 합계(캐시값) — tech_entries 건별 입력을 상한(최대6P) 적용해 합산한 값, 앱이 자동 갱신
  award_pts numeric default 0,
  note text,                    -- (레거시) 비고 자유메모 단일 텍스트 — note_entries로 대체됨, 과거 호환용으로만 보존
  note_flag text not null default 'o' check (note_flag in ('+','-','o')),  -- 비고 요약값: +긍정/-부정(근태 등 문제)/o없음, 목록에 배지로 표시
  eval_comment_2025 text,       -- (레거시) 2025년도 평가결과 코멘트 단일 텍스트 — eval_comments로 대체됨, 과거 CSV 호환용으로만 보존
  -- 마이너스 연차 조정/보류 포인트 처리 (연차가 마이너스→플러스로 넘어가는 순간, 그 직전 평가+경력인정
  -- 포인트를 자동으로 반영하지 않고 얼려서 담당자 수동 승인을 받게 함 — 상세 스펙은 pending_point_log 참고)
  has_pending_backfill boolean not null default false,
  pending_points numeric,              -- 얼린 시점의 평가+경력인정 포인트 합계(원본, 불변)
  pending_resolved boolean not null default false,   -- 반영 여부 체크박스
  pending_release_points numeric not null default 0, -- 반영 포인트(자유 입력)
  created_at timestamptz default now()
);

-- 정성평가 코멘트 이력 — 연도 하나에 고정된 단일 텍스트가 아니라, 문제 있을 때마다 날짜 찍어 계속 추가하는 시계열 로그
create table if not exists eval_comments (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id) on delete cascade,
  comment_date date not null default current_date,
  text text not null,
  created_at timestamptz default now()
);
create index if not exists eval_comments_employee_id_idx on eval_comments(employee_id);

-- 비고(근태 등 특이사항) 이력 — note(레거시 단일 텍스트) 대신, 정성평가 코멘트와 같은 방식으로 계속 추가하는 시계열 로그.
-- 목록에 보이는 +/-/o 요약(employees.note_flag)은 그대로 두고, 그 밑의 상세 텍스트만 로그화함.
create table if not exists note_entries (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id) on delete cascade,
  entry_date date not null default current_date,
  text text not null,
  created_at timestamptz default now()
);
create index if not exists note_entries_employee_id_idx on note_entries(employee_id);

-- 자격가점(cert_pts)/기술성과(tech_pts)를 숫자 하나 직접입력 대신 건별로 입력받는 이력.
-- 카테고리별 상한(전문자격 최대6P, 직무자격 최대3P / 기술성과 전체 최대6P)은 앱에서 계산해서
-- employees.cert_pts·tech_pts(캐시값)에 다시 씀 — promotion.js 등 기존 계산 로직은 그대로 그 캐시값을 읽음.
create table if not exists cert_entries (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id) on delete cascade,
  category text not null check (category in ('전문자격','직무자격')),
  name text not null,
  valid_until date,             -- 유효기간(만료일). 평생인정이면 null
  points numeric not null default 0,
  created_at timestamptz default now()
);
create index if not exists cert_entries_employee_id_idx on cert_entries(employee_id);

create table if not exists tech_entries (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id) on delete cascade,
  category text not null check (category in ('국내특허','해외특허','국내논문','국제논문')),
  name text not null,
  achieved_date date,
  points numeric not null default 0,
  created_at timestamptz default now()
);
create index if not exists tech_entries_employee_id_idx on tech_entries(employee_id);

-- 보류 포인트 처리 이력(감사용) — 얼려질 때(frozen) 한 번, 반영여부/반영포인트를 바꿔 저장할 때(resolved)마다 추가
create table if not exists pending_point_log (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id) on delete cascade,
  event_type text not null check (event_type in ('frozen','resolved')),
  held_points numeric,      -- frozen 이벤트: 그 시점 평가+경력인정 포인트 합계
  release_points numeric,   -- resolved 이벤트: 그때 입력한 반영 포인트
  resolved boolean,         -- resolved 이벤트: 그때 체크 상태
  changed_by text,          -- 처리자(로그인 이메일)
  created_at timestamptz default now()
);
create index if not exists pending_point_log_employee_id_idx on pending_point_log(employee_id);

-- 직급별 승진 기준 파라미터 (하드코딩 대신 이 테이블로 관리 — '기준값 설정' 화면에서 편집)
create table if not exists rank_criteria (
  rank text primary key,
  req_tenure int not null default 0,
  threshold int not null default 0,
  backfill_rate numeric not null default 0,  -- 경력직/평가 인정포인트 기준점수(연차당)
  updated_at timestamptz default now()
);

-- 직급과 무관한 전역 설정값(싱글턴, id=1 고정) — 지금은 휴직 요율만 있음
create table if not exists point_settings (
  id int primary key default 1,
  leave_rate_per_year numeric not null default 6,  -- 휴직 1년당 인정 포인트
  updated_at timestamptz default now(),
  constraint point_settings_single_row check (id = 1)
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
  division text,
  dept text,  -- 실→파트로 바로 이어지고 팀 단계가 없는 조직도 있어서 필수 아님(실/팀/파트 중 최소 하나는 앱에서 검증)
  team text,
  locations text[] not null default '{}',
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
  division text,
  dept text,  -- 실→파트로 바로 이어지고 팀 단계가 없는 조직도 있어서 필수 아님(실/팀/파트 중 최소 하나는 앱에서 검증)
  team text,
  locations text[] not null default '{}',
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
  division text, dept text, team text, locations text[], rank text, track text, role text,
  level int, req_tenure int, threshold int,
  base_pts numeric, backfill_full_tenure boolean, leave_years numeric, eng_pts numeric, eng_lifetime boolean,
  cn_pts numeric, cn_lifetime boolean, jp_pts numeric, jp_lifetime boolean,
  cert_pts numeric, tech_pts numeric, award_pts numeric, note text, note_flag text,
  join_date date, leave_start_date date, leave_end_date date,
  evaluations_snapshot jsonb,       -- 삭제 시점의 evaluations 이력 백업 (employees 삭제 시 evaluations는 cascade 삭제되므로)
  eval_comments_snapshot jsonb,     -- 삭제 시점의 eval_comments(정성평가 코멘트 이력) 백업 — 같은 이유로 cascade 삭제되므로
  note_entries_snapshot jsonb,      -- 삭제 시점의 note_entries(비고 이력) 백업 — 같은 이유로 cascade 삭제되므로
  cert_entries_snapshot jsonb,      -- 삭제 시점의 cert_entries(자격가점 이력) 백업 — 같은 이유로 cascade 삭제되므로
  tech_entries_snapshot jsonb,      -- 삭제 시점의 tech_entries(기술성과 이력) 백업 — 같은 이유로 cascade 삭제되므로
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
  division text,
  dept text,  -- 실→파트로 바로 이어지고 팀 단계가 없는 조직도 있어서 필수 아님(실/팀/파트 중 최소 하나는 앱에서 검증)
  team text,
  locations text[] not null default '{}',
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
alter table eval_comments enable row level security;
alter table note_entries enable row level security;
alter table cert_entries enable row level security;
alter table tech_entries enable row level security;
alter table onboarding enable row level security;
alter table onboarding_tasks enable row level security;
alter table hires enable row level security;
alter table resignations enable row level security;
alter table transfers enable row level security;
alter table recruit_positions enable row level security;
alter table recruit_candidates enable row level security;

-- point_settings는 싱글턴(id=1 고정)이라 insert/delete는 막고 select/update만 허용(update는 관리자만)
alter table point_settings enable row level security;
create policy "authenticated_select_point_settings" on point_settings for select to authenticated using (true);
create policy "admin_update_point_settings" on point_settings for update to authenticated
  using (coalesce((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, false))
  with check (coalesce((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, false));

-- rank_criteria: 조회는 전 직원 공개(기준표 화면용), 쓰기는 관리자만(user_metadata.is_admin)
create policy "authenticated_select_rank_criteria" on rank_criteria for select to authenticated using (true);
create policy "admin_insert_rank_criteria" on rank_criteria for insert to authenticated
  with check (coalesce((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, false));
create policy "admin_update_rank_criteria" on rank_criteria for update to authenticated
  using (coalesce((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, false))
  with check (coalesce((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, false));
create policy "admin_delete_rank_criteria" on rank_criteria for delete to authenticated
  using (coalesce((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, false));

-- CSV 다운로드 알림용 로그 — 누구나 자기가 받은 걸 기록할 순 있지만(insert), 목록 조회는 관리자만
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

do $$
declare
  t text;
begin
  for t in select unnest(array[
    'employees','employees_archive','evaluations','eval_comments','note_entries','cert_entries','tech_entries','onboarding','onboarding_tasks',
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
