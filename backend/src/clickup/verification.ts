import type {
  DailyRow,
  NamedCountSummary,
  SchemaConfig,
  VerificationSummary
} from "@custom-clickup/shared";

function countBy<T>(items: T[], pickName: (item: T) => string | undefined): NamedCountSummary[] {
  const counts = new Map<string, number>();

  for (const item of items) {
    const name = pickName(item)?.trim() || "UNKNOWN";
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort(([leftName, leftCount], [rightName, rightCount]) => {
      if (rightCount !== leftCount) {
        return rightCount - leftCount;
      }

      return leftName.localeCompare(rightName);
    })
    .map(([name, count]) => ({
      name,
      count
    }));
}

export function buildVerificationSummary({
  schema,
  daily
}: {
  schema: SchemaConfig;
  daily: DailyRow[];
}): VerificationSummary {
  const dailyCards = daily.flatMap((row) => row.cards);

  return {
    schema: {
      workspaceId: schema.workspaceId,
      listId: schema.listId
    },
    daily: {
      rowCount: daily.length,
      cardCount: dailyCards.length,
      storyRowCount: daily.filter((row) => row.type === "story").length,
      storyRowsWithoutCards: daily.filter((row) => row.type === "story" && row.cards.length === 0)
        .length,
      missingAssigneeCount: dailyCards.filter((card) => !card.assignee).length,
      missingPrioScoreCount: dailyCards.filter((card) => card.prioScore === undefined).length,
      byRowType: countBy(daily, (row) => row.type),
      byStatus: countBy(dailyCards, (card) => card.status)
    }
  };
}
