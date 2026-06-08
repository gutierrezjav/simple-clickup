export type RemainingTimeTone = "negative" | "neutral";

export function formatPlanningHours(value: number): string {
  if (Number.isInteger(value)) {
    return `${value}h`;
  }

  return `${value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}h`;
}

export function formatPlanningDays(value: number): string {
  return `${value.toFixed(1)}d`;
}

export function getRemainingTimeTone(value: number): RemainingTimeTone {
  return value < 0 ? "negative" : "neutral";
}
