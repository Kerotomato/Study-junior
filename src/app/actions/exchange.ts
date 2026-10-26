"use server";

import { addLedger, availablePoints, balanceOf, notify } from "@/lib/awards";
import { requireChild, requireChildOfFamily, requireParent } from "@/lib/auth";
import { done, fail, int, str } from "@/lib/flash";
import { formatPoints } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ExchangeRequest } from "@/lib/types";

/** いつでも、残高の範囲内で交換を申請できる（回数・締め日の制限なし） */
export async function requestExchange(form: FormData) {
  const me = await requireChild();
  const back = "/child/exchange";
  const points = int(form, "points");
  if (points === null || !Number.isInteger(points) || points < 1) fail(back, "1pt以上で入力してください");
  const available = await availablePoints(createAdminClient(), me.id);
  if (points > available) fail(back, `申請できるのは${formatPoints(Math.max(0, available))}までです`);

  const { error } = await createAdminClient().from("exchange_requests").insert({ child_id: me.id, points });
  if (error) throw error;
  done(back, `${formatPoints(points)}の交換を申請しました`);
}

async function loadPending(parentFamily: Parameters<typeof requireChildOfFamily>[0], requestId: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("exchange_requests").select("*").eq("id", requestId).eq("status", "pending").maybeSingle();
  if (!data) fail("/parent/exchanges", "申請が見つからないか、すでに処理済みです");
  const request = data as ExchangeRequest;
  await requireChildOfFamily(parentFamily, request.child_id);
  return request;
}

/** 承認するとポイントを消費し、履歴に記録する */
export async function approveExchange(form: FormData) {
  const me = await requireParent();
  const back = "/parent/exchanges";
  const request = await loadPending(me, str(form, "request_id"));
  const admin = createAdminClient();
  const balance = await balanceOf(admin, request.child_id);
  if (request.points > balance) fail(back, `残高（${formatPoints(balance)}）が足りません`);

  const { data: updated, error } = await admin
    .from("exchange_requests")
    .update({ status: "approved", reviewed_by: me.id, reviewed_at: new Date().toISOString() })
    .eq("id", request.id)
    .eq("status", "pending")
    .select("id");
  if (error) throw error;
  if (!updated?.length) fail(back, "この申請はすでに処理済みです");

  await addLedger(admin, { child_id: request.child_id, amount: -request.points, kind: "exchange", ref_id: request.id });
  await notify(admin, request.child_id, "exchange_approved", `${formatPoints(request.points)}の交換が承認されました`);
  done(back, "承認しました");
}

/** 却下は理由が必須。理由を本人に通知する */
export async function rejectExchange(form: FormData) {
  const me = await requireParent();
  const back = "/parent/exchanges";
  const reason = str(form, "reason");
  if (!reason) fail(back, "却下の理由を入力してください");
  const request = await loadPending(me, str(form, "request_id"));
  const admin = createAdminClient();
  const { data: updated, error } = await admin
    .from("exchange_requests")
    .update({ status: "rejected", reviewed_by: me.id, reviewed_at: new Date().toISOString(), reason })
    .eq("id", request.id)
    .eq("status", "pending")
    .select("id");
  if (error) throw error;
  if (!updated?.length) fail(back, "この申請はすでに処理済みです");

  await notify(admin, request.child_id, "exchange_rejected", `${formatPoints(request.points)}の交換は見送りになりました。理由：${reason}`);
  done(back, "却下しました");
}
