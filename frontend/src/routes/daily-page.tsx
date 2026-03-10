import {
  dailyFixtures,
  dailyStatuses,
  type DailyCard as DailyCardModel,
  type DailyRow
} from "@custom-clickup/shared";
import { useState } from "react";
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
import {
  filterDailyBoard,
  type DailyBoardCounts,
  type DailyBoardFilters
} from "../lib/daily-board";
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
    readMode: "mock"
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

function formatCount(value: number, total: number, filtersActive: boolean): string {
  return filtersActive ? `${value} / ${total}` : String(total);
}

function renderDailyGrid({
  counts,
  filtersActive,
  onClearFilters,
  rows
}: {
  counts: DailyBoardCounts;
  filtersActive: boolean;
  onClearFilters: () => void;
  rows: ReturnType<typeof filterDailyBoard>["rows"];
}) {
  if (!filtersActive && !counts.totalCards) {
    return (
      <ResourceState
        message="The backend returned no cards for the tracked daily statuses."
        title="No Daily Work Items"
      />
    );
  }

  if (filtersActive && rows.length === 0) {
    return (
      <ResourceState
        actionLabel="Clear filters"
        message="No daily cards match the current filters."
        onAction={onClearFilters}
        title="No Matching Daily Cards"
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
              <span className="daily-column-header__label">{status}</span>
              <span className="daily-column-header__count">
                {formatCount(counts.visibleByStatus[status], counts.totalByStatus[status], filtersActive)}
              </span>
            </div>
          ))}
        </div>
        <div className="daily-board__body">
          {rows.map((row) => (
            <section className={`daily-swimlane daily-swimlane--${row.type}`} key={row.id}>
              <div className="daily-swimlane__header">
                <div className="daily-swimlane__header-top">
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
                  <span className="daily-swimlane__count">
                    {formatCount(row.cards.length, row.totalCardCount, filtersActive)} cards
                  </span>
                </div>
                <strong className="daily-swimlane__title">{row.title}</strong>
                {typeof row.prioScore === "number" ? (
                  <span className="daily-swimlane__prio">Prio {row.prioScore}</span>
                ) : null}
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
  counts,
  filtersActive,
  isRefreshing,
  onRefresh,
  readMode
}: {
  counts?: DailyBoardCounts;
  filtersActive: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
  readMode?: ReadMode;
}) {
  const cardSummary =
    counts && filtersActive
      ? `${counts.visibleCards} / ${counts.totalCards} active cards visible.`
      : counts
        ? `${counts.totalCards} active cards loaded.`
        : undefined;

  return (
    <div className="panel-header">
      <div className="panel-header-copy">
        <div className="panel-eyebrow">Board view</div>
        <h2>Daily</h2>
        <p>
          Delivery board snapshot with fixed workflow columns.
          {cardSummary ? ` ${cardSummary}` : ""}
        </p>
      </div>
      <div className="panel-header-actions">
        {readMode ? <StatusBanner readMode={readMode} /> : null}
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
  const [filters, setFilters] = useState<DailyBoardFilters>({
    search: "",
    assignee: ""
  });
  const handleConnect = () => startClickUpOAuth("/daily");

  function handleSearchChange(search: string) {
    setFilters((current) => ({
      ...current,
      search
    }));
  }

  function handleAssigneeChange(assignee: string) {
    setFilters((current) => ({
      ...current,
      assignee
    }));
  }

  function handleClearFilters() {
    setFilters({
      search: "",
      assignee: ""
    });
  }

  if (isLoading && !data) {
    return (
      <div className="panel panel--route">
        <DailyHeader filtersActive={false} isRefreshing={false} onRefresh={refresh} />
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
        <DailyHeader filtersActive={false} isRefreshing={false} onRefresh={refresh} />
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

  const sortedRows = sortDailyRows(data.rows);
  const filteredBoard = filterDailyBoard(sortedRows, filters);

  return (
    <div className="panel panel--route">
      <DailyHeader
        counts={filteredBoard.counts}
        filtersActive={filteredBoard.filtersActive}
        isRefreshing={isRefreshing}
        onRefresh={refresh}
        readMode={data.readMode}
      />
      <div className="filter-toolbar" role="group" aria-label="Daily filters">
        <label className="filter-field">
          <span className="filter-field__label">Search</span>
          <input
            className="filter-input"
            onChange={(event) => handleSearchChange(event.target.value)}
            placeholder="Story, card title, or custom ID"
            type="search"
            value={filters.search}
          />
        </label>
        <label className="filter-field">
          <span className="filter-field__label">Assignee</span>
          <select
            className="filter-select"
            onChange={(event) => handleAssigneeChange(event.target.value)}
            value={filters.assignee}
          >
            <option value="">All assignees</option>
            {filteredBoard.assigneeOptions.map((assignee) => (
              <option key={assignee} value={assignee}>
                {assignee}
              </option>
            ))}
          </select>
        </label>
        <div className="filter-toolbar__actions">
          <div className="filter-toolbar__summary">
            {filteredBoard.filtersActive
              ? `${filteredBoard.counts.visibleCards} of ${filteredBoard.counts.totalCards} cards visible`
              : `${filteredBoard.counts.totalCards} cards in snapshot`}
          </div>
          <button
            className="toolbar-button"
            disabled={!filteredBoard.filtersActive}
            onClick={handleClearFilters}
            type="button"
          >
            Clear filters
          </button>
        </div>
      </div>
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
      {renderDailyGrid({
        counts: filteredBoard.counts,
        filtersActive: filteredBoard.filtersActive,
        onClearFilters: handleClearFilters,
        rows: filteredBoard.rows
      })}
    </div>
  );
}

export const dailyPageStoryLoader = async (): Promise<DailyPageData> =>
  createMockDailyPageData();
