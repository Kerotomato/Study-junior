-- データベースの状態確認用（何も変更しない）。SQL Editor で実行すると、
-- 0001〜0005 がそれぞれ適用済みかどうかを表示する。
select
  case when to_regclass('public.families') is null then '未実行' else '実行済み' end as "0001_init.sql",
  case
    when to_regclass('public.families') is null then '（先に 0001 を実行）'
    when exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'exchange_requests' and column_name = 'given_at'
    ) and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'study_logs' and column_name = 'removed_as'
    ) then '実行済み'
    else '未実行'
  end as "0002_v1_1_changes.sql",
  case
    when to_regclass('public.families') is null then '（先に 0001 を実行）'
    when to_regclass('public.zkai_checks') is not null
      and to_regclass('public.zkai_point_rules') is not null
      and exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'users' and column_name = 'grade_year_start'
      ) then '実行済み'
    else '未実行'
  end as "0003_zkai_and_exchange.sql",
  case
    when to_regclass('public.families') is null then '（先に 0001 を実行）'
    when to_regclass('public.zkai_items') is not null
      and exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'zkai_checks' and column_name = 'item_id'
      ) then '実行済み'
    else '未実行'
  end as "0004_zkai_items.sql",
  case
    when to_regclass('public.families') is null then '（先に 0001 を実行）'
    when to_regclass('public.point_balances') is not null
      and to_regprocedure('public.visible_child_ids()') is not null then '実行済み'
    else '未実行'
  end as "0005_performance.sql";
