import { describe, expect, it } from "vitest";
import { computeStreak } from "@/lib/atzar/streak";

const TODAY = "2026-10-08";
const YESTERDAY = "2026-10-07";

describe("computeStreak", () => {
  it("is 0 with no rolls at all", () => {
    expect(computeStreak([], TODAY)).toBe(0);
  });

  it("is 1 after rolling only today", () => {
    expect(computeStreak([TODAY], TODAY)).toBe(1);
  });

  it("counts consecutive days ending today", () => {
    const dates = [TODAY, YESTERDAY, "2026-10-06", "2026-10-05"];
    expect(computeStreak(dates, TODAY)).toBe(4);
  });

  it("still counts an unbroken streak through yesterday if today has no roll yet", () => {
    const dates = [YESTERDAY, "2026-10-06"];
    expect(computeStreak(dates, TODAY)).toBe(2);
  });

  it("is 0 once two days in a row are missed", () => {
    const dates = ["2026-10-06", "2026-10-05"];
    expect(computeStreak(dates, TODAY)).toBe(0);
  });

  it("stops at the first gap, ignoring older unrelated dates", () => {
    const dates = [TODAY, YESTERDAY, "2026-10-01", "2026-09-30"];
    expect(computeStreak(dates, TODAY)).toBe(2);
  });

  it("ignores duplicate dates", () => {
    expect(computeStreak([TODAY, TODAY, YESTERDAY], TODAY)).toBe(2);
  });

  it("ignores the order dates are given in", () => {
    const dates = ["2026-10-05", TODAY, "2026-10-06", YESTERDAY];
    expect(computeStreak(dates, TODAY)).toBe(4);
  });

  it("carries correctly across a month boundary", () => {
    const dates = ["2026-10-01", "2026-09-30", "2026-09-29"];
    expect(computeStreak(dates, "2026-10-01")).toBe(3);
  });
});
