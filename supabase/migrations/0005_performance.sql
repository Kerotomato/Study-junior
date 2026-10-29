-- 表示の高速化（ポイント計算・権限の結果は変わらない）
-- ・ポイント残高は集計用のビュー（point_balances）で DB 側で合計し、台帳の全件をアプリに送らない
-- ・よく絞り込む列にインデックスを追加
-- ・行ごとの権限チェック（RLS）で関数を1行ずつ呼ばないようにする（1回の問い合わせで1回だけ評価）
--
-- 0001〜0004 を実行済みのデータベースで、このファイルの中身を全部まとめて実行する。
-- 何度実行しても同じ結果になり、エラーが出たときは何も変更されない。

begin;

-- 残高ビュー。security_invoker なので、見る人の権限（RLS）で台帳が絞られる（他の家族の残高は見えない）
create or replace view point_balances with (security_invoker = true) as
  select child_id, sum(amount)::integer as balance
  from point_ledger
  group by child_id;
grant select on point_balances to authenticated;

-- インデックス
-- 残高の合計を、表を読まずにインデックスだけで計算できるようにする
create index if not exists point_ledger_child_amount_idx on point_ledger (child_id) include (amount);
create index if not exists exchange_requests_child_status_idx on exchange_requests (child_id, status);
create index if not exists notifications_unread_idx on notifications (user_id) where read = false;
create index if not exists study_logs_child_active_date_idx on study_logs (child_id, study_date) where deleted_at is null;
create index if not exists test_goals_child_created_idx on test_goals (child_id, created_at);
create index if not exists users_family_role_idx on users (family_id, role);

-- ログイン中の人が見られる子どもの id（本人、または同じ家族の親なら家族の子ども全員）
create or replace function visible_child_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select auth.uid()
  union
  select c.id from users me join users c on c.family_id = me.family_id
  where me.id = auth.uid() and me.role = 'parent' and c.role = 'child'
$$;

-- RLS：これまでと同じ条件のまま、関数を「(select …)」で包んで1回の問い合わせにつき1回だけ評価する
drop policy if exists families_select on families;
create policy families_select on families for select using (id = (select auth_family_id()));
drop policy if exists users_select on users;
create policy users_select on users for select using (family_id = (select auth_family_id()));
drop policy if exists subjects_select on subjects;
create policy subjects_select on subjects for select using (family_id = (select auth_family_id()));
drop policy if exists rules_select on rules;
create policy rules_select on rules for select using (family_id = (select auth_family_id()));
drop policy if exists zkai_point_rules_select on zkai_point_rules;
create policy zkai_point_rules_select on zkai_point_rules for select using (family_id = (select auth_family_id()));
drop policy if exists notifications_select on notifications;
create policy notifications_select on notifications for select using (user_id = (select auth.uid()));

drop policy if exists materials_select on materials;
create policy materials_select on materials for select using (child_id in (select visible_child_ids()));
drop policy if exists study_logs_select on study_logs;
create policy study_logs_select on study_logs for select using (child_id in (select visible_child_ids()));
drop policy if exists tasks_select on tasks;
create policy tasks_select on tasks for select using (child_id in (select visible_child_ids()));
drop policy if exists test_goals_select on test_goals;
create policy test_goals_select on test_goals for select using (child_id in (select visible_child_ids()));
drop policy if exists test_results_select on test_results;
create policy test_results_select on test_results for select using (child_id in (select visible_child_ids()));
drop policy if exists point_ledger_select on point_ledger;
create policy point_ledger_select on point_ledger for select using (child_id in (select visible_child_ids()));
drop policy if exists exchange_requests_select on exchange_requests;
create policy exchange_requests_select on exchange_requests for select using (child_id in (select visible_child_ids()));
drop policy if exists zkai_checks_select on zkai_checks;
create policy zkai_checks_select on zkai_checks for select using (child_id in (select visible_child_ids()));
drop policy if exists zkai_items_select on zkai_items;
create policy zkai_items_select on zkai_items for select using (child_id in (select visible_child_ids()));

commit;
