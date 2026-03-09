import { Fragment } from "react";
import { dailyFixtures, dailyStatuses, type WriteMode } from "@custom-clickup/shared";
import { DailyCard } from "../components/daily/daily-card";
import { ResourceState } from "../components/resource-state";
import { StatusBanner } from "../components/status-banner";
import {
  ClickUpApiError,
  fetchDailyPageData,
  startClickUpOAuth,
  type DailyPageData,
  type ReadMode
} from "../lib/clickup-api";
import { useResourceLoader } from "../lib/use-resource-loader";

export interface DailyPageProps {
  loader?: () => Promise<DailyPageData>;
}

function createMockDailyPageData(): DailyPageData {
  return {
    rows: dailyFixtures,
    readMode: "mock",
    writeMode: "mock"
  };
}

function getDailyErrorMessage(error: Error): string {
  if (error instanceof ClickUpApiError && error.status === 429) {
    const retryMessage =
      typeof error.retryAfterSeconds === "number"
        ? ` Retry after about ${error.retryAfterSeconds} seconds.`
        : "";
    return `The backend is being rate-limited by ClickUp.${retryMessage}`;
  }

  return error.message || "Daily board data could not be loaded.";
}

function renderDailyGrid(data: DailyPageData) {
  const hasCards = data.rows.some((row) => row.cards.length > 0);

  if (!hasCards) {
    return (
      <ResourceState
        message="The backend returned no cards for the tracked daily statuses."
        title="No Daily Work Items"
      />
    );
  }

  return (
    <div className="table-scroll">
      <div className="daily-grid">
        <div />
        {dailyStatuses.map((status) => (
          <div className="daily-column-header" key={status}>
            {status}
          </div>
        ))}
        {data.rows.map((row) => (
          <Fragment key={row.id}>
            <div className="daily-row-title">{row.title}</div>
            {dailyStatuses.map((status) => (
              <div className="daily-column" key={`${row.id}-${status}`}>
                {row.cards
                  .filter((card) => card.status === status)
                  .map((card) => (
                    <DailyCard card={card} key={card.id} />
                  ))}
              </div>
            ))}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function DailyHeader({
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
        <h2>Daily</h2>
        <p>Backend-backed daily board with manual refresh and route-level failure states.</p>
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

export function DailyPage({ loader = fetchDailyPageData }: DailyPageProps) {
  const { data, error, isLoading, isRefreshing, refresh } = useResourceLoader(loader);
  const handleConnect = () => startClickUpOAuth("/daily");

  if (isLoading && !data) {
    return (
      <div className="panel">
        <DailyHeader isRefreshing={false} onRefresh={refresh} />
        <ResourceState
          actionLabel="Retry"
          message="Loading daily board data from the backend."
          onAction={refresh}
          title="Loading Daily Board"
        />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="panel">
        <DailyHeader isRefreshing={false} onRefresh={refresh} />
        <ResourceState
          actionLabel={
            error instanceof ClickUpApiError && error.status === 401
              ? "Connect ClickUp"
              : "Retry"
          }
          message={getDailyErrorMessage(error ?? new Error("Daily data could not be loaded."))}
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
                  : "Daily Board Unavailable"
              : "Daily Board Unavailable"
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
      <DailyHeader
        isRefreshing={isRefreshing}
        onRefresh={refresh}
        readMode={data.readMode}
        writeMode={data.writeMode}
      />
      {error ? (
        <ResourceState
          actionLabel={
            error instanceof ClickUpApiError && error.status === 401
              ? "Connect ClickUp"
              : "Retry"
          }
          disabled={isRefreshing}
          message={getDailyErrorMessage(error)}
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
      {renderDailyGrid(data)}
    </div>
  );
}

export const dailyPageStoryLoader = async (): Promise<DailyPageData> =>
  createMockDailyPageData();
