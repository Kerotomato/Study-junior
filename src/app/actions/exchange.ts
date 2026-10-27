"use server";

import { addLedger, availablePoints, notify, notifyParents } from "@/lib/awards";
import { requireChild, requireChildOfFamily, requireParent } from "@/lib/auth";
import { done, fail, int, str } from "@/lib/flash";
import { formatPoints } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ExchangeRequest } from "@/lib/types";

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

/** 親が「渡した✅」をチェックした時点で交換完了とし、ポイントを消費する */
export async function markExchangeGiven(form: FormData) {
  const me = await requireParent();
  const back = "/parent/exchanges";
  const admin = createAdminClient();
  const { data } = await admin.from("exchange_requests").select("*").eq("id", str(form, "request_id")).maybeSingle();
  if (!data) fail(back, "交換が見つかりません");
  const request = data as ExchangeRequest;
  const child = await requireChildOfFamily(me, request.child_id);

  // 2回押されても、ほかの親と同時に押しても、完了とポイント消費は1回だけ
  const now = new Date().toISOString();
  const { data: completed, error } = await admin
    .from("exchange_requests")
    .update({ status: "completed", given_at: now, given_by: me.id, completed_at: now })
    .eq("id", request.id)
    .eq("status", "pending")
    .select("id");
  if (error) throw error;
  if (!completed?.length) fail(back, "この交換はすでに完了しているか、取り消されています");

  await addLedger(admin, { child_id: child.id, amount: -request.points, kind: "exchange", ref_id: request.id });
  await notify(admin, child.id, "exchange_completed", `${formatPoints(request.points)}を受け取りました。交換完了です`);
  await notifyParents(admin, child.family_id, "exchange_completed", `${child.name}さんに${formatPoints(request.points)}を渡しました（交換完了）`, me.id);
  done(back, `${child.name}さんの${formatPoints(request.points)}の交換を完了しました`);
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
