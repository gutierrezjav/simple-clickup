import type {
  DailyRow,
  NamedCountSummary,
  PlanningItem,
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
  planning,
  daily
}: {
  schema: SchemaConfig;
  planning: PlanningItem[];
  daily: DailyRow[];
}): VerificationSummary {
  const planningItems = planning.flatMap((item) => [item, ...(item.children ?? [])]);
  const dailyCards = daily.flatMap((row) => row.cards);

  return {
    schema: {
      workspaceId: schema.workspaceId,
      listId: schema.listId
    },
    planning: {
      itemCount: planning.length,
      childCount: planning.reduce((count, item) => count + (item.children?.length ?? 0), 0),
      missingAssigneeCount: planningItems.filter((item) => !item.assignee).length,
      missingBudgetCount: planning.filter((item) => !item.budget).length,
      missingPrioScoreCount: planningItems.filter((item) => item.prioScore === undefined).length,
      byKind: countBy(planningItems, (item) => item.kind),
      byStatus: countBy(planningItems, (item) => item.status)
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
