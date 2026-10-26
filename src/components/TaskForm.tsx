import { createTask } from "@/app/actions/tasks";
import type { Material } from "@/lib/types";

/** 今日のタスクを追加するフォーム（子ども本人・親の両方で使う） */
export function TaskForm({ materials, back, childId }: { materials: Material[]; back: string; childId?: string }) {
  return (
    <form action={createTask} className="space-y-2">
      <input type="hidden" name="back" value={back} />
      {childId && <input type="hidden" name="child_id" value={childId} />}
      <input className="input" name="title" placeholder="例：数学ワーク p.30-35、英単語50個" required />
      {materials.length > 0 && (
        <div className="flex gap-2">
          <select className="input" name="material_id" defaultValue="" aria-label="教材">
            <option value="">教材と紐づけない</option>
            {materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <input className="input w-32" name="pages_to" inputMode="numeric" placeholder="p.まで" aria-label="完了時に進むページ" />
        </div>
      )}
      <button className="btn w-full">タスクを追加</button>
    </form>
  );
}
