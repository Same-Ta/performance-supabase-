-- ProofWork - Supabase 데이터베이스 스키마
-- Supabase 콘솔 > SQL Editor에서 실행하세요.
-- https://supabase.com/dashboard/project/YOUR_PROJECT_REF/sql

-- ============================================================
-- 1. profiles (사용자 프로필)
-- auth.users 와 연동되는 공개 프로필 테이블
-- ============================================================
create table if not exists public.profiles (
  uid           uuid        primary key references auth.users(id) on delete cascade,
  email         text        not null,
  "displayName" text        not null default '',
  role          text        not null default 'employee'
                            check (role in ('employee','manager','hr_admin','super_admin')),
  department    text        not null default '',
  "teamId"      text        not null default '',
  position      text        not null default '',
  "joinDate"    text        not null default '',
  "avatarUrl"   text,
  "agentConnected" boolean  not null default false,
  "lastAgentSync"  text,
  created_at    timestamptz not null default now()
);

-- 신규 회원가입 시 profiles 자동 생성 트리거
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (uid, email, "displayName", "joinDate")
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', '사용자'),
    to_char(now(), 'YYYY-MM-DD')
  )
  on conflict (uid) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- 2. performance_metrics (성과 메트릭)
-- ============================================================
create table if not exists public.performance_metrics (
  id                     text        primary key,
  user_id                text        not null,
  date                   text        not null,
  session_id             text        not null,
  status                 text        not null default 'pending_review'
                                     check (status in ('pending_review','approved','rejected','submitted')),
  total_work_minutes     numeric     not null default 0,
  active_work_minutes    numeric     not null default 0,
  focus_score            numeric     not null default 0,
  efficiency_score       numeric     not null default 0,
  goal_alignment_score   numeric     not null default 0,
  output_score           numeric     not null default 0,
  context_switch_count   integer     not null default 0,
  context_switch_rate    numeric     not null default 0,
  input_density          numeric     not null default 0,
  deep_focus_minutes     numeric     not null default 0,
  software_usage         jsonb       not null default '[]',
  timeline               jsonb               default '[]',
  ai_summary             text        not null default '',
  key_achievements       jsonb       not null default '[]',
  suggested_improvements jsonb       not null default '[]',
  task_type              text,
  session_start_time     text,
  session_end_time       text,
  work_narrative         text,
  screen_contexts        jsonb               default '[]',
  screen_analysis_count  integer             default 0,
  user_notes             text,
  created_at             timestamptz not null default now(),
  approved_at            timestamptz,
  submitted_at           timestamptz
);

create index if not exists idx_metrics_user_date
  on public.performance_metrics(user_id, date desc);

-- ============================================================
-- 3. performance_reports (성과 리포트)
-- ============================================================
create table if not exists public.performance_reports (
  id              text        primary key,
  user_id         text        not null,
  "userName"      text        not null default '',
  period          text,
  "startDate"     text,
  "endDate"       text,
  status          text        not null default 'draft'
                              check (status in ('draft','finalized','shared')),
  "overallScore"  numeric     default 0,
  "overallGrade"  text,
  report_data     jsonb       default '{}',
  created_at      timestamptz not null default now()
);

create index if not exists idx_reports_user
  on public.performance_reports(user_id, created_at desc);

-- ============================================================
-- 4. goals (OKR/KPI 목표)
-- ============================================================
create table if not exists public.goals (
  id              text        primary key,
  organization_id text        not null,
  team_id         text,
  type            text        not null default 'kpi'
                              check (type in ('okr','kpi')),
  title           text        not null,
  description     text        not null default '',
  keywords        jsonb       not null default '[]',
  related_apps    jsonb       not null default '[]',
  weight          numeric     not null default 1,
  target_value    numeric,
  current_value   numeric,
  period          text        not null default '',
  status          text        not null default 'active'
                              check (status in ('active','completed','paused')),
  created_at      timestamptz not null default now()
);

-- ============================================================
-- 5. rewards (보상/티어)
-- ============================================================
create table if not exists public.rewards (
  user_id             text        primary key,
  "currentTier"       text        not null default 'explorer',
  "currentScore"      numeric     not null default 0,
  "streakDays"        integer     not null default 0,
  "unlockedBenefits"  jsonb       not null default '[]',
  "nextTierProgress"  numeric     not null default 0,
  updated_at          timestamptz not null default now()
);

-- ============================================================
-- 6. team_dashboards (팀 대시보드)
-- ============================================================
create table if not exists public.team_dashboards (
  team_id             text        primary key,
  team_name           text        not null default '',
  member_count        integer     not null default 0,
  avg_focus_score     numeric     not null default 0,
  avg_efficiency      numeric     not null default 0,
  avg_goal_alignment  numeric     not null default 0,
  member_stats        jsonb       default '[]',
  last_updated        timestamptz not null default now()
);

-- ============================================================
-- 7. integrations (외부 서비스 연동)
-- ============================================================
create table if not exists public.integrations (
  id              text        primary key default gen_random_uuid()::text,
  organization_id text        not null,
  type            text        not null check (type in ('jira','slack','notion','github')),
  enabled         boolean     not null default false,
  config          jsonb       not null default '{}',
  created_at      timestamptz not null default now()
);

