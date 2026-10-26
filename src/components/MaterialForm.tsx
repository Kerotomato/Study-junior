import { createMaterial } from "@/app/actions/materials";
import type { Subject } from "@/lib/types";

export function MaterialForm({ subjects, back, childId }: { subjects: Subject[]; back: string; childId?: string }) {
  return (
    <form action={createMaterial} className="space-y-2">
      <input type="hidden" name="back" value={back} />
      {childId && <input type="hidden" name="child_id" value={childId} />}
      <input className="input" name="name" placeholder="教材の名前（例：数学ワーク）" required />
      <div className="flex gap-2">
        <select className="input" name="subject_id" defaultValue="" aria-label="科目">
          <option value="">科目なし</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <input className="input w-36" name="total_pages" type="number" min={1} placeholder="総ページ数" aria-label="総ページ数" required />
      </div>
      <button className="btn w-full">教材を登録</button>
    </form>
  );
}
