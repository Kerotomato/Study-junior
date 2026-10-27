"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { addLedger, availablePoints, notify, notifyParents } from "@/lib/awards";
import { requireChild, requireChildOfFamily, requireParent } from "@/lib/auth";
import { done, fail, int, str } from "@/lib/flash";
import { formatPoints } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ExchangeRequest, Profile } from "@/lib/types";

/** いつでも、残高の範囲内で交換を請求できる（回数・締め日の制限なし）。親に通知が届く */
export async function requestExchange(form: FormData) {
  const me = await requireChild();
  const back = "/child/exchange";
  const points = int(form, "points");
  if (points === null || !Number.isInteger(points) || points < 1) fail(back, "1pt以上で入力してください");
  const admin = createAdminClient();
  const available = await availablePoints(admin, me.id);
  if (points > available) fail(back, `請求できるのは${formatPoints(Math.max(0, available))}までです`);

  const { error } = await admin.from("exchange_requests").insert({ child_id: me.id, points });
  if (error) throw error;
  await notifyParents(admin, me.family_id, "exchange_requested", `${me.name}さんが${formatPoints(points)}（${points.toLocaleString("ja-JP")}円）の交換を請求しました`);
  done(back, `${formatPoints(points)}の交換を請求しました`);
}

async function loadPending(admin: SupabaseClient, requestId: string, back: string): Promise<ExchangeRequest> {
  const { data } = await admin.from("exchange_requests").select("*").eq("id", requestId).eq("status", "pending").maybeSingle();
  if (!data) fail(back, "交換が見つからないか、すでに完了しています");
  return data as ExchangeRequest;
}

/**
 * 「渡した」「貰った」の両方にチェックが入っていれば交換を完了し、そのときにポイントを消費する。
 * 親と子が同時にチェックしても、完了とポイント消費は1回だけ。
 */
async function completeIfBothChecked(admin: SupabaseClient, requestId: string, child: Profile, actor: Profile) {
  const { data: completed, error } = await admin
    .from("exchange_requests")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("status", "pending")
    .not("given_at", "is", null)
    .not("received_at", "is", null)
    .select("points");
  if (error) throw error;
  if (!completed?.length) return false;

  const points = completed[0].points as number;
  await addLedger(admin, { child_id: child.id, amount: -points, kind: "exchange", ref_id: requestId });
  const message = `${child.name}さんの${formatPoints(points)}の交換が完了しました`;
  if (actor.role === "parent") await notify(admin, child.id, "exchange_completed", message);
  await notifyParents(admin, child.family_id, "exchange_completed", message, actor.id);
  return true;
}

/** 親が「渡した✅」をチェックする */
export async function markExchangeGiven(form: FormData) {
  const me = await requireParent();
  const back = "/parent/exchanges";
  const admin = createAdminClient();
  const request = await loadPending(admin, str(form, "request_id"), back);
  const child = await requireChildOfFamily(me, request.child_id);

  const { data: checked, error } = await admin
    .from("exchange_requests")
    .update({ given_at: new Date().toISOString(), given_by: me.id })
    .eq("id", request.id)
    .eq("status", "pending")
    .is("given_at", null)
    .select("id");
  if (error) throw error;
  if (!checked?.length) fail(back, "すでに「渡した」にチェック済みです");

  if (await completeIfBothChecked(admin, request.id, child, me)) done(back, "交換が完了しました");
  await notify(admin, child.id, "exchange_given", `${formatPoints(request.points)}を渡しました。受け取ったら「貰った」にチェックしてね`);
  done(back, "「渡した」にチェックしました。子どもが「貰った」にチェックすると完了します");
}

/** 子どもが「貰った✅」をチェックする */
export async function markExchangeReceived(form: FormData) {
  const me = await requireChild();
  const back = "/child/exchange";
  const admin = createAdminClient();
  const request = await loadPending(admin, str(form, "request_id"), back);
  if (request.child_id !== me.id) fail(back, "交換が見つかりません");

  const { data: checked, error } = await admin
    .from("exchange_requests")
    .update({ received_at: new Date().toISOString() })
    .eq("id", request.id)
    .eq("status", "pending")
    .is("received_at", null)
    .select("id");
  if (error) throw error;
  if (!checked?.length) fail(back, "すでに「貰った」にチェック済みです");

  if (await completeIfBothChecked(admin, request.id, me, me)) done(back, `交換が完了しました（-${formatPoints(request.points)}）`);
  done(back, "「貰った」にチェックしました。親が「渡した」にチェックすると完了します");
}

/** 親が「渡した」にチェックする前なら、子どもは請求を取り消せる */
export async function cancelExchange(form: FormData) {
  const me = await requireChild();
  const back = "/child/exchange";
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("exchange_requests")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", str(form, "request_id"))
    .eq("child_id", me.id)
    .eq("status", "pending")
    .is("given_at", null)
    .select("points");
  if (error) throw error;
  if (!data?.length) fail(back, "取り消せませんでした（すでに渡し済みか完了しています）");
  await notifyParents(admin, me.family_id, "exchange_cancelled", `${me.name}さんが${formatPoints(data[0].points as number)}の交換の請求を取り消しました`);
  done(back, "請求を取り消しました");
}
