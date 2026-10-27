import { describe, expect, it } from "vitest";
import { ZKAI_DEFAULT_POINTS, currentZkaiGrade, pickGrade, remainingThisMonth, yearStartOfGrade, zkaiRows, zkaiYearStart } from "./zkai";

describe("Z会 year", () => {
  it("starts in March", () => {
    expect(zkaiYearStart("2026-03-01")).toBe(2026);
    expect(zkaiYearStart("2026-12-31")).toBe(2026);
    expect(zkaiYearStart("2027-02-28")).toBe(2026);
  });

});

describe("grade", () => {
  it("advances every March from the grade the parent set", () => {
    expect(currentZkaiGrade(1, 2026, "2026-10-27")).toBe(1);
    expect(currentZkaiGrade(1, 2026, "2027-02-28")).toBe(1);
    expect(currentZkaiGrade(1, 2026, "2027-03-01")).toBe(2);
    expect(currentZkaiGrade(null, null, "2026-10-27")).toBeNull();
  });

  it("finds the year of an earlier grade", () => {
    expect(yearStartOfGrade(1, 2, "2026-10-27")).toBe(2025);
    expect(yearStartOfGrade(2, 2, "2026-10-27")).toBe(2026);
  });
});

describe("rows", () => {
  const rows = zkaiRows(ZKAI_DEFAULT_POINTS, [{ id: "i1", name: "プラス 数学", points: 200 }]);

  it("puts added materials after the six subjects", () => {
    expect(rows.map((r) => r.label)).toEqual(["国語", "数学", "理科", "社会", "英語", "作文", "プラス 数学"]);
    expect(rows[6]).toMatchObject({ key: "item:i1", points: 200, subject: null, itemId: "i1" });
  });

  it("lists unchecked rows of the current grade and month", () => {
    const checks = [
      { grade: 1, month: 10, subject: "国語", item_id: null },
      { grade: 1, month: 10, subject: "数学", item_id: null },
      { grade: 1, month: 10, subject: null, item_id: "i1" },
      { grade: 1, month: 9, subject: "英語", item_id: null },
      { grade: 2, month: 10, subject: "理科", item_id: null },
    ];
    expect(remainingThisMonth(checks, rows, 1, "2026-10-27").map((r) => r.label)).toEqual(["理科", "社会", "英語", "作文"]);
  });
});

describe("pickGrade", () => {
  it("uses the selected tab or falls back to the current grade", () => {
    expect(pickGrade("2", 1)).toBe(2);
    expect(pickGrade(undefined, 1)).toBe(1);
    expect(pickGrade("9", 4)).toBe(3);
  });
});
