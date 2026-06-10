import type {
  SprintPlanningReport,
  SprintPlanningRow,
  SprintPlanningSprintSummary
} from "@custom-clickup/shared";
import type { CSSProperties } from "react";
import { ResourceState } from "../components/resource-state";
import {
  TaskAssigneeInline,
  TaskTitleLink
} from "../components/task/task-primitives";
import {
  ClickUpApiError,
  fetchPlanningPageData,
  formatClickUpRateLimitUsage,
  startClickUpOAuth,
  type PlanningPageData
} from "../lib/clickup-api";
import {
  formatPlanningRemainingTime,
  formatPlanningTime,
  getPlanningSprintFooterTotals,
  getRemainingTimeTone
} from "../lib/sprint-planning";
import { useResourceLoader } from "../lib/use-resource-loader";

export interface PlanningPageProps {
  loader?: () => Promise<PlanningPageData>;
}

function getPlanningErrorMessage(error: Error): string {
  const rateLimitMessage = formatClickUpRateLimitUsage(error) ?? "";

  if (error instanceof ClickUpApiError && error.status === 429) {
    const retryMessage =
      typeof error.retryAfterSeconds === "number"
        ? ` Retry after about ${error.retryAfterSeconds} seconds.`
        : "";
    return `The backend is being rate-limited by ClickUp.${retryMessage}${rateLimitMessage}`;
  }

  return `${error.message || "Sprint planning data could not be loaded."}${rateLimitMessage}`;
}

function isUnauthorizedError(error: Error | null | undefined): boolean {
  return error instanceof ClickUpApiError && error.status === 401;
}

function getPlanningErrorTitle(error: Error | null | undefined): string {
  if (!(error instanceof ClickUpApiError)) {
    return "Sprint Planning Unavailable";
  }

  if (error.status === 429) {
    return "Rate Limited";
  }

  if (error.status === 401) {
    return "ClickUp Connection Required";
  }

  return "Sprint Planning Unavailable";
}

function PlanningHeader({
  isRefreshing,
  onRefresh
}: {
  isRefreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="panel-header">
      <div className="panel-header-copy">
        <div className="panel-eyebrow">Sprint planning</div>
        <h2>Planning</h2>
        <p>Tasks visible in the ClickUp planning view with rolled estimate and remaining time.</p>
      </div>
      <div className="panel-header-actions">
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

function PlanningSprintSummary({ sprint }: { sprint: SprintPlanningSprintSummary }) {
  const taskCountLabel = `${sprint.rowCount} ${sprint.rowCount === 1 ? "task" : "tasks"}`;

  return (
    <div className="planning-sprint-summary" aria-label={`${sprint.label} sprint`}>
      <h3 className="planning-sprint-summary__heading">
        <span
          className="planning-sprint-summary__chip"
          style={getClickUpOptionPillStyle(sprint.sprintColor)}
        >
          {sprint.label}
        </span>
      </h3>
      <span className="planning-sprint-summary__count">{taskCountLabel}</span>
    </div>
  );
}

function PlanningAssignees({ assignees }: { assignees: SprintPlanningRow["assignees"] }) {
  const visibleAssignees: Array<SprintPlanningRow["assignees"][number] | undefined> =
    assignees.length > 0 ? assignees : [undefined];

  return (
    <div className="planning-table__assignees">
      {visibleAssignees.map((assignee, index) => (
        <TaskAssigneeInline
          assignee={assignee?.name}
          avatarUrl={assignee?.avatarUrl}
          className="planning-table__assignee"
          compact
          key={assignee?.name ?? `unassigned-${index}`}
          nameClassName="planning-table__assignee-name"
        />
      ))}
    </div>
  );
}

function getTaskTypePillClassName(taskType: string): string {
  const normalizedTaskType = taskType.trim().toLowerCase();

  if (normalizedTaskType.includes("bug")) {
    return "pill pill--standalone-bug";
  }

  if (normalizedTaskType.includes("story")) {
    return "pill pill--story";
  }

  if (normalizedTaskType.includes("subtask")) {
    return "pill pill--subtask";
  }

  return "pill pill--standalone-task";
}

function getRgbFromHexColor(color: string): { blue: number; green: number; red: number } | undefined {
  const normalized = color.trim().replace(/^#/, "");
  const hex =
    normalized.length === 3
      ? normalized.split("").map((character) => `${character}${character}`).join("")
      : normalized;

  if (!/^[0-9a-f]{6}$/i.test(hex)) {
    return undefined;
  }

  return {
    red: Number.parseInt(hex.slice(0, 2), 16),
    green: Number.parseInt(hex.slice(2, 4), 16),
    blue: Number.parseInt(hex.slice(4, 6), 16)
  };
}

function getReadableTextColor(backgroundColor: string): string {
  const rgb = getRgbFromHexColor(backgroundColor);
  if (!rgb) {
    return "var(--text-strong)";
  }

  const yiq = (rgb.red * 299 + rgb.green * 587 + rgb.blue * 114) / 1000;
  return yiq >= 150 ? "#1f2533" : "#ffffff";
}

function getClickUpOptionPillStyle(color: string | undefined): CSSProperties | undefined {
  if (!color) {
    return undefined;
  }

  return {
    background: color,
    color: getReadableTextColor(color)
  };
}

function PlanningColoredPill({
  color,
  value
}: {
  color: string | undefined;
  value: string | undefined;
}) {
  if (!value) {
    return <span>-</span>;
  }

  return (
    <span className="planning-table__field-pill" style={getClickUpOptionPillStyle(color)}>
      {value}
    </span>
  );
}

function PlanningRow({ row }: { row: SprintPlanningRow }) {
  const remainingTone = getRemainingTimeTone(row.remainingHours);

  return (
    <tr className="planning-table__row" data-missing-estimate={row.missingEstimate ? "true" : "false"}>
      <td className="planning-table__task-type-cell">
        <span className={getTaskTypePillClassName(row.taskType)}>{row.taskType}</span>
      </td>
      <td className="planning-table__task-id">
        <TaskTitleLink
          className="planning-table__task-id-link"
          taskId={row.taskId}
          title={row.taskCustomId}
        />
      </td>
      <td className="planning-table__task-cell">
        <div className="planning-table__title">
          <TaskTitleLink taskId={row.taskId} title={row.title} />
        </div>
      </td>
      <td className="planning-table__number">{row.prioScore ?? "-"}</td>
      <td><PlanningColoredPill color={row.epicColor} value={row.epic} /></td>
      <td>
        <PlanningAssignees assignees={row.assignees} />
      </td>
      <td>
        <PlanningColoredPill color={row.statusColor} value={row.status} />
      </td>
      <td><PlanningColoredPill color={row.budgetColor} value={row.budget} /></td>
      <td className="planning-table__number">{formatPlanningTime(row.estimateHours)}</td>
      <td className="planning-table__number">{formatPlanningTime(row.trackedHours)}</td>
      <td className="planning-table__number" data-tone={remainingTone}>
        {formatPlanningRemainingTime(row.remainingHours)}
      </td>
    </tr>
  );
}

function PlanningSprintTotalsRow({ sprint }: { sprint: SprintPlanningSprintSummary }) {
  const totals = getPlanningSprintFooterTotals(sprint);

  return (
    <tfoot>
      <tr className="planning-table__totals-row">
        <th className="planning-table__totals-label" colSpan={8} scope="row">
          Total
        </th>
        <td className="planning-table__number">{totals.estimate}</td>
        <td className="planning-table__number">{totals.tracked}</td>
        <td className="planning-table__number" data-tone={totals.remaining.tone}>
          {totals.remaining.value}
        </td>
      </tr>
    </tfoot>
  );
}

function PlanningSprintSection({
  report,
  sprint
}: {
  report: SprintPlanningReport;
  sprint: SprintPlanningSprintSummary;
}) {
  const rows = report.rows.filter((row) => row.sprintLabel === sprint.label);

  return (
    <section className="planning-sprint">
      <div className="planning-sprint__header">
        <PlanningSprintSummary sprint={sprint} />
      </div>
      <div className="table-scroll">
        <table className="planning-table">
          <thead>
            <tr>
              <th>Task Type</th>
              <th>Task ID</th>
              <th>Name</th>
              <th>Prio score</th>
              <th>Epic</th>
              <th>Assignee</th>
              <th>Status</th>
              <th>Budget</th>
              <th>Estimate</th>
              <th>Tracked</th>
              <th>Remaining</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <PlanningRow key={row.taskId} row={row} />
            ))}
          </tbody>
          <PlanningSprintTotalsRow sprint={sprint} />
        </table>
      </div>
    </section>
  );
}

