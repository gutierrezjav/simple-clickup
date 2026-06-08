import { describe, expect, it } from "vitest";
import {
  formatPlanningDays,
  formatPlanningHours,
  formatPlanningTime,
  getRemainingTimeTone
} from "./sprint-planning";

describe("sprint planning helpers", () => {
  it("formats whole and fractional hours compactly", () => {
    expect(formatPlanningHours(8)).toBe("8h");
    expect(formatPlanningHours(8.25)).toBe("8.25h");
    expect(formatPlanningHours(8.3333)).toBe("8.33h");
  });

  it("formats days with one decimal place", () => {
    expect(formatPlanningDays(32)).toBe("32.0d");
    expect(formatPlanningDays(0.625)).toBe("0.6d");
  });

  it("formats planning time in hours up to 8h and days above 8h", () => {
    expect(formatPlanningTime(0)).toBe("0h");
    expect(formatPlanningTime(6.5)).toBe("6.5h");
    expect(formatPlanningTime(8)).toBe("8h");
    expect(formatPlanningTime(8.25)).toBe("1.0d");
    expect(formatPlanningTime(12)).toBe("1.5d");
    expect(formatPlanningTime(32)).toBe("4.0d");
  });

  it("returns a warning tone for negative remaining time", () => {
    expect(getRemainingTimeTone(-0.25)).toBe("negative");
    expect(getRemainingTimeTone(0)).toBe("neutral");
    expect(getRemainingTimeTone(4)).toBe("neutral");
  });
});
