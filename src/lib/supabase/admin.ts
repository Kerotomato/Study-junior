import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * service role で DB を書き込む（RLS を通らない）。
 * 呼び出す前に必ず lib/auth.ts で操作する人の権限を確認すること。
 */
export function createAdminClient(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
