import { describe, expect, it } from "vitest";
import {
  formatPlanningDays,
  formatPlanningHours,
  formatPlanningTime,
  getPlanningSprintFooterTotals,
  getRemainingTimeTone
} from "./sprint-planning";

describe("sprint planning helpers", () => {
  it("formats whole and fractional hours compactly", () => {
    expect(formatPlanningHours(8)).toBe("8h");
    expect(formatPlanningHours(8.25)).toBe("8.25h");
    expect(formatPlanningHours(8.3333)).toBe("8.33h");
  });

  it("formats days with one decimal place", () => {
    expect(formatPlanningDays(32)).toBe("32d");
    expect(formatPlanningDays(0.625)).toBe("0.6d");
  });

  it("formats planning time in days up to 8h and hours above 8h", () => {
    expect(formatPlanningTime(0)).toBe("0d");
    expect(formatPlanningTime(-0.0007)).toBe("0d");
    expect(formatPlanningTime(6.5)).toBe("0.8d");
    expect(formatPlanningTime(8)).toBe("1d");
    expect(formatPlanningTime(8.25)).toBe("8.25h");
    expect(formatPlanningTime(12)).toBe("12h");
    expect(formatPlanningTime(32)).toBe("32h");
  });

  it("returns a warning tone for negative remaining time", () => {
    expect(getRemainingTimeTone(-0.0007)).toBe("neutral");
    expect(getRemainingTimeTone(-0.25)).toBe("negative");
    expect(getRemainingTimeTone(0)).toBe("neutral");
    expect(getRemainingTimeTone(4)).toBe("neutral");
  });

  it("keeps visually zero remaining footer totals neutral", () => {
    expect(
      getPlanningSprintFooterTotals({
        estimateHours: 80,
        trackedHours: 80.0007,
        remainingHours: -0.0007
      })
    ).toEqual({
      estimate: "80h",
      tracked: "80h",
      remaining: {
        tone: "neutral",
        value: "0d"
      }
    });
  });

  it("builds footer totals for a single sprint", () => {
    expect(
      getPlanningSprintFooterTotals({
        estimateHours: 80,
        trackedHours: 16,
        remainingHours: 64
      })
    ).toEqual({
      estimate: "80h",
      tracked: "16h",
      remaining: {
        tone: "neutral",
        value: "64h"
      }
    });
  });
});
