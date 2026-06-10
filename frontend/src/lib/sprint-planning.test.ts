import { describe, expect, it } from "vitest";
import {
  formatPlanningDays,
  formatPlanningHours,
  formatPlanningRemainingTime,
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

  it("formats planning time in hours below 8h and days at 8h or above", () => {
    expect(formatPlanningTime(0)).toBe("-");
    expect(formatPlanningTime(-0.0007)).toBe("-");
    expect(formatPlanningTime(6.5)).toBe("6.5h");
    expect(formatPlanningTime(8)).toBe("1d");
    expect(formatPlanningTime(8.25)).toBe("1d");
    expect(formatPlanningTime(12)).toBe("1.5d");
    expect(formatPlanningTime(32)).toBe("4d");
  });

  it("formats zero remaining time as zero hours", () => {
    expect(formatPlanningRemainingTime(0)).toBe("0h");
    expect(formatPlanningRemainingTime(-0.0007)).toBe("0h");
    expect(formatPlanningRemainingTime(6.5)).toBe("6.5h");
    expect(formatPlanningRemainingTime(8)).toBe("1d");
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
      estimate: "10d",
      tracked: "10d",
      remaining: {
        tone: "neutral",
        value: "0h"
      }
    });
  });

  it("renders zero footer totals as dashes", () => {
    expect(
      getPlanningSprintFooterTotals({
        estimateHours: 0,
        trackedHours: 0,
        remainingHours: 0
      })
    ).toEqual({
      estimate: "-",
      tracked: "-",
      remaining: {
        tone: "neutral",
        value: "0h"
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
      estimate: "10d",
      tracked: "2d",
      remaining: {
        tone: "neutral",
        value: "8d"
      }
    });
  });
});
