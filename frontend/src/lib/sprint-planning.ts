export type RemainingTimeTone = "negative" | "neutral";

export interface PlanningSprintFooterTotals {
  estimate: string;
  tracked: string;
  remaining: {
    tone: RemainingTimeTone;
    value: string;
  };
}

const visuallyZeroDaysThreshold = 0.05;
const visuallyZeroHoursThreshold = 0.005;

function normalizePlanningTimeValue(value: number, threshold: number): number {
  return Math.abs(value) < threshold ? 0 : value;
}

export function formatPlanningHours(value: number): string {
  const normalizedValue = normalizePlanningTimeValue(value, visuallyZeroHoursThreshold);

  if (Number.isInteger(normalizedValue)) {
    return `${normalizedValue}h`;
  }

  return `${normalizedValue.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}h`;
}

export function formatPlanningDays(value: number): string {
  const formattedValue = normalizePlanningTimeValue(value, visuallyZeroDaysThreshold).toFixed(1);
  return `${formattedValue.replace(/\.0$/, "")}d`;
}

export function formatPlanningTime(value: number): string {
  const normalizedValue = normalizePlanningTimeValue(value, visuallyZeroHoursThreshold);

  if (Math.abs(normalizedValue) <= 8) {
    return formatPlanningDays(normalizedValue / 8);
  }

  return formatPlanningHours(normalizedValue);
}

export function getRemainingTimeTone(value: number): RemainingTimeTone {
  return normalizePlanningTimeValue(value, visuallyZeroHoursThreshold) < 0 ? "negative" : "neutral";
}

export function getPlanningSprintFooterTotals(sprint: {
  estimateHours: number;
  remainingHours: number;
  trackedHours: number;
}): PlanningSprintFooterTotals {
  return {
    estimate: formatPlanningTime(sprint.estimateHours),
    tracked: formatPlanningTime(sprint.trackedHours),
    remaining: {
      tone: getRemainingTimeTone(sprint.remainingHours),
      value: formatPlanningTime(sprint.remainingHours)
    }
  };
}
