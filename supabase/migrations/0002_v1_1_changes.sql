-- v1.1 変更
-- ・タスクは名前なしでも作れる（教材＋ページ範囲、科目だけでも可）
-- ・勉強記録にメモ、後からの編集、親による手入力記録の却下
-- ・テスト目標は子どもが設定（ポイントは親がルールで決める）
-- ・ポイント交換は親の承認を廃止し、「渡した（親）」「貰った（子）」の両方のチェックで完了

-- タスク
alter table tasks alter column title drop not null;
alter table tasks add column subject_id uuid references subjects (id) on delete set null;
alter table tasks add column pages_from integer check (pages_from >= 0);

-- 勉強記録
alter table study_logs add column memo text;
alter table study_logs add column edited_at timestamptz;
-- 取り消された理由：deleted（親が削除）／rejected（親が手入力記録を却下）
alter table study_logs add column removed_as text check (removed_as in ('deleted', 'rejected'));
update study_logs set removed_as = 'deleted' where deleted_at is not null;
alter table study_logs add constraint removed_as_matches check ((deleted_at is null) = (removed_as is null));

-- 台帳：記録の編集による差分（adjust）を追加
alter table point_ledger drop constraint point_ledger_kind_check;
alter table point_ledger add constraint point_ledger_kind_check
  check (kind in ('study', 'adjust', 'test', 'streak', 'weekly', 'lap', 'exchange', 'revoke'));

-- テスト目標：子どもが作る。達成ポイントは親がルールで決め、作成時の値を目標に残す
alter table rules add column test_points integer not null default 1000 check (test_points >= 0);
alter table test_goals add column created_by uuid references users (id);

-- ポイント交換
alter table exchange_requests drop constraint exchange_requests_status_check;
alter table exchange_requests add column given_at timestamptz;
alter table exchange_requests add column given_by uuid references users (id);
alter table exchange_requests add column received_at timestamptz;
alter table exchange_requests add column completed_at timestamptz;
alter table exchange_requests add column cancelled_at timestamptz;
-- 以前の承認済みは完了、却下は取り消しとして引き継ぐ
update exchange_requests
  set status = 'completed', given_at = reviewed_at, given_by = reviewed_by, received_at = reviewed_at, completed_at = reviewed_at
  where status = 'approved';
update exchange_requests set status = 'cancelled', cancelled_at = reviewed_at where status = 'rejected';
alter table exchange_requests add constraint exchange_requests_status_check
  check (status in ('pending', 'completed', 'cancelled'));

-- 通知
alter table notifications drop constraint notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in ('log_deleted', 'log_rejected', 'exchange_requested', 'exchange_given', 'exchange_completed', 'exchange_cancelled',
                  'exchange_approved', 'exchange_rejected', 'bonus'));
