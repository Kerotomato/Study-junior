import "server-only";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { cache } from "react";
import { timedFetch } from "./timing";

declare const userClient: unique symbol;

/**
 * ログイン中ユーザーとして DB を読むクライアント（RLS が効く）。
 * 家族の範囲を RLS に任せる読み取り関数はこの型だけを受け取るので、
 * RLS を通らない管理用クライアント（createAdminClient）を渡すと型エラーになる。
 */
export type UserClient = SupabaseClient & { readonly [userClient]: true };

/** 1回のリクエストの中では同じクライアントを使い回す */
export const createClient = cache(async (): Promise<UserClient> => {
  const cookieStore = await cookies();
  const fetch = timedFetch();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Component から呼ばれた場合は書き込めない。セッション更新は proxy が行う
        }
      },
    },
    ...(fetch ? { global: { fetch } } : {}),
  }) as UserClient;
});
