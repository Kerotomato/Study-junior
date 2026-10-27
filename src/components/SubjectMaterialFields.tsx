"use client";

import { useState } from "react";
import type { Material, Subject } from "@/lib/types";

/**
 * 科目・教材・ページの入力欄（記録・記録の編集・タスクで共通）。
 * 教材を選ぶと、その教材の科目が自動で選ばれる。
 */
export function SubjectMaterialFields({
  subjects,
  materials,
  idPrefix,
  subjectRequired = false,
  pageRange = false,
  defaults = {},
}: {
  subjects: Subject[];
  materials: Material[];
  idPrefix: string;
  subjectRequired?: boolean;
  /** true なら「p.○から」も入力する（タスク用） */
  pageRange?: boolean;
  defaults?: { subjectId?: string | null; materialId?: string | null; pagesFrom?: number | null; pagesTo?: number | null };
}) {
  const [subjectId, setSubjectId] = useState(defaults.subjectId ?? "");
  const [materialId, setMaterialId] = useState(defaults.materialId ?? "");

  function selectMaterial(id: string) {
    setMaterialId(id);
    const subject = materials.find((m) => m.id === id)?.subject_id;
    if (subject) setSubjectId(subject);
  }

  return (
    <>
      <div>
        <label className="label" htmlFor={`${idPrefix}-subject_id`}>
          科目{!subjectRequired && "（任意）"}
        </label>
        <select
          className="input"
          id={`${idPrefix}-subject_id`}
          name="subject_id"
          required={subjectRequired}
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
        >
          <option value="" disabled={subjectRequired}>
            {subjectRequired ? "選んでください" : "なし"}
          </option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      {materials.length > 0 && (
        <>
          <div>
            <label className="label" htmlFor={`${idPrefix}-material_id`}>
              教材（任意）
            </label>
            <select
              className="input"
              id={`${idPrefix}-material_id`}
              name="material_id"
              value={materialId}
              onChange={(e) => selectMaterial(e.target.value)}
            >
              <option value="">なし</option>
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}（いま p.{m.current_page}／{m.total_pages}）
                </option>
              ))}
            </select>
          </div>
          {materialId && (
            <div className={pageRange ? "grid grid-cols-2 gap-2" : ""}>
              {pageRange && (
                <div>
                  <label className="label" htmlFor={`${idPrefix}-pages_from`}>
                    p.○から
                  </label>
                  <input
                    className="input"
                    id={`${idPrefix}-pages_from`}
                    name="pages_from"
                    type="number"
                    min={0}
                    defaultValue={defaults.pagesFrom ?? undefined}
                  />
                </div>
              )}
              <div>
                <label className="label" htmlFor={`${idPrefix}-pages_to`}>
                  {pageRange ? "p.○まで" : "何ページまで進んだか"}
                </label>
                <input
                  className="input"
                  id={`${idPrefix}-pages_to`}
                  name="pages_to"
                  type="number"
                  min={0}
                  defaultValue={defaults.pagesTo ?? undefined}
                />
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