function PlanningReportView({ report }: { report: SprintPlanningReport }) {
  if (report.rows.length === 0) {
    return (
      <ResourceState
        message="The ClickUp planning view returned no visible tasks."
        title="No Planning Rows"
      />
    );
  }

  return (
    <div className="planning-layout">
      <div className="planning-sprint-list">
        {report.sprints.map((sprint) => (
          <PlanningSprintSection key={sprint.label} report={report} sprint={sprint} />
        ))}
      </div>
    </div>
  );
}

export function PlanningPage({
  loader = fetchPlanningPageData
}: PlanningPageProps) {
  const { data, error, isLoading, isRefreshing, refresh } = useResourceLoader(loader);
  const handleConnect = () => startClickUpOAuth("/planning");

  if (isLoading && !data) {
    return (
      <div className="panel panel--route">
        <PlanningHeader isRefreshing={false} onRefresh={refresh} />
        <ResourceState
          isLoading
          message="Loading sprint planning rows from the backend."
          title="Loading Sprint Planning"
        />
      </div>
    );
  }

  if (!data) {
    const fallbackError = error ?? new Error("Sprint planning data could not be loaded.");

    return (
      <div className="panel panel--route">
        <PlanningHeader isRefreshing={false} onRefresh={refresh} />
        <ResourceState
          actionLabel={isUnauthorizedError(error) ? "Connect ClickUp" : "Retry"}
          message={getPlanningErrorMessage(fallbackError)}
          onAction={isUnauthorizedError(error) ? handleConnect : refresh}
          title={getPlanningErrorTitle(error)}
          tone={error instanceof ClickUpApiError && error.status === 429 ? "warning" : "error"}
        />
      </div>
    );
  }

  return (
    <div className="panel panel--route">
      <PlanningHeader isRefreshing={isRefreshing} onRefresh={refresh} />
      {error ? (
        <ResourceState
          actionLabel={isUnauthorizedError(error) ? "Connect ClickUp" : "Retry"}
          disabled={isRefreshing}
          message={getPlanningErrorMessage(error)}
          onAction={isUnauthorizedError(error) ? handleConnect : refresh}
          title={isUnauthorizedError(error) ? "ClickUp Connection Required" : "Refresh Failed"}
          tone={error instanceof ClickUpApiError && error.status === 429 ? "warning" : "error"}
        />
      ) : null}
      <PlanningReportView report={data.report} />
    </div>
  );
}
