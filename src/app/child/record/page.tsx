import { saveStudyLog } from "@/app/actions/study";
import { Flash, type SearchParams } from "@/components/Flash";
import { MemoField } from "@/components/MemoField";
import { SubjectMaterialFields } from "@/components/SubjectMaterialFields";
import { requireChild, requireUserId } from "@/lib/auth";
import { todayJst } from "@/lib/dates";
import { MAX_DAILY_MINUTES } from "@/lib/points";
import { childMaterials, familySubjects } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { Timer } from "./Timer";

export default async function RecordPage({ searchParams }: { searchParams: SearchParams }) {
  const [supabase, userId] = await Promise.all([createClient(), requireUserId()]);
  const [, subjects, materials] = await Promise.all([requireChild(), familySubjects(supabase), childMaterials(supabase, userId)]);
  const today = todayJst();

  return (
    <>
      <Flash searchParams={searchParams} />
      <section className="card mb-4">
        <h2 className="h2">タイマー</h2>
        <Timer subjects={subjects} materials={materials} />
      </section>

      <section className="card">
        <h2 className="h2">手入力</h2>
        <form action={saveStudyLog} className="space-y-3">
          <input type="hidden" name="method" value="manual" />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label" htmlFor="date">日付</label>
              <input className="input" id="date" name="date" type="date" defaultValue={today} max={today} required />
            </div>
            <div>
              <label className="label" htmlFor="minutes">分数</label>
              <input className="input" id="minutes" name="minutes" type="number" min={1} max={MAX_DAILY_MINUTES} required />
            </div>
          </div>
          <SubjectMaterialFields subjects={subjects} materials={materials} idPrefix="manual" subjectRequired />
          <MemoField idPrefix="manual" />
          <button className="btn w-full">保存する</button>
        </form>
        <p className="mt-3 text-xs text-stone-500">保存するとすぐにポイントが入ります。1日の記録は合計23時間までです。</p>
      </section>
    </>
  );
}
