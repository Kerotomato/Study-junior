import { describe, expect, it } from "vitest";
import { addDays, isValidDate, toJstDate, weekStart } from "./dates";
import {
  applyPages,
  currentStreak,
  fitsDailyLimit,
  isHolidayRateDay,
  meetsTestGoal,
  progressPercent,
  streakMilestones,
  studyPoints,
} from "./points";

const rules = { weekday_rate: 5, holiday_rate: 10 };

describe("dates", () => {
  it("uses Japan time for the calendar date", () => {
    expect(toJstDate(new Date("2026-10-25T15:30:00Z"))).toBe("2026-10-26");
    expect(toJstDate(new Date("2026-10-25T14:59:00Z"))).toBe("2026-10-25");
  });

  it("starts the week on Monday", () => {
    expect(weekStart("2026-10-26")).toBe("2026-10-26"); // 月
    expect(weekStart("2026-11-01")).toBe("2026-10-26"); // 日
    expect(weekStart("2026-10-31")).toBe("2026-10-26"); // 土
  });

  it("crosses month boundaries", () => {
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(isValidDate("2026-02-30")).toBe(false);
  });
});

describe("study points", () => {
  it("uses the weekday rate on weekdays", () => {
    expect(studyPoints(30, "2026-10-26", rules)).toBe(150);
  });

  it("uses the holiday rate on weekends and national holidays", () => {
    expect(isHolidayRateDay("2026-10-31")).toBe(true); // 土
    expect(isHolidayRateDay("2026-11-03")).toBe(true); // 文化の日（火）
    expect(studyPoints(30, "2026-11-03", rules)).toBe(300);
  });

  it("caps a day at 23 hours", () => {
    expect(fitsDailyLimit(1300, 80)).toBe(true);
    expect(fitsDailyLimit(1300, 81)).toBe(false);
  });
});

describe("streaks", () => {
  const week = ["2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25", "2026-10-26"];

  it("awards on the day the streak reaches the target", () => {
    expect(streakMilestones(week, "2026-10-26", 7)).toEqual(["2026-10-26"]);
    expect(streakMilestones(week.slice(0, 6), "2026-10-25", 7)).toEqual([]);
  });

  it("finds milestones after a back-filled gap", () => {
    const withGap = week.filter((d) => d !== "2026-10-23");
    expect(streakMilestones(withGap, "2026-10-26", 7)).toEqual([]);
    expect(streakMilestones(week, "2026-10-23", 7)).toEqual(["2026-10-26"]);
  });

  it("counts the streak as alive until today ends", () => {
    expect(currentStreak(week, "2026-10-26")).toBe(7);
    expect(currentStreak(week, "2026-10-27")).toBe(7);
    expect(currentStreak(week, "2026-10-28")).toBe(0);
  });
});

describe("materials", () => {
  it("advances pages and detects a finished lap", () => {
    expect(applyPages({ current_page: 60, total_pages: 120 }, 64)).toEqual({ currentPage: 64, completedLap: false });
    expect(applyPages({ current_page: 64, total_pages: 120 }, 130)).toEqual({ currentPage: 120, completedLap: true });
  });

  it("ignores backward input and finished materials", () => {
    expect(applyPages({ current_page: 64, total_pages: 120 }, 10)).toEqual({ currentPage: 64, completedLap: false });
    expect(applyPages({ current_page: 120, total_pages: 120 }, 120)).toEqual({ currentPage: 120, completedLap: false });
  });

  it("shows progress as a whole percent", () => {
    expect(progressPercent({ current_page: 64, total_pages: 120 })).toBe(53);
  });
});

describe("test goals", () => {
  it("checks a minimum score", () => {
    const goal = { condition_type: "min_score" as const, min_score: 80 };
    expect(meetsTestGoal(goal, { score: 80, passed: false })).toBe(true);
    expect(meetsTestGoal(goal, { score: 79, passed: true })).toBe(false);
  });

  it("checks a pass/fail goal", () => {
    const goal = { condition_type: "pass" as const, min_score: null };
    expect(meetsTestGoal(goal, { score: null, passed: true })).toBe(true);
  });
});
