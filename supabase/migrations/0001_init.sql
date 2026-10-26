-- 勉強ごほうびアプリ 初期スキーマ
-- 読み取りは RLS で家族ごとに分離する。書き込みはすべてサーバー（service role）経由で行い、
-- authenticated ロールには書き込みポリシーを与えない（子どもが自分でポイントを付与できないようにするため）。

create extension if not exists pgcrypto;

create table families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table users (
  id uuid primary key references auth.users (id) on delete cascade,
  family_id uuid not null references families (id) on delete cascade,
  role text not null check (role in ('parent', 'child')),
  name text not null,
  -- 子どものログインID（親はメールアドレスでログインするので null）
  login_id text unique,
  created_at timestamptz not null default now()
);
create index users_family_idx on users (family_id);

create table subjects (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
create index subjects_family_idx on subjects (family_id);

create table materials (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references users (id) on delete cascade,
  subject_id uuid references subjects (id) on delete set null,
  name text not null,
  total_pages integer not null check (total_pages > 0),
  current_page integer not null default 0 check (current_page >= 0),
  laps integer not null default 0,
  -- 1周完了ボーナス（教材ごとに親が設定）
  lap_points integer not null default 2000 check (lap_points >= 0),
  created_at timestamptz not null default now()
);
create index materials_child_idx on materials (child_id);

create table study_logs (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references users (id) on delete cascade,
  subject_id uuid references subjects (id) on delete set null,
  material_id uuid references materials (id) on delete set null,
  -- 記録の日付（日本時間）。レート判定・1日上限・連続日数はこの日付で行う
  study_date date not null,
  started_at timestamptz,
  minutes integer not null check (minutes between 1 and 1380),
  method text not null check (method in ('timer', 'manual')),
  pages_to integer check (pages_to >= 0),
  -- 保存時に付与したポイント（レート変更後も当時の値を残す）
  points integer not null default 0,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  delete_reason text,
  deleted_by uuid references users (id),
  constraint delete_reason_required check (deleted_at is null or coalesce(length(trim(delete_reason)), 0) > 0)
);
create index study_logs_child_date_idx on study_logs (child_id, study_date);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references users (id) on delete cascade,
  date date not null,
  title text not null,
  material_id uuid references materials (id) on delete set null,
  -- 教材と紐づけたタスクで、完了時に進めるページ
  pages_to integer check (pages_to >= 0),
  done boolean not null default false,
  done_at timestamptz,
  created_by uuid not null references users (id),
  created_at timestamptz not null default now()
);
create index tasks_child_date_idx on tasks (child_id, date);

create table test_goals (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references users (id) on delete cascade,
  name text not null,
  -- min_score: 点数が min_score 以上で達成 / pass: 合格・不合格で判定（英検など）
  condition_type text not null check (condition_type in ('min_score', 'pass')),
  min_score integer,
  points integer not null check (points >= 0),
  achieved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint min_score_required check (condition_type <> 'min_score' or min_score is not null)
);
create index test_goals_child_idx on test_goals (child_id);

create table test_results (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references users (id) on delete cascade,
  goal_id uuid not null references test_goals (id) on delete cascade,
  score integer,
  passed boolean not null,
  created_at timestamptz not null default now()
);
create index test_results_child_idx on test_results (child_id);

create table rules (
  family_id uuid primary key references families (id) on delete cascade,
  weekday_rate integer not null default 5 check (weekday_rate >= 0),
  holiday_rate integer not null default 10 check (holiday_rate >= 0),
  streak_days integer not null default 7 check (streak_days > 0),
  streak_points integer not null default 500 check (streak_points >= 0),
  weekly_minutes integer not null default 600 check (weekly_minutes > 0),
  weekly_points integer not null default 1000 check (weekly_points >= 0),
  updated_at timestamptz not null default now()
);

create table point_ledger (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references users (id) on delete cascade,
  amount integer not null,
  kind text not null check (kind in ('study', 'test', 'streak', 'weekly', 'lap', 'exchange', 'revoke')),
  -- 何に対する増減か（記録ID、目標ID、日付など）。(child_id, kind, ref_id) で二重付与を防ぐ
  ref_id text not null,
  note text,
  created_at timestamptz not null default now(),
  unique (child_id, kind, ref_id)
);
create index point_ledger_child_idx on point_ledger (child_id, created_at);

create table exchange_requests (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references users (id) on delete cascade,
  points integer not null check (points > 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references users (id),
  reason text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index exchange_requests_child_idx on exchange_requests (child_id);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  type text not null check (type in ('log_deleted', 'exchange_approved', 'exchange_rejected', 'bonus')),
  message text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on notifications (user_id, created_at);

-- ログイン中ユーザーの家族・役割（RLS 用）
create function auth_family_id() returns uuid
language sql stable security definer set search_path = public as $$
  select family_id from users where id = auth.uid()
$$;

create function auth_role() returns text
language sql stable security definer set search_path = public as $$
  select role from users where id = auth.uid()
$$;

-- 本人、または同じ家族の親なら子どものデータを見られる
create function can_view_child(target uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select target = auth.uid()
    or exists (
      select 1 from users me join users c on c.family_id = me.family_id
      where me.id = auth.uid() and me.role = 'parent' and c.id = target
    )
$$;

alter table families enable row level security;
alter table users enable row level security;
alter table subjects enable row level security;
alter table materials enable row level security;
alter table study_logs enable row level security;
alter table tasks enable row level security;
alter table test_goals enable row level security;
alter table test_results enable row level security;
alter table rules enable row level security;
alter table point_ledger enable row level security;
alter table exchange_requests enable row level security;
alter table notifications enable row level security;

create policy families_select on families for select using (id = auth_family_id());
create policy users_select on users for select using (family_id = auth_family_id());
create policy subjects_select on subjects for select using (family_id = auth_family_id());
create policy rules_select on rules for select using (family_id = auth_family_id());
create policy materials_select on materials for select using (can_view_child(child_id));
create policy study_logs_select on study_logs for select using (can_view_child(child_id));
create policy tasks_select on tasks for select using (can_view_child(child_id));
create policy test_goals_select on test_goals for select using (can_view_child(child_id));
create policy test_results_select on test_results for select using (can_view_child(child_id));
create policy point_ledger_select on point_ledger for select using (can_view_child(child_id));
create policy exchange_requests_select on exchange_requests for select using (can_view_child(child_id));
create policy notifications_select on notifications for select using (user_id = auth.uid());
