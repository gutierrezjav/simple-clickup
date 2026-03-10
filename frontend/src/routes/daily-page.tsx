import {
  dailyFixtures,
  dailyStatuses,
  type DailyCard as DailyCardModel,
  type DailyRow,
  type WriteMode
} from "@custom-clickup/shared";
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

function compareByPriority(
  left: { prioScore?: number },
  right: { prioScore?: number }
): number {
  return (left.prioScore ?? Number.POSITIVE_INFINITY) - (right.prioScore ?? Number.POSITIVE_INFINITY);
}

function sortCards(cards: DailyCardModel[]): DailyCardModel[] {
  return [...cards].sort(compareByPriority);
}

function sortDailyRows(rows: DailyRow[]): DailyRow[] {
  const storyRows = rows
    .filter((row) => row.type === "story")
    .map((row) => ({
      ...row,
      cards: sortCards(row.cards)
    }))
    .sort(compareByPriority);
  const tasksRow = rows.find((row) => row.type === "tasks");
  const bugsRow = rows.find((row) => row.type === "bugs");

  const pickRowPriority = (row?: DailyRow) => {
    if (!row) {
      return undefined;
    }

    if (typeof row.prioScore === "number") {
      return row.prioScore;
    }

    const lowestCard = [...row.cards].sort(compareByPriority)[0];
    return lowestCard?.prioScore;
  };

  const extraRows = [tasksRow, bugsRow]
    .filter((row): row is DailyRow => Boolean(row))
    .map((row) => {
      const prioScore = pickRowPriority(row);

      return {
        ...row,
        ...(typeof prioScore === "number" ? { prioScore } : {}),
        cards: sortCards(row.cards)
      };
    });

  return [...storyRows, ...extraRows].sort(compareByPriority);
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
  const rows = sortDailyRows(data.rows);
  const hasCards = rows.some((row) => row.cards.length > 0);

  if (!hasCards) {
    return (
      <ResourceState
        message="The backend returned no cards for the tracked daily statuses."
        title="No Daily Work Items"
      />
    );
  }

  return (
    <div className="table-scroll table-scroll--board">
      <div className="daily-board">
        <div className="daily-board__header">
          <div className="daily-board__header-label">Swimlane</div>
          {dailyStatuses.map((status) => (
            <div className="daily-column-header" key={status}>
              {status}
            </div>
          ))}
        </div>
        <div className="daily-board__body">
          {rows.map((row) => (
            <section className={`daily-swimlane daily-swimlane--${row.type}`} key={row.id}>
              <div className="daily-swimlane__header">
                <span
                  className={`pill pill--kind pill--${
                    row.type === "story"
                      ? "story"
                      : row.type === "tasks"
                        ? "standalone-task"
                        : "standalone-bug"
                  }`}
                >
                  {row.type === "story" ? "Story" : row.type === "tasks" ? "Tasks" : "Bugs"}
                </span>
                <strong>{row.title}</strong>
                {typeof row.prioScore === "number" ? (
                  <span className="daily-swimlane__prio">Prio {row.prioScore}</span>
                ) : null}
                <span className="daily-swimlane__count">{row.cards.length} cards</span>
              </div>
              {dailyStatuses.map((status) => (
                <div className="daily-column" key={`${row.id}-${status}`}>
                  {row.cards
                    .filter((card) => card.status === status)
                    .map((card) => (
                      <DailyCard card={card} key={card.id} />
                    ))}
                </div>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

function DailyHeader({
  cardCount,
  isRefreshing,
  onRefresh,
  readMode,
  writeMode
}: {
  cardCount?: number;
  isRefreshing: boolean;
  onRefresh: () => void;
  readMode?: ReadMode;
  writeMode?: WriteMode;
}) {
  return (
    <div className="panel-header">
      <div className="panel-header-copy">
        <div className="panel-eyebrow">Board view</div>
        <h2>Daily</h2>
        <p>
          Delivery board snapshot with fixed workflow columns.
          {typeof cardCount === "number" ? ` ${cardCount} active cards loaded.` : ""}
        </p>
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
      <div className="panel panel--route">
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
      <div className="panel panel--route">
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
    <div className="panel panel--route">
      <DailyHeader
        cardCount={data.rows.reduce((count, row) => count + row.cards.length, 0)}
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
