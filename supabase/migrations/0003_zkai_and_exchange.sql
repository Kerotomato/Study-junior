-- v1.2 変更
-- ・テスト目標のポイントは目標ごとに子どもが決める（test_goals.points をそのまま使う。rules.test_points は使わない）
-- ・ポイント交換は、親が「渡した」を付けた時点で完了してポイントを消費する（子どもの「貰った」は廃止）
-- ・Z会チェックリスト（zkai_checks / zkai_point_rules）
--
-- 0001・0002 を実行済みのデータベースで、このファイルの中身を全部まとめて実行する。
-- 何度実行しても同じ結果になり、エラーが出たときは何も変更されない。

begin;

-- ポイント交換：「渡した」が付いていて「貰った」待ちだった交換は、この時点で完了にしてポイントを消費する
insert into point_ledger (child_id, amount, kind, ref_id, created_at)
  select child_id, -points, 'exchange', id::text, coalesce(given_at, now())
  from exchange_requests
  where status = 'pending' and given_at is not null
  on conflict (child_id, kind, ref_id) do nothing;
update exchange_requests set status = 'completed', completed_at = given_at
  where status = 'pending' and given_at is not null;

-- 子どもの学年（Z会の表の初期表示に使う）。grade は grade_year_start 年度のときの学年で、毎年3月に1つ上がる
alter table users add column if not exists grade integer check (grade between 1 and 3);
alter table users add column if not exists grade_year_start integer;

-- 台帳：Z会のチェック（kind='zkai'。外したとき・親が取り消したときはマイナス）
alter table point_ledger drop constraint if exists point_ledger_kind_check;
alter table point_ledger add constraint point_ledger_kind_check
  check (kind in ('study', 'adjust', 'test', 'streak', 'weekly', 'lap', 'exchange', 'revoke', 'zkai'));

-- 通知：親による Z会チェックの取り消し
alter table notifications drop constraint if exists notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in ('log_deleted', 'log_rejected', 'exchange_requested', 'exchange_given', 'exchange_completed', 'exchange_cancelled',
                  'exchange_approved', 'exchange_rejected', 'bonus', 'zkai_revoked'));

-- Z会：教科ごとの1回分のポイント（親が設定）
create table if not exists zkai_point_rules (
  family_id uuid not null references families (id) on delete cascade,
  subject text not null check (subject in ('国語', '数学', '理科', '社会', '英語', '作文')),
  points integer not null check (points >= 0),
  primary key (family_id, subject)
);
insert into zkai_point_rules (family_id, subject, points)
  select f.id, s.subject, s.points
  from families f
  cross join (values ('国語', 300), ('数学', 300), ('理科', 300), ('社会', 300), ('英語', 300), ('作文', 500)) as s (subject, points)
  on conflict (family_id, subject) do nothing;

-- Z会：チェック。外したり親が取り消したりしても行は消さず revoked_at を入れる（もう一度チェックすると新しい行）
create table if not exists zkai_checks (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references users (id) on delete cascade,
  grade integer not null check (grade between 1 and 3),
  -- その学年の年度の開始年（3月始まり）
  year_start integer not null,
  month integer not null check (month between 1 and 12),
  subject text not null check (subject in ('国語', '数学', '理科', '社会', '英語', '作文')),
  -- チェックしたときに付与したポイント（設定が変わっても、取り消すのはこの額）
  points integer not null check (points >= 0),
  checked_at timestamptz not null default now(),
  revoked_at timestamptz,
  -- 親が取り消したときだけ理由が入る（本人が外したときは null）
  revoke_reason text,
  revoked_by uuid references users (id)
);
-- 同じマスの有効なチェックは1つだけ
create unique index if not exists zkai_checks_active_cell on zkai_checks (child_id, grade, month, subject) where revoked_at is null;
create index if not exists zkai_checks_child_idx on zkai_checks (child_id, grade);

alter table zkai_point_rules enable row level security;
alter table zkai_checks enable row level security;
drop policy if exists zkai_point_rules_select on zkai_point_rules;
create policy zkai_point_rules_select on zkai_point_rules for select using (family_id = auth_family_id());
drop policy if exists zkai_checks_select on zkai_checks;
create policy zkai_checks_select on zkai_checks for select using (can_view_child(child_id));

commit;
