import type { Material, Subject, Task } from "./types";

/** ページ範囲の表示（p.30-35／p.35まで／p.30から） */
export function pageRange(from: number | null, to: number | null): string {
  if (from !== null && to !== null) return from === to ? `p.${to}` : `p.${from}-${to}`;
  if (to !== null) return `p.${to}まで`;
  if (from !== null) return `p.${from}から`;
  return "";
}

/** タスクの表示名。名前が空なら「教材名 p.○-○」、教材もなければ科目名にする */
export function taskLabel(
  task: Pick<Task, "title" | "subject_id" | "material_id" | "pages_from" | "pages_to">,
  materials: Pick<Material, "id" | "name">[],
  subjects: Pick<Subject, "id" | "name">[],
): string {
  if (task.title) return task.title;
  const material = task.material_id ? materials.find((m) => m.id === task.material_id) : undefined;
  if (material) return [material.name, pageRange(task.pages_from, task.pages_to)].filter(Boolean).join(" ");
  const subject = task.subject_id ? subjects.find((s) => s.id === task.subject_id) : undefined;
  return subject?.name ?? "タスク";
}

/** 教材を科目ごとにまとめる（科目の登録順、科目なしは最後） */
export function groupMaterialsBySubject<M extends Pick<Material, "subject_id">>(
  materials: M[],
  subjects: Pick<Subject, "id" | "name">[],
): { key: string; subject: string; materials: M[] }[] {
  const groups = subjects
    .map((s) => ({ key: s.id, subject: s.name, materials: materials.filter((m) => m.subject_id === s.id) }))
    .filter((g) => g.materials.length > 0);
  const known = new Set(subjects.map((s) => s.id));
  const other = materials.filter((m) => !m.subject_id || !known.has(m.subject_id));
  return other.length > 0 ? [...groups, { key: "none", subject: "科目なし", materials: other }] : groups;
}
