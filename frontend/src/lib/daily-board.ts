import { dailyStatuses, type DailyCard, type DailyRow, type DailyStatus } from "@custom-clickup/shared";
import { getAssigneeDisplayName } from "./assignee";

export interface DailyBoardFilters {
  search: string;
  assignee: string;
}

export interface DailyBoardCounts {
  totalCards: number;
  visibleCards: number;
  totalByStatus: Record<DailyStatus, number>;
  visibleByStatus: Record<DailyStatus, number>;
}

export interface FilteredDailyRow extends DailyRow {
  cards: DailyCard[];
  totalCardCount: number;
}

export interface FilteredDailyBoard {
  assigneeOptions: string[];
  counts: DailyBoardCounts;
  filtersActive: boolean;
  hasVisibleCards: boolean;
  rows: FilteredDailyRow[];
}

export function getVisibleDailyStatuses(rows: Pick<DailyRow, "cards">[]): DailyStatus[] {
  const visibleStatuses = new Set<DailyStatus>();

  for (const row of rows) {
    for (const card of row.cards) {
      visibleStatuses.add(card.status);
    }
  }

  return dailyStatuses.filter((status) => visibleStatuses.has(status));
}

function createStatusCountMap(): Record<DailyStatus, number> {
  return dailyStatuses.reduce(
    (counts, status) => ({
      ...counts,
      [status]: 0
    }),
    {} as Record<DailyStatus, number>
  );
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function matchesAssignee(card: DailyCard, assignee: string): boolean {
  return assignee === "" || getAssigneeDisplayName(card.assignee) === assignee;
}

function matchesCardSearch(card: DailyCard, searchTerm: string): boolean {
  if (searchTerm === "") {
    return true;
  }

  const title = card.title.toLowerCase();
  const customId = card.customId.toLowerCase();
  return title.includes(searchTerm) || customId.includes(searchTerm);
}

export function getDailyAssigneeOptions(rows: DailyRow[]): string[] {
  const assignees = [
    ...new Set(rows.flatMap((row) => row.cards.map((card) => getAssigneeDisplayName(card.assignee))))
  ];

  const namedAssignees = assignees
    .filter((assignee) => assignee !== "Unassigned")
    .sort((left, right) => left.localeCompare(right));

  return assignees.includes("Unassigned")
    ? ["Unassigned", ...namedAssignees]
    : namedAssignees;
}

export function filterDailyBoard(
  rows: DailyRow[],
  filters: DailyBoardFilters
): FilteredDailyBoard {
  const searchTerm = normalizeText(filters.search);
  const assignee = filters.assignee;
  const filtersActive = searchTerm !== "" || assignee !== "";
  const totalByStatus = createStatusCountMap();
  const visibleByStatus = createStatusCountMap();

  for (const row of rows) {
    for (const card of row.cards) {
      totalByStatus[card.status] += 1;
    }
  }

  const filteredRows = rows.flatMap((row) => {
    const storyTitleMatches =
      row.type === "story" && searchTerm !== ""
        ? row.title.toLowerCase().includes(searchTerm)
        : false;
    const assigneeCards = row.cards.filter((card) => matchesAssignee(card, assignee));
    const matchingCards = assigneeCards.filter((card) => matchesCardSearch(card, searchTerm));
    const visibleCards = storyTitleMatches ? assigneeCards : matchingCards;
    const rowIsVisible = filtersActive
      ? row.type === "story"
        ? storyTitleMatches || visibleCards.length > 0
        : visibleCards.length > 0
      : row.cards.length > 0;

    if (!rowIsVisible) {
      return [];
    }

    for (const card of visibleCards) {
      visibleByStatus[card.status] += 1;
    }

    return [
      {
        ...row,
        cards: visibleCards,
        totalCardCount: row.cards.length
      }
    ];
  });

  const totalCards = rows.reduce((count, row) => count + row.cards.length, 0);
  const visibleCards = filteredRows.reduce((count, row) => count + row.cards.length, 0);

  return {
    assigneeOptions: getDailyAssigneeOptions(rows),
    counts: {
      totalCards,
      visibleCards,
      totalByStatus,
      visibleByStatus
    },
    filtersActive,
    hasVisibleCards: visibleCards > 0,
    rows: filteredRows
  };
}
