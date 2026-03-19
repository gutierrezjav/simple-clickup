import {
  planningFixtures,
  type PlanningItem
} from "@custom-clickup/shared";
import { useEffect, useState } from "react";
import { PlanningRow } from "../components/planning/planning-row";
import { ResourceState } from "../components/resource-state";
import {
  ClickUpApiError,
  fetchPlanningPageData,
  startClickUpOAuth,
  type PlanningPageData
} from "../lib/clickup-api";
import { useTopBarAction } from "../lib/top-bar-action";
import { useResourceLoader } from "../lib/use-resource-loader";

export interface PlanningPageProps {
  loader?: () => Promise<PlanningPageData>;
}

function compareByPriority(
  left: { prioScore?: number },
  right: { prioScore?: number }
): number {
  return (left.prioScore ?? Number.POSITIVE_INFINITY) - (right.prioScore ?? Number.POSITIVE_INFINITY);
}

function sortPlanningItems(items: PlanningItem[]): PlanningItem[] {
  return [...items]
    .sort(compareByPriority)
    .map((item) => ({
      ...item,
      ...(item.children
        ? {
            children: [...item.children].sort(compareByPriority)
          }
        : {})
    }));
}

function createMockPlanningPageData(): PlanningPageData {
  return {
    items: planningFixtures,
    readMode: "mock"
  };
}

function getPlanningErrorMessage(error: Error): string {
  if (error instanceof ClickUpApiError && error.status === 429) {
    const retryMessage =
      typeof error.retryAfterSeconds === "number"
        ? ` Retry after about ${error.retryAfterSeconds} seconds.`
        : "";
    return `The backend is being rate-limited by ClickUp.${retryMessage}`;
  }

  return error.message || "Planning data could not be loaded.";
}

function renderPlanningContent(
  items: PlanningItem[],
  expandedIds: Set<string>,
  onToggle: (itemId: string) => void
) {
  if (items.length === 0) {
    return (
      <ResourceState
        message="The backend returned no planning items for the current read snapshot."
        title="No Planning Items"
      />
    );
  }

  return (
    <div className="planning-list">
      {items.map((item) => (
        <PlanningRow
          expanded={expandedIds.has(item.id)}
          item={item}
          key={item.id}
          onToggle={() => onToggle(item.id)}
        />
      ))}
    </div>
  );
}

function PlanningHeader({
  itemCount
}: {
  itemCount?: number;
}) {
  return (
    <div className="panel-header">
      <div className="panel-header-copy">
        <div className="panel-eyebrow">List view</div>
        <h2>Planning</h2>
        <p>
          Ranked backlog aligned to ClickUp-style list density.
          {typeof itemCount === "number" ? ` ${itemCount} items in the current snapshot.` : ""}
        </p>
      </div>
    </div>
  );
}

export function PlanningPage({ loader = fetchPlanningPageData }: PlanningPageProps) {
  const { data, error, isLoading, isRefreshing, refresh } = useResourceLoader(loader);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  useTopBarAction({
    disabled: isRefreshing,
    label: isRefreshing ? "Refreshing..." : "Refresh",
    onAction: refresh
  });
  const handleConnect = () => startClickUpOAuth("/planning");
  const sortedItems = data ? sortPlanningItems(data.items) : [];

  useEffect(() => {
    setExpandedIds(new Set());
  }, [data?.items]);

  function handleToggle(itemId: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }

  if (isLoading && !data) {
    return (
      <div className="panel panel--route">
        <PlanningHeader />
        <ResourceState
          isLoading
          message="Loading planning data from the backend."
          title="Loading Planning"
        />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="panel panel--route">
        <PlanningHeader />
        <ResourceState
          actionLabel={
            error instanceof ClickUpApiError && error.status === 401
              ? "Connect ClickUp"
              : "Retry"
          }
          message={getPlanningErrorMessage(
            error ?? new Error("Planning data could not be loaded.")
          )}
          onAction={
            error instanceof ClickUpApiError && error.status === 401
              ? handleConnect
              : refresh
          }
          title={
            error instanceof ClickUpApiError
              ? error.status === 429
                ? "Rate Limited"
                : error.status === 401
                  ? "ClickUp Connection Required"
                  : "Planning Unavailable"
              : "Planning Unavailable"
          }
          tone={
            error instanceof ClickUpApiError && error.status === 429
              ? "warning"
              : "error"
          }
        />
      </div>
    );
  }

  return (
    <div className="panel panel--route">
      <PlanningHeader itemCount={sortedItems.length} />
      {error ? (
        <ResourceState
          actionLabel={
            error instanceof ClickUpApiError && error.status === 401
              ? "Connect ClickUp"
              : "Retry"
          }
          disabled={isRefreshing}
          message={getPlanningErrorMessage(error)}
          onAction={
            error instanceof ClickUpApiError && error.status === 401
              ? handleConnect
              : refresh
          }
          title={
            error instanceof ClickUpApiError && error.status === 401
              ? "ClickUp Connection Required"
              : "Refresh Failed"
          }
          tone={
            error instanceof ClickUpApiError && error.status === 429
              ? "warning"
              : "error"
          }
        />
      ) : null}
      {renderPlanningContent(sortedItems, expandedIds, handleToggle)}
    </div>
  );
}

export const planningPageStoryLoader = async (): Promise<PlanningPageData> =>
  createMockPlanningPageData();
