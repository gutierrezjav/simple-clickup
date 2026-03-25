import {
  dailyFixtures,
  dailyStatuses,
  type DailyCard as DailyCardModel,
  type DailyStatus,
  type DailyRow
} from "@custom-clickup/shared";
import { useState, type CSSProperties } from "react";
import { DailyCard } from "../components/daily/daily-card";
import { ResourceState } from "../components/resource-state";
import {
  ClickUpApiError,
  fetchDailyPageData,
  startClickUpOAuth,
  type DailyPageData
} from "../lib/clickup-api";
import {
  filterDailyBoard,
  getVisibleDailyStatuses,
  isDailyStatusCollapsedByDefault,
  type DailyBoardCounts,
  type DailyBoardFilters
} from "../lib/daily-board";
import { getClickUpTaskUrl } from "../lib/clickup-task-url";
import { useTopBarAction } from "../lib/top-bar-action";
import { useResourceLoader } from "../lib/use-resource-loader";

export interface DailyPageProps {
  loader?: () => Promise<DailyPageData>;
}

type StatusCollapseOverrides = Partial<Record<DailyStatus, boolean>>;

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

function formatColumnCount(
  value: number,
  total: number,
  filtersActive: boolean,
  collapsed: boolean
): string {
  if (!filtersActive) {
    return String(total);
  }

  return collapsed ? `${value}/${total}` : `${value} / ${total}`;
}

function getCollapsedStatusLabel(status: (typeof dailyStatuses)[number]): string {
  switch (status) {
    case "BLOCKED":
      return "BLK";
    case "SPRINT BACKLOG":
      return "SB";
    case "IN PROGRESS":
      return "IP";
    case "IN CODE REVIEW":
      return "CR";
    case "DEPLOYED TO DEV":
      return "DD";
    case "TESTED IN DEV":
      return "TD";
    case "DEPLOYED TO STAGING":
      return "DS";
    case "TESTED IN STAGING":
      return "TS";
    default:
      return status;
  }
}

function renderDailyGrid({
  counts,
  filtersActive,
  onClearFilters,
  onToggleStatus,
  rows,
  statusCollapseOverrides
}: {
  counts: DailyBoardCounts;
  filtersActive: boolean;
  onClearFilters: () => void;
  onToggleStatus: (status: DailyStatus, collapsed: boolean) => void;
  rows: ReturnType<typeof filterDailyBoard>["rows"];
  statusCollapseOverrides: StatusCollapseOverrides;
}) {
  const visibleStatuses = new Set(getVisibleDailyStatuses(rows));
  const swimlaneWidth = 228;
  const statusWidth = 206;
  const collapsedStatusWidth = 72;
  const isStatusCollapsed = (status: DailyStatus) =>
    statusCollapseOverrides[status] ?? isDailyStatusCollapsedByDefault(status, visibleStatuses);
  const totalBoardWidth = dailyStatuses.reduce(
    (width, status) => width + (isStatusCollapsed(status) ? collapsedStatusWidth : statusWidth),
    swimlaneWidth
  );
  const dailyBoardStyle = {
    "--daily-status-count": String(dailyStatuses.length),
    "--daily-grid-columns": `${swimlaneWidth}px ${dailyStatuses
      .map((status) => (isStatusCollapsed(status) ? `${collapsedStatusWidth}px` : `minmax(${statusWidth}px, 1fr)`))
      .join(" ")}`,
    "--daily-board-min-width": `${totalBoardWidth + 48}px`
  } as CSSProperties;

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
      <div className="daily-board" style={dailyBoardStyle}>
        <div className="daily-board__header">
          <div className="daily-board__header-label">Swimlane</div>
          {dailyStatuses.map((status) => {
            const collapsed = isStatusCollapsed(status);

            return (
              <button
                aria-expanded={!collapsed}
                className="daily-column-header daily-column-header--toggle"
                data-collapsed={collapsed ? "true" : "false"}
                data-status={status}
                key={status}
                onClick={() => onToggleStatus(status, collapsed)}
                title={`${collapsed ? "Expand" : "Collapse"} ${status} column`}
                type="button"
              >
                <span className="daily-column-header__label">{status}</span>
                <span className="daily-column-header__count">
                  {formatColumnCount(
                    counts.visibleByStatus[status],
                    counts.totalByStatus[status],
                    filtersActive,
                    collapsed
                  )}
                </span>
                {collapsed ? (
                  <span className="daily-column-header__collapsed-label">
                    {getCollapsedStatusLabel(status)}
                  </span>
                ) : null}
              </button>
            );
          })}
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
                <strong className="daily-swimlane__title">
                  {row.type === "story" ? (
                    <a
                      className="task-link"
                      href={getClickUpTaskUrl(row.id)}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {row.title}
                    </a>
                  ) : (
                    row.title
                  )}
                </strong>
                {typeof row.prioScore === "number" ? (
                  <span className="daily-swimlane__prio">Prio {row.prioScore}</span>
                ) : null}
              </div>
              {dailyStatuses.map((status) => {
                const collapsed = isStatusCollapsed(status);

                return (
                  <div
                    className="daily-column"
                    data-collapsed={collapsed ? "true" : "false"}
                    data-status={status}
                    key={`${row.id}-${status}`}
                  >
                    {collapsed
                      ? null
                      : row.cards
                          .filter((card) => card.status === status)
                          .map((card) => (
                            <DailyCard card={card} key={card.id} />
                          ))}
                  </div>
                );
              })}
            </section>
          ))}
        </div>
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
  const [statusCollapseOverrides, setStatusCollapseOverrides] = useState<StatusCollapseOverrides>({});
  useTopBarAction({
    disabled: isRefreshing,
    label: isRefreshing ? "Refreshing..." : "Refresh",
    onAction: refresh
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

  function handleToggleStatus(status: DailyStatus, collapsed: boolean) {
    setStatusCollapseOverrides((current) => ({
      ...current,
      [status]: !collapsed
    }));
  }

  if (isLoading && !data) {
    return (
      <div className="panel panel--route">
        <ResourceState
          isLoading
          message="Loading daily board data from the backend."
          title="Loading Daily Board"
        />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="panel panel--route">
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
            className={`filter-select ${
              filters.assignee === ""
                ? "filter-select--placeholder"
                : ""
            }`}
            onChange={(event) => handleAssigneeChange(event.target.value)}
            value={filters.assignee}
          >
            <option value="" hidden>
              Filter assignee
            </option>
            {filteredBoard.assigneeOptions.map((assignee) => (
              <option key={assignee} value={assignee}>
                {assignee === "Unassigned" ? "<< unassigned >>" : assignee}
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
        onToggleStatus: handleToggleStatus,
        rows: filteredBoard.rows,
        statusCollapseOverrides
      })}
    </div>
  );
}

export const dailyPageStoryLoader = async (): Promise<DailyPageData> =>
  createMockDailyPageData();
