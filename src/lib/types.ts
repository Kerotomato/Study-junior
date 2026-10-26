export type Role = "parent" | "child";

export interface Profile {
  id: string;
  family_id: string;
  role: Role;
  name: string;
  login_id: string | null;
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
  created_at: string;
  deleted_at: string | null;
  delete_reason: string | null;
  deleted_by: string | null;
}

export interface Task {
  id: string;
  child_id: string;
  date: string;
  title: string;
  material_id: string | null;
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

export type LedgerKind = "study" | "test" | "streak" | "weekly" | "lap" | "exchange" | "revoke";

export interface LedgerEntry {
  id: string;
  child_id: string;
  amount: number;
  kind: LedgerKind;
  ref_id: string;
  note: string | null;
  created_at: string;
}

export interface ExchangeRequest {
  id: string;
  child_id: string;
  points: number;
  status: "pending" | "approved" | "rejected";
  reviewed_by: string | null;
  reason: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export interface Notification {
  id: string;
  user_id: string;
  type: "log_deleted" | "exchange_approved" | "exchange_rejected" | "bonus";
  message: string;
  read: boolean;
  created_at: string;
}

export const LEDGER_KIND_LABEL: Record<LedgerKind, string> = {
  study: "勉強",
  test: "テスト",
  streak: "連続記録ボーナス",
  weekly: "週の目標達成",
  lap: "ワーク1周ボーナス",
  exchange: "交換",
  revoke: "取り消し",
};
