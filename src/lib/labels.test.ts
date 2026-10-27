import { describe, expect, it } from "vitest";
import { groupMaterialsBySubject, taskLabel } from "./labels";
import { recalcStudyPoints } from "./points";

const materials = [{ id: "m1", name: "数学ワーク" }];
const subjects = [
  { id: "s1", name: "数学" },
  { id: "s2", name: "英語" },
];
const empty = { title: null, subject_id: null, material_id: null, pages_from: null, pages_to: null };

describe("taskLabel", () => {
  it("uses the title when given", () => {
    expect(taskLabel({ ...empty, title: "英単語50個", material_id: "m1" }, materials, subjects)).toBe("英単語50個");
  });

  it("falls back to the material and page range", () => {
    expect(taskLabel({ ...empty, material_id: "m1", pages_from: 30, pages_to: 35 }, materials, subjects)).toBe("数学ワーク p.30-35");
    expect(taskLabel({ ...empty, material_id: "m1", pages_to: 35 }, materials, subjects)).toBe("数学ワーク p.35まで");
    expect(taskLabel({ ...empty, material_id: "m1" }, materials, subjects)).toBe("数学ワーク");
  });

  it("falls back to the subject", () => {
    expect(taskLabel({ ...empty, subject_id: "s2" }, materials, subjects)).toBe("英語");
  });
});

describe("groupMaterialsBySubject", () => {
  it("groups in subject order and puts unassigned last", () => {
    const list = [
      { id: "a", subject_id: "s2" },
      { id: "b", subject_id: null },
      { id: "c", subject_id: "s1" },
      { id: "d", subject_id: "s2" },
    ];
    expect(groupMaterialsBySubject(list, subjects).map((g) => [g.subject, g.materials.map((m) => m.id)])).toEqual([
      ["数学", ["c"]],
      ["英語", ["a", "d"]],
      ["科目なし", ["b"]],
    ]);
  });
});

describe("recalcStudyPoints", () => {
  it("keeps the rate the log was saved with", () => {
    expect(recalcStudyPoints({ points: 300, minutes: 30 }, 45)).toBe(450); // 休日レート10pt
    expect(recalcStudyPoints({ points: 150, minutes: 30 }, 20)).toBe(100); // 平日レート5pt
  });
});
