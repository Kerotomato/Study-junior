import { redirect } from "next/navigation";

/** 処理結果をクエリ文字列で元の画面に返す */
export function fail(path: string, message: string): never {
  redirect(withParam(path, "error", message));
}

export function done(path: string, message: string): never {
  redirect(withParam(path, "ok", message));
}

function withParam(path: string, key: string, value: string): string {
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}${key}=${encodeURIComponent(value)}`;
}

export function str(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v.trim() : "";
}

/** 空欄は null、数字でなければ NaN */
export function int(form: FormData, key: string): number | null {
  const v = str(form, key);
  if (v === "") return null;
  return /^-?\d+$/.test(v) ? Number(v) : NaN;
}

export function isNonNegInt(n: number | null): n is number {
  return n !== null && Number.isInteger(n) && n >= 0;
}

/** フォームの戻り先（サイト内のパスのみ許可） */
export function backPath(form: FormData, fallback: string): string {
  const v = str(form, "back");
  return v.startsWith("/") && !v.startsWith("//") ? v.split("?")[0] : fallback;
}
