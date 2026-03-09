import { planningFixtures, type WriteMode } from "@custom-clickup/shared";
import { PlanningRow } from "../components/planning/planning-row";
import { ResourceState } from "../components/resource-state";
import { StatusBanner } from "../components/status-banner";
import {
  ClickUpApiError,
  fetchPlanningPageData,
  type PlanningPageData,
  type ReadMode
} from "../lib/clickup-api";
import { useResourceLoader } from "../lib/use-resource-loader";

export interface PlanningPageProps {
  loader?: () => Promise<PlanningPageData>;
}

function createMockPlanningPageData(): PlanningPageData {
  return {
    items: planningFixtures,
    readMode: "mock",
    writeMode: "mock"
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

function renderPlanningContent(data: PlanningPageData) {
  if (data.items.length === 0) {
    return (
      <ResourceState
        message="The backend returned no planning items for the current filters."
        title="No Planning Items"
      />
    );
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {data.items.map((item, index) => (
        <PlanningRow key={item.id} item={item} expanded={index === 0} />
      ))}
    </div>
  );
}

function PlanningHeader({
  isRefreshing,
  onRefresh,
  readMode,
  writeMode
}: {
  isRefreshing: boolean;
  onRefresh: () => void;
  readMode?: ReadMode;
  writeMode?: WriteMode;
}) {
  return (
    <div className="panel-header">
      <div className="panel-header-copy">
        <h2>Planning</h2>
        <p>Backend-backed planning list with manual refresh and route-level failure states.</p>
      </div>
      <div className="panel-header-actions">
        {writeMode ? (
          <StatusBanner
            {...(readMode ? { readMode } : {})}
            writeMode={writeMode}
          />
        ) : null}
        <button
          className="toolbar-button"
          disabled={isRefreshing}
          onClick={onRefresh}
          type="button"
        >
          {isRefreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>
    </div>
  );
}

export function PlanningPage({ loader = fetchPlanningPageData }: PlanningPageProps) {
  const { data, error, isLoading, isRefreshing, refresh } = useResourceLoader(loader);

  if (isLoading && !data) {
    return (
      <div className="panel">
        <PlanningHeader isRefreshing={false} onRefresh={refresh} />
        <ResourceState
          actionLabel="Retry"
          message="Loading planning data from the backend."
          onAction={refresh}
          title="Loading Planning"
        />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="panel">
        <PlanningHeader isRefreshing={false} onRefresh={refresh} />
        <ResourceState
          actionLabel="Retry"
          message={getPlanningErrorMessage(
            error ?? new Error("Planning data could not be loaded.")
          )}
          onAction={refresh}
          title={
            error instanceof ClickUpApiError && error.status === 429
              ? "Rate Limited"
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
    <div className="panel">
      <PlanningHeader
        isRefreshing={isRefreshing}
        onRefresh={refresh}
        readMode={data.readMode}
        writeMode={data.writeMode}
      />
      {error ? (
        <ResourceState
          actionLabel="Retry"
          disabled={isRefreshing}
          message={getPlanningErrorMessage(error)}
          onAction={refresh}
          title="Refresh Failed"
          tone={
            error instanceof ClickUpApiError && error.status === 429
              ? "warning"
              : "error"
          }
        />
      ) : null}
      {renderPlanningContent(data)}
    </div>
  );
}

export const planningPageStoryLoader = async (): Promise<PlanningPageData> =>
  createMockPlanningPageData();
