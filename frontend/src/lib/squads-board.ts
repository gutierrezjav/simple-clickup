import type { DailyRow, DailyStatus } from "@custom-clickup/shared";

const priority = (item: { prioScore?: number }) => item.prioScore ?? Infinity;

export function sortSquadsRows(rows: DailyRow[]): DailyRow[] {
  const rank = (row: DailyRow) => row.type === "tasks" ? 2 : row.type === "bugs" ? 3 : row.type === "mix" ? 1 : 0;
  return rows.map(row => ({ ...row, cards: [...row.cards].sort((a, b) => priority(a) - priority(b)) }))
    .sort((a, b) => rank(a) - rank(b) || priority(a) - priority(b) || a.title.localeCompare(b.title));
}

export function getExpandedSquadsRows(
  rows: DailyRow[],
  isStatusCollapsed: (status: DailyStatus) => boolean
): DailyRow[] {
  return rows.filter(row => row.type !== "epic" || row.cards.some(card => !isStatusCollapsed(card.status)));
}
