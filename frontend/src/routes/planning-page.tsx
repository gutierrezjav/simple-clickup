import type {
  SprintPlanningReport,
  SprintPlanningRow,
  SprintPlanningSprintSummary,
  SprintPlanningTotals
} from "@custom-clickup/shared";
import { ResourceState } from "../components/resource-state";
import {
  TaskAssigneeInline,
  TaskIdentityBlock
} from "../components/task/task-primitives";
import {
  ClickUpApiError,
  fetchPlanningPageData,
  formatClickUpRateLimitUsage,
  startClickUpOAuth,
  type PlanningPageData
} from "../lib/clickup-api";
import {
  formatPlanningTime,
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

function PlanningMetric({
  label,
  value,
  tone = "neutral"
}: {
  label: string;
  value: string | number;
  tone?: "negative" | "neutral" | "warning";
}) {
  return (
    <div className="planning-metric" data-tone={tone}>
      <span className="planning-metric__label">{label}</span>
      <strong className="planning-metric__value">{value}</strong>
    </div>
  );
}

function PlanningTotals({ totals }: { totals: SprintPlanningTotals }) {
  return (
    <section className="planning-totals" aria-label="Sprint planning totals">
      <PlanningMetric label="Rows" value={totals.rowCount} />
      <PlanningMetric label="Estimate" value={formatPlanningTime(totals.estimateHours)} />
      <PlanningMetric label="Tracked" value={formatPlanningTime(totals.trackedHours)} />
      <PlanningMetric
        label="Remaining"
        tone={getRemainingTimeTone(totals.remainingHours)}
        value={formatPlanningTime(totals.remainingHours)}
      />
      <PlanningMetric
        label="Missing estimate"
        tone={totals.missingEstimateCount > 0 ? "warning" : "neutral"}
        value={totals.missingEstimateCount}
      />
    </section>
  );
}

function PlanningSprintSummary({ sprint }: { sprint: SprintPlanningSprintSummary }) {
  return (
    <div className="planning-sprint-summary">
      <div className="planning-sprint-summary__title">
        <span className="pill pill--status pill--status-compact">{sprint.label}</span>
        <span className="planning-sprint-summary__week">{sprint.rowCount}</span>
      </div>
      <div className="planning-sprint-summary__metrics">
        {typeof sprint.weekNumber === "number" ? <span>W{sprint.weekNumber}</span> : null}
        <span>{formatPlanningTime(sprint.estimateHours)} est.</span>
        <span>{formatPlanningTime(sprint.remainingHours)} rem.</span>
      </div>
    </div>
  );
}

function PlanningAssignees({ assignees }: { assignees: string[] }) {
  const visibleAssignees = assignees.length > 0 ? assignees : [undefined];

  return (
    <div className="planning-table__assignees">
      {visibleAssignees.map((assignee, index) => (
        <TaskAssigneeInline
          assignee={assignee}
          avatarUrl={undefined}
          className="planning-table__assignee"
          compact
          key={assignee ?? `unassigned-${index}`}
          nameClassName="planning-table__assignee-name"
        />
      ))}
    </div>
  );
}

function PlanningFieldPill({ value }: { value: string | undefined }) {
  if (!value) {
    return <span>-</span>;
  }

  return <span className="pill pill--kind">{value}</span>;
}

function PlanningRow({ row }: { row: SprintPlanningRow }) {
  const remainingTone = getRemainingTimeTone(row.remainingHours);

  return (
    <tr className="planning-table__row" data-missing-estimate={row.missingEstimate ? "true" : "false"}>
      <td className="planning-table__task-cell">
        <TaskIdentityBlock
          className="planning-table__identity"
          customId={row.taskCustomId}
          taskId={row.taskId}
          title={row.title}
          titleClassName="planning-table__title"
        />
      </td>
      <td className="planning-table__number">{row.prioScore ?? "-"}</td>
      <td><PlanningFieldPill value={row.epic} /></td>
      <td>
        <PlanningAssignees assignees={row.assignees} />
      </td>
      <td>
        <span className="pill pill--status pill--status-compact">{row.status}</span>
      </td>
      <td><PlanningFieldPill value={row.budget} /></td>
      <td className="planning-table__number">{formatPlanningTime(row.estimateHours)}</td>
      <td className="planning-table__number">{formatPlanningTime(row.trackedHours)}</td>
      <td className="planning-table__number" data-tone={remainingTone}>
        {formatPlanningTime(row.remainingHours)}
      </td>
      <td><span className="pill pill--status pill--status-compact">{row.sprintLabel}</span></td>
    </tr>
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
              <th>Name</th>
              <th>Prio score</th>
              <th>Epic</th>
              <th>Assignee</th>
              <th>Status</th>
              <th>Budget</th>
              <th>Time estimate</th>
              <th>Time tracked</th>
              <th>Time (remaining)</th>
              <th>Sprint</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <PlanningRow key={row.taskId} row={row} />
            ))}
          </tbody>
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
      <PlanningTotals totals={report.totals} />
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
