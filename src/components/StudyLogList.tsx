import { deleteStudyLog } from "@/app/actions/study";
import { formatJpDate } from "@/lib/dates";
import { formatHours, formatPoints } from "@/lib/format";
import type { Material, StudyLog, Subject } from "@/lib/types";

/** 日別の記録一覧。削除済みの記録も理由つきで残す。canDelete なら親の削除フォームを出す */
export function StudyLogList({
  logs,
  subjects,
  materials,
  canDelete = false,
}: {
  logs: StudyLog[];
  subjects: Subject[];
  materials: Material[];
  canDelete?: boolean;
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
                      <span className="ml-1 text-xs">{log.method === "timer" ? "タイマー" : "手入力"}</span>
                    </span>
                    <span className="shrink-0">
                      {formatHours(log.minutes)}・{formatPoints(log.points)}
                    </span>
                  </div>
                  {log.deleted_at && <p className="text-xs text-red-700">削除済み：{log.delete_reason}</p>}
                  {canDelete && !log.deleted_at && (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-xs text-red-700">この記録を削除</summary>
                      <form action={deleteStudyLog} className="mt-2 flex gap-2">
                        <input type="hidden" name="log_id" value={log.id} />
                        <input className="input text-sm" name="reason" placeholder="削除の理由（本人に通知されます）" required />
                        <button className="btn-danger shrink-0">削除</button>
                      </form>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
