// Z会チェックリストのルール（I/O を持たない純粋関数）
// Z会の年度は3月始まり〜翌2月。学年もこの区切りで1つ上がる。

export const ZKAI_SUBJECTS = ["国語", "数学", "理科", "社会", "英語", "作文"] as const;
export type ZkaiSubject = (typeof ZKAI_SUBJECTS)[number];

/** 表の列の並び（3月始まり） */
export const ZKAI_MONTHS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2] as const;

export const ZKAI_GRADES = [1, 2, 3] as const;

/** 親が設定する1回分のポイントの単位（50pt ずつ増減）。追加した教材のポイントも同じ */
export const ZKAI_POINT_STEP = 50;

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

/**
 * 表の1行。6教科（subject）か、親が子どもごとに追加した教材（itemId）のどちらか。
 * key はチェックとマスを結びつけるのに使う（教科名、または "item:<id>"）。
 */
export interface ZkaiRow {
  key: string;
  label: string;
  points: number;
  subject: ZkaiSubject | null;
  itemId: string | null;
}

export function zkaiRowKey(check: { subject: string | null; item_id: string | null }): string {
  return check.subject ?? `item:${check.item_id}`;
}

/** 表の行：6教科のあとに、追加した教材を登録順に並べる */
export function zkaiRows(
  points: Record<ZkaiSubject, number>,
  items: { id: string; name: string; points: number }[],
): ZkaiRow[] {
  return [
    ...ZKAI_SUBJECTS.map((subject) => ({ key: subject, label: subject, points: points[subject], subject, itemId: null })),
    ...items.map((item) => ({ key: `item:${item.id}`, label: item.name, points: item.points, subject: null, itemId: item.id })),
  ];
}

export interface ZkaiCellCheck {
  grade: number;
  month: number;
  subject: string | null;
  item_id: string | null;
}

/** 今月まだチェックしていない行（教科・教材） */
export function remainingThisMonth(activeChecks: ZkaiCellCheck[], rows: ZkaiRow[], currentGrade: number, today: string): ZkaiRow[] {
  const month = Number(today.slice(5, 7));
  const done = new Set(activeChecks.filter((c) => c.grade === currentGrade && c.month === month).map(zkaiRowKey));
  return rows.filter((r) => !done.has(r.key));
}

/** 表示する学年。URL で選ばれていればそれ、なければ今の学年（表は1〜3年なので範囲に収める） */
export function pickGrade(param: string | string[] | undefined, current: number): number {
  const g = Number(param);
  if ((ZKAI_GRADES as readonly number[]).includes(g)) return g;
  return Math.min(3, Math.max(1, current));
}
