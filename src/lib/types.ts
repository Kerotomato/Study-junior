export type Role = "parent" | "child";

export interface Profile {
  id: string;
  family_id: string;
  role: Role;
  name: string;
  login_id: string | null;
}

/** 子どもの学年（Z会の表で使う）。grade は grade_year_start 年度のときの学年 */
export interface ChildGrade {
  id: string;
  grade: number | null;
  grade_year_start: number | null;
}

export interface Subject {
  id: string;
  family_id: string;
  name: string;
}

export interface Material {
  id: string;
  child_id: string;
  subject_id: string | null;
  name: string;
  total_pages: number;
  current_page: number;
  laps: number;
  lap_points: number;
}

export interface StudyLog {
  id: string;
  child_id: string;
  subject_id: string | null;
  material_id: string | null;
  study_date: string;
  started_at: string | null;
  minutes: number;
  method: "timer" | "manual";
  pages_to: number | null;
  points: number;
  memo: string | null;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  /** 取り消された理由：deleted（親が削除）／rejected（親が手入力記録を却下） */
  removed_as: "deleted" | "rejected" | null;
  delete_reason: string | null;
  deleted_by: string | null;
}

export interface Task {
  id: string;
  child_id: string;
  date: string;
  /** 空なら教材・ページ範囲や科目から表示名を作る（taskLabel） */
  title: string | null;
  subject_id: string | null;
  material_id: string | null;
  pages_from: number | null;
  pages_to: number | null;
  done: boolean;
  created_by: string;
}

export interface TestGoal {
  id: string;
  child_id: string;
  name: string;
  condition_type: "min_score" | "pass";
  min_score: number | null;
  points: number;
  achieved_at: string | null;
  created_by: string | null;
}

export interface TestResult {
  id: string;
  child_id: string;
  goal_id: string;
  score: number | null;
  passed: boolean;
  created_at: string;
}

export interface Rules {
  family_id: string;
  weekday_rate: number;
  holiday_rate: number;
  streak_days: number;
  streak_points: number;
  weekly_minutes: number;
  weekly_points: number;
}

export type LedgerKind = "study" | "adjust" | "test" | "streak" | "weekly" | "lap" | "exchange" | "revoke" | "zkai";

export interface LedgerEntry {
  id: string;
  child_id: string;
  amount: number;
  kind: LedgerKind;
  ref_id: string;
  note: string | null;
  created_at: string;
}

/** 交換は親が「渡した」にチェックした時点で完了し、そのときにポイントを消費する */
export interface ExchangeRequest {
  id: string;
  child_id: string;
  points: number;
  status: "pending" | "completed" | "cancelled";
  created_at: string;
  given_at: string | null;
  given_by: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
}

export interface Notification {
  id: string;
  user_id: string;
  type:
    | "log_deleted"
    | "log_rejected"
    | "exchange_requested"
    | "exchange_given"
    | "exchange_completed"
    | "exchange_cancelled"
    | "exchange_approved"
    | "exchange_rejected"
    | "bonus"
    | "zkai_revoked";
  message: string;
  read: boolean;
  created_at: string;
}

export const LEDGER_KIND_LABEL: Record<LedgerKind, string> = {
  study: "勉強",
  adjust: "記録の修正",
  test: "テスト",
  streak: "連続記録ボーナス",
  weekly: "週の目標達成",
  lap: "ワーク1周ボーナス",
  exchange: "交換",
  revoke: "取り消し",
  zkai: "Z会",
};

export interface ZkaiCheck {
  id: string;
  child_id: string;
  grade: number;
  year_start: number;
  month: number;
  /** 6教科のどれか。追加した教材のチェックなら null */
  subject: string | null;
  /** 追加した教材のチェックなら教材の id */
  item_id: string | null;
  points: number;
  checked_at: string;
  revoked_at: string | null;
  revoke_reason: string | null;
  revoked_by: string | null;
}

/** 親が子どもごとに追加した Z会の教材（表の行） */
export interface ZkaiItem {
  id: string;
  child_id: string;
  name: string;
  points: number;
  created_at: string;
  archived_at: string | null;
}

export interface ZkaiPointRule {
  family_id: string;
  subject: string;
  points: number;
}
