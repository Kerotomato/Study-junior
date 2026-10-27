// ポイント計算のルール（I/O を持たない純粋関数）
import holidayJp from "@holiday-jp/holiday_jp";
import { addDays, dayOfWeek } from "./dates";
import type { Material, Rules, TestGoal } from "./types";

/** 1日の記録合計の上限（23時間） */
export const MAX_DAILY_MINUTES = 23 * 60;

/** 土日・祝日は休日レート */
export function isHolidayRateDay(date: string): boolean {
  const dow = dayOfWeek(date);
  return dow === 0 || dow === 6 || holidayJp.isHoliday(date);
}

export function ratePerMinute(date: string, rules: Pick<Rules, "weekday_rate" | "holiday_rate">): number {
  return isHolidayRateDay(date) ? rules.holiday_rate : rules.weekday_rate;
}

export function studyPoints(
  minutes: number,
  date: string,
  rules: Pick<Rules, "weekday_rate" | "holiday_rate">,
): number {
  return minutes * ratePerMinute(date, rules);
}

/** 既存の記録合計に追加しても 1日の上限を超えないか */
export function fitsDailyLimit(existingMinutes: number, addMinutes: number): boolean {
  return existingMinutes + addMinutes <= MAX_DAILY_MINUTES;
}

/**
 * changedDate に記録が増えたとき、連続記録ボーナスの対象になる日付を返す。
 * 連続日数が streakDays の倍数に達した日が対象（7日、14日、21日…）。
 * changedDate より前の日の連続日数は変わらないので、changedDate 以降だけを見る。
 */
export function streakMilestones(recordDates: Iterable<string>, changedDate: string, streakDays: number): string[] {
  const dates = new Set(recordDates);
  if (!dates.has(changedDate) || streakDays <= 0) return [];
  let start = changedDate;
  while (dates.has(addDays(start, -1))) start = addDays(start, -1);
  const result: string[] = [];
  let count = 0;
  for (let d = start; dates.has(d); d = addDays(d, 1)) {
    count += 1;
    if (d >= changedDate && count % streakDays === 0) result.push(d);
  }
  return result;
}

/** 今日までの連続記録日数。今日まだ記録がなければ昨日までの連続日数（まだ途切れていない） */
export function currentStreak(recordDates: Iterable<string>, today: string): number {
  const dates = new Set(recordDates);
  let d = dates.has(today) ? today : addDays(today, -1);
  let count = 0;
  while (dates.has(d)) {
    count += 1;
    d = addDays(d, -1);
  }
  return count;
}

export interface PageProgress {
  currentPage: number;
  /** この更新で最終ページに到達した（1周完了） */
  completedLap: boolean;
}

/**
 * 「何ページまで進んだか」を教材に反映する。戻る方向の入力は無視する。
 * すでに1周完了している教材は、2周目を開始するまで進めない。
 */
export function applyPages(material: Pick<Material, "current_page" | "total_pages">, pagesTo: number): PageProgress {
  const { current_page, total_pages } = material;
  if (current_page >= total_pages) return { currentPage: current_page, completedLap: false };
  const next = Math.min(Math.max(pagesTo, current_page), total_pages);
  return { currentPage: next, completedLap: next >= total_pages };
}

export function progressPercent(material: Pick<Material, "current_page" | "total_pages">): number {
  return Math.floor((Math.min(material.current_page, material.total_pages) / material.total_pages) * 100);
}

/** テスト結果が目標を満たすか */
export function meetsTestGoal(
  goal: Pick<TestGoal, "condition_type" | "min_score">,
  result: { score: number | null; passed: boolean },
): boolean {
  if (goal.condition_type === "min_score") {
    return result.score !== null && goal.min_score !== null && result.score >= goal.min_score;
  }
  return result.passed;
}

export function describeTestGoal(goal: Pick<TestGoal, "condition_type" | "min_score">): string {
  return goal.condition_type === "min_score" ? `${goal.min_score}点以上` : "合格";
}

/**
 * 記録を編集したときのポイント。保存時のレート（points ÷ minutes）を使い、
 * あとからルールのレートが変わっても、その日の記録の単価は変えない。
 */
export function recalcStudyPoints(log: { points: number; minutes: number }, newMinutes: number): number {
  return Math.round((log.points / log.minutes) * newMinutes);
}
