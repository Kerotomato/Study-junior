import { deleteStudyLog, rejectStudyLog, updateStudyLog } from "@/app/actions/study";
import { formatJpDate } from "@/lib/dates";
import { formatHours, formatPoints } from "@/lib/format";
import { MAX_DAILY_MINUTES } from "@/lib/points";
import type { Material, StudyLog, Subject } from "@/lib/types";
import { MemoField } from "./MemoField";
import { SubjectMaterialFields } from "./SubjectMaterialFields";

/**
 * 日別の記録一覧。取り消された記録も理由つきで残す。
 * mode="child" なら本人の編集フォーム、mode="parent" なら親の却下（手入力）・削除（タイマー）フォームを出す。
 */
export function StudyLogList({
  logs,
  subjects,
  materials,
  mode,
}: {
  logs: StudyLog[];
  subjects: Subject[];
  materials: Material[];
  mode: "child" | "parent";
}) {
  if (logs.length === 0) return <p className="text-sm text-stone-500">まだ記録がありません</p>;
  const subjectName = new Map(subjects.map((s) => [s.id, s.name]));
  const materialName = new Map(materials.map((m) => [m.id, m.name]));
  const byDate = new Map<string, StudyLog[]>();
  for (const log of logs) byDate.set(log.study_date, [...(byDate.get(log.study_date) ?? []), log]);

  return (
    <div className="space-y-4">
      {[...byDate].map(([date, dayLogs]) => {
        const active = dayLogs.filter((l) => !l.deleted_at);
        return (
          <div key={date}>
            <h3 className="mb-1 flex justify-between text-sm font-bold">
              <span>{formatJpDate(date)}</span>
              <span className="text-stone-500">
                {formatHours(active.reduce((s, l) => s + l.minutes, 0))}・{formatPoints(active.reduce((s, l) => s + l.points, 0))}
              </span>
            </h3>
            <ul className="divide-y divide-stone-100 rounded-xl bg-stone-50">
              {dayLogs.map((log) => (
                <li key={log.id} className="px-3 py-2 text-sm">
                  <div className={`flex justify-between gap-2 ${log.deleted_at ? "text-stone-400 line-through" : ""}`}>
                    <span>
                      {(log.subject_id && subjectName.get(log.subject_id)) || "科目なし"}
                      {log.material_id && materialName.get(log.material_id) && `・${materialName.get(log.material_id)}`}
                      {log.pages_to !== null && ` p.${log.pages_to}まで`}
                      <span className="ml-1 text-xs">
                        {log.method === "timer" ? "タイマー" : "手入力"}
                        {log.edited_at && "（編集済み）"}
                      </span>
                    </span>
                    <span className="shrink-0">
                      {formatHours(log.minutes)}・{formatPoints(log.points)}
                    </span>
                  </div>
                  {log.memo && <p className="mt-0.5 whitespace-pre-wrap text-xs text-stone-600">📝 {log.memo}</p>}
                  {log.deleted_at && (
                    <p className="text-xs text-red-700">
                      {log.removed_as === "rejected" ? "却下" : "削除済み"}：{log.delete_reason}
                    </p>
                  )}
                  {!log.deleted_at && mode === "child" && <EditForm log={log} subjects={subjects} materials={materials} />}
                  {!log.deleted_at && mode === "parent" && <RemoveForm log={log} />}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function EditForm({ log, subjects, materials }: { log: StudyLog; subjects: Subject[]; materials: Material[] }) {
  const idPrefix = `edit-${log.id}`;
  return (
    <details className="mt-1">
      <summary className="cursor-pointer text-xs text-brand-dark">編集</summary>
      <form action={updateStudyLog} className="mt-2 space-y-2">
        <input type="hidden" name="log_id" value={log.id} />
        <div>
          <label className="label" htmlFor={`${idPrefix}-minutes`}>
            分数
          </label>
          <input
            className="input"
            id={`${idPrefix}-minutes`}
            name="minutes"
            type="number"
            min={1}
            max={MAX_DAILY_MINUTES}
            defaultValue={log.minutes}
            required
          />
        </div>
        <SubjectMaterialFields
          subjects={subjects}
          materials={materials}
          idPrefix={idPrefix}
          subjectRequired
          defaults={{ subjectId: log.subject_id, materialId: log.material_id, pagesTo: log.pages_to }}
        />
        <MemoField idPrefix={idPrefix} defaultValue={log.memo} />
        <p className="text-xs text-stone-500">
          時間を変えるとポイントを計算し直し、差分がポイントの動きに残ります。タイマーの記録は時間を変えると手入力扱いになります。
        </p>
        <button className="btn w-full">保存する</button>
      </form>
    </details>
  );
}

/** 手入力の記録は「却下」、タイマーの記録は不審なときだけ「削除」。どちらも理由が必須 */
function RemoveForm({ log }: { log: StudyLog }) {
  const reject = log.method === "manual";
  return (
    <details className="mt-1">
      <summary className="cursor-pointer text-xs text-red-700">{reject ? "この手入力記録を却下" : "この記録を削除"}</summary>
      <form action={reject ? rejectStudyLog : deleteStudyLog} className="mt-2 flex gap-2">
        <input type="hidden" name="log_id" value={log.id} />
        <input
          className="input text-sm"
          name="reason"
          placeholder={`${reject ? "却下" : "削除"}の理由（本人に通知されます）`}
          aria-label={`${reject ? "却下" : "削除"}の理由`}
          required
        />
        <button className="btn-danger shrink-0">{reject ? "却下" : "削除"}</button>
      </form>
    </details>
  );
}