-- ============================================================
-- 8. notifications (알림)
-- ============================================================
create table if not exists public.notifications (
  id          text        primary key default gen_random_uuid()::text,
  user_id     text        not null,
  type        text        not null,
  title       text        not null,
  message     text        not null,
  read        boolean     not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists idx_notifications_user
  on public.notifications(user_id, created_at desc);

-- ============================================================
-- 9. team_invites (팀 초대)
-- ============================================================
create table if not exists public.team_invites (
  id             text        primary key default gen_random_uuid()::text,
  inviter_uid    text        not null,
  inviter_name   text        not null default '',
  inviter_email  text        not null default '',
  team_id        text        not null,
  team_name      text        not null default '',
  email          text        not null,
  role           text        not null default 'employee'
                             check (role in ('employee','manager')),
  status         text        not null default 'pending'
                             check (status in ('pending','accepted','declined')),
  created_at     timestamptz not null default now(),
  responded_at   timestamptz
);

-- ============================================================
-- 10. workspaces (워크스페이스)
-- ============================================================
create table if not exists public.workspaces (
  id          text        primary key default gen_random_uuid()::text,
  name        text        not null,
  description text        not null default '',
  owner_id    text        not null,
  owner_name  text        not null default '',
  member_ids  text[]      not null default '{}',
  members     jsonb       not null default '[]',
  created_at  timestamptz not null default now()
);

-- ============================================================
-- 11. activity_logs (활동 로그)
-- ============================================================
create table if not exists public.activity_logs (
  id          text        primary key default gen_random_uuid()::text,
  user_id     text        not null,
  action      text        not null,
  details     text,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- RLS (Row Level Security) 정책
-- ============================================================

-- profiles: 본인 데이터만 읽기/쓰기
alter table public.profiles enable row level security;

drop policy if exists "profiles: 본인 조회" on public.profiles;
create policy "profiles: 본인 조회"
  on public.profiles for select
  using (auth.uid() = uid);

drop policy if exists "profiles: 본인 수정" on public.profiles;
create policy "profiles: 본인 수정"
  on public.profiles for all
  using (auth.uid() = uid);

-- performance_metrics: 본인 데이터만
alter table public.performance_metrics enable row level security;

drop policy if exists "metrics: 본인 조회" on public.performance_metrics;
create policy "metrics: 본인 조회"
  on public.performance_metrics for select
  using (auth.uid()::text = user_id);

drop policy if exists "metrics: 본인 수정" on public.performance_metrics;
create policy "metrics: 본인 수정"
  on public.performance_metrics for all
  using (auth.uid()::text = user_id);

-- notifications: 본인 알림만
alter table public.notifications enable row level security;

drop policy if exists "notifications: 본인 조회" on public.notifications;
create policy "notifications: 본인 조회"
  on public.notifications for select
  using (auth.uid()::text = user_id);

drop policy if exists "notifications: 본인 수정" on public.notifications;
create policy "notifications: 본인 수정"
  on public.notifications for update
  using (auth.uid()::text = user_id);

-- team_invites: 초대한 사람 또는 초대받은 이메일
alter table public.team_invites enable row level security;

drop policy if exists "invites: 관련자 조회" on public.team_invites;
create policy "invites: 관련자 조회"
  on public.team_invites for select
  using (
    auth.uid()::text = inviter_uid
    or email = (select email from auth.users where id = auth.uid())
  );

drop policy if exists "invites: 초대자 수정" on public.team_invites;
create policy "invites: 초대자 수정"
  on public.team_invites for all
  using (auth.uid()::text = inviter_uid);

-- 나머지 테이블: 인증된 사용자 모두 접근 가능
alter table public.performance_reports enable row level security;
drop policy if exists "reports: 인증 유저" on public.performance_reports;
create policy "reports: 인증 유저"
  on public.performance_reports for all
  using (auth.role() = 'authenticated');

alter table public.goals enable row level security;
drop policy if exists "goals: 인증 유저" on public.goals;
create policy "goals: 인증 유저"
  on public.goals for all
  using (auth.role() = 'authenticated');

alter table public.rewards enable row level security;
drop policy if exists "rewards: 본인 조회" on public.rewards;
create policy "rewards: 본인 조회"
  on public.rewards for select
  using (auth.uid()::text = user_id);

alter table public.team_dashboards enable row level security;
drop policy if exists "dashboards: 인증 유저" on public.team_dashboards;
create policy "dashboards: 인증 유저"
  on public.team_dashboards for select
  using (auth.role() = 'authenticated');

alter table public.integrations enable row level security;
drop policy if exists "integrations: 인증 유저" on public.integrations;
create policy "integrations: 인증 유저"
  on public.integrations for all
  using (auth.role() = 'authenticated');

alter table public.workspaces enable row level security;
drop policy if exists "workspaces: 멤버 조회" on public.workspaces;
create policy "workspaces: 멤버 조회"
  on public.workspaces for select
  using (auth.uid()::text = any(member_ids));

drop policy if exists "workspaces: 소유자 수정" on public.workspaces;
create policy "workspaces: 소유자 수정"
  on public.workspaces for all
  using (auth.uid()::text = owner_id);
