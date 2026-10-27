-- v1.1 変更
-- ・タスクは名前なしでも作れる（教材＋ページ範囲、科目だけでも可）
-- ・勉強記録にメモ、後からの編集、親による手入力記録の却下
-- ・テスト目標は子どもが設定（ポイントは親がルールで決める）
-- ・ポイント交換は親の承認を廃止し、「渡した（親）」「貰った（子）」の両方のチェックで完了
--
-- 0001_init.sql を実行済みのデータベースで、このファイルの中身を全部まとめて実行する。
-- 途中で止まった場合や、2回実行した場合でもエラーにならないように書いてある（何度実行しても同じ結果）。
-- 全体を1つのトランザクションにしているので、エラーが出たときは何も変更されない。

begin;

-- タスク
alter table tasks alter column title drop not null;
alter table tasks add column if not exists subject_id uuid references subjects (id) on delete set null;
alter table tasks add column if not exists pages_from integer check (pages_from >= 0);

-- 勉強記録
alter table study_logs add column if not exists memo text;
alter table study_logs add column if not exists edited_at timestamptz;
-- 取り消された理由：deleted（親が削除）／rejected（親が手入力記録を却下）
alter table study_logs add column if not exists removed_as text check (removed_as in ('deleted', 'rejected'));
update study_logs set removed_as = 'deleted' where deleted_at is not null and removed_as is null;
alter table study_logs drop constraint if exists removed_as_matches;
alter table study_logs add constraint removed_as_matches check ((deleted_at is null) = (removed_as is null));

-- 台帳：記録の編集による差分（adjust）を追加
alter table point_ledger drop constraint if exists point_ledger_kind_check;
alter table point_ledger add constraint point_ledger_kind_check
  check (kind in ('study', 'adjust', 'test', 'streak', 'weekly', 'lap', 'exchange', 'revoke'));

-- テスト目標：子どもが作る。達成ポイントは親がルールで決め、作成時の値を目標に残す
alter table rules add column if not exists test_points integer not null default 1000 check (test_points >= 0);
alter table test_goals add column if not exists created_by uuid references users (id);

-- ポイント交換
alter table exchange_requests drop constraint if exists exchange_requests_status_check;
alter table exchange_requests add column if not exists given_at timestamptz;
alter table exchange_requests add column if not exists given_by uuid references users (id);
alter table exchange_requests add column if not exists received_at timestamptz;
alter table exchange_requests add column if not exists completed_at timestamptz;
alter table exchange_requests add column if not exists cancelled_at timestamptz;
-- 以前の承認済みは完了、却下は取り消しとして引き継ぐ
update exchange_requests
  set status = 'completed', given_at = reviewed_at, given_by = reviewed_by, received_at = reviewed_at, completed_at = reviewed_at
  where status = 'approved';
update exchange_requests set status = 'cancelled', cancelled_at = reviewed_at where status = 'rejected';
alter table exchange_requests add constraint exchange_requests_status_check
  check (status in ('pending', 'completed', 'cancelled'));

-- 通知
alter table notifications drop constraint if exists notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in ('log_deleted', 'log_rejected', 'exchange_requested', 'exchange_given', 'exchange_completed', 'exchange_cancelled',
                  'exchange_approved', 'exchange_rejected', 'bonus'));

commit;
