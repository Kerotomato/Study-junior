// Z会チェックリストのルール（I/O を持たない純粋関数）
// Z会の年度は3月始まり〜翌2月。学年もこの区切りで1つ上がる。

export const ZKAI_SUBJECTS = ["国語", "数学", "理科", "社会", "英語", "作文"] as const;
export type ZkaiSubject = (typeof ZKAI_SUBJECTS)[number];

/** 表の列の並び（3月始まり） */
export const ZKAI_MONTHS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2] as const;

export const ZKAI_GRADES = [1, 2, 3] as const;

/** 親がまだ設定していないときの1回分のポイント */
export const ZKAI_DEFAULT_POINTS: Record<ZkaiSubject, number> = {
  国語: 300,
  数学: 300,
  理科: 300,
  社会: 300,
  英語: 300,
  作文: 500,
};

export function isZkaiSubject(v: string): v is ZkaiSubject {
  return (ZKAI_SUBJECTS as readonly string[]).includes(v);
}

/** 日付（YYYY-MM-DD）が属する Z会年度の開始年。2027-02 は 2026年度 */
export function zkaiYearStart(date: string): number {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  return month >= 3 ? year : year - 1;
}

/** 年度と月から、実際の年・月を返す（1月・2月は翌年） */
export function zkaiCalendarMonth(yearStart: number, month: number): { year: number; month: number } {
  return { year: month >= 3 ? yearStart : yearStart + 1, month };
}

/**
 * いまの学年。親が設定した学年（grade）とそのときの年度（gradeYearStart）から、年度が進んだ分だけ上げる。
 * 未設定なら null。
 */
export function currentZkaiGrade(grade: number | null, gradeYearStart: number | null, today: string): number | null {
  if (grade === null || gradeYearStart === null) return null;
  return grade + (zkaiYearStart(today) - gradeYearStart);
}

/** その学年の表がどの年度か */
export function yearStartOfGrade(grade: number, currentGrade: number, today: string): number {
  return zkaiYearStart(today) - (currentGrade - grade);
}

/** チェックできるマスか。未来の月（まだ届いていない号）はチェックできない */
export function isZkaiMonthOpen(yearStart: number, month: number, today: string): boolean {
  const { year, month: m } = zkaiCalendarMonth(yearStart, month);
  const ty = Number(today.slice(0, 4));
  const tm = Number(today.slice(5, 7));
  return year < ty || (year === ty && m <= tm);
}

export interface ZkaiCellKey {
  grade: number;
  month: number;
  subject: string;
}

/** 今月まだチェックしていない教科 */
export function remainingThisMonth(activeChecks: ZkaiCellKey[], currentGrade: number, today: string): ZkaiSubject[] {
  const month = Number(today.slice(5, 7));
  const done = new Set(activeChecks.filter((c) => c.grade === currentGrade && c.month === month).map((c) => c.subject));
  return ZKAI_SUBJECTS.filter((s) => !done.has(s));
}

/** 表示する学年。URL で選ばれていればそれ、なければ今の学年（表は1〜3年なので範囲に収める） */
export function pickGrade(param: string | string[] | undefined, current: number): number {
  const g = Number(param);
  if ((ZKAI_GRADES as readonly number[]).includes(g)) return g;
  return Math.min(3, Math.max(1, current));
}
