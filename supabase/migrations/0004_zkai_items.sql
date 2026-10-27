-- v1.3 変更：親が Z会の教材（6教科以外の行）を子どもごとに追加できる
-- 例：「プラス 数学」「定期テスト対策」。チェックリストの表に、6教科と並べて行として出る。
--
-- 0001〜0003 を実行済みのデータベースで、このファイルの中身を全部まとめて実行する。
-- 何度実行しても同じ結果になり、エラーが出たときは何も変更されない。

begin;

create table if not exists zkai_items (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  -- 1回分（1か月）のチェックでもらえるポイント（親が 50pt 単位で設定）
  points integer not null check (points >= 0),
  created_at timestamptz not null default now(),
  -- 親が表から外した日時。外してもチェックの履歴とポイントは残る
  archived_at timestamptz
);
create index if not exists zkai_items_child_idx on zkai_items (child_id);

-- チェックは「6教科のどれか（subject）」か「追加した教材（item_id）」のどちらか一方
alter table zkai_checks add column if not exists item_id uuid references zkai_items (id) on delete cascade;
alter table zkai_checks alter column subject drop not null;
alter table zkai_checks drop constraint if exists zkai_checks_target;
alter table zkai_checks add constraint zkai_checks_target check ((subject is null) <> (item_id is null));

-- 同じマスの有効なチェックは1つだけ（教材の行も含めて）
drop index if exists zkai_checks_active_cell;
create unique index if not exists zkai_checks_active_cell_v2
  on zkai_checks (child_id, grade, month, coalesce(subject, item_id::text)) where revoked_at is null;

alter table zkai_items enable row level security;
drop policy if exists zkai_items_select on zkai_items;
create policy zkai_items_select on zkai_items for select using (can_view_child(child_id));

commit;
