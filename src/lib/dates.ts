// 日付はすべて日本時間の "YYYY-MM-DD" 文字列で扱う

const TIME_ZONE = "Asia/Tokyo";

const ymd = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function toJstDate(d: Date): string {
  return ymd.format(d);
}

export function todayJst(now: Date = new Date()): string {
  return toJstDate(now);
}

function parse(date: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`invalid date: ${date}`);
  return new Date(`${date}T00:00:00Z`);
}

export function isValidDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  return parse(date).toISOString().slice(0, 10) === date;
}

export function addDays(date: string, days: number): string {
  const d = parse(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 0 = 日曜 … 6 = 土曜 */
export function dayOfWeek(date: string): number {
  return parse(date).getUTCDay();
}

/** 週の区切りは月曜開始〜日曜終了 */
export function weekStart(date: string): string {
  const dow = dayOfWeek(date);
  return addDays(date, dow === 0 ? -6 : 1 - dow);
}

export function weekEnd(date: string): string {
  return addDays(weekStart(date), 6);
}

export function monthStart(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

/** 日本時間の日付の 0 時を ISO 文字列で返す（timestamptz の範囲検索用） */
export function jstMidnightIso(date: string): string {
  return new Date(`${date}T00:00:00+09:00`).toISOString();
}

export function formatJpDate(date: string): string {
  const d = parse(date);
  const w = "日月火水木金土"[d.getUTCDay()];
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}（${w}）`;
}

export function formatJstDateTime(iso: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: TIME_ZONE,
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function zkaiMonthLabel(month: number): string {
  return `${month}月`;
}
