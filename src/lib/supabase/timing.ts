/**
 * SUPABASE_TIMING=1 のとき、Supabase への通信ごとにかかった時間をサーバーのログに出す（Vercel の Logs で見られる）。
 * 例：[supabase] 132ms GET /rest/v1/users
 * 本番で速さを確かめたいときだけ使う。設定しなければ何もしない。
 */
export function timedFetch(): typeof fetch | undefined {
  if (process.env.SUPABASE_TIMING !== "1") return undefined;
  return async (input, init) => {
    const started = Date.now();
    const res = await fetch(input, init);
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    console.log(`[supabase] ${Date.now() - started}ms ${init?.method ?? "GET"} ${url.pathname}`);
    return res;
  };
}
