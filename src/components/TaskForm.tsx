import { createTask } from "@/app/actions/tasks";
import type { Material, Subject } from "@/lib/types";
import { SubjectMaterialFields } from "./SubjectMaterialFields";

/**
 * 今日のタスクを追加するフォーム（子ども本人・親の両方で使う）。
 * 名前は任意で、教材とページ範囲だけ、科目だけでも作れる。
 */
export function TaskForm({
  subjects,
  materials,
  back,
  childId,
}: {
  subjects: Subject[];
  materials: Material[];
  back: string;
  childId?: string;
}) {
  const idPrefix = `task-${childId ?? "me"}`;
  return (
    <details className="rounded-xl bg-stone-50 p-3">
      <summary className="cursor-pointer text-sm font-bold">＋ タスクを追加</summary>
      <form action={createTask} className="mt-3 space-y-2">
        <input type="hidden" name="back" value={back} />
        {childId && <input type="hidden" name="child_id" value={childId} />}
        <div>
          <label className="label" htmlFor={`${idPrefix}-title`}>
            名前（任意）
          </label>
          <input
            className="input"
            id={`${idPrefix}-title`}
            name="title"
            placeholder="空なら「教材名 p.30-35」や科目名で表示"
          />
        </div>
        <SubjectMaterialFields subjects={subjects} materials={materials} idPrefix={idPrefix} pageRange />
        <button className="btn w-full">追加する</button>
      </form>
    </details>
  );
}
