import type {
  SprintPlanningReport,
  SprintPlanningRow,
  SprintPlanningSprintOption,
  SprintPlanningSprintSummary
} from "@custom-clickup/shared";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties
} from "react";
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
  updatePlanningTaskSprint,
  updatePlanningTaskTime,
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

const unassignedSprintLabel = "Unassigned Sprint";

function parseSprintWeekNumber(label: string): number | undefined {
  const match = /\bW(?:eek\s*)?(\d{1,2})\b/i.exec(label);
  if (!match?.[1]) {
    return undefined;
  }

  const weekNumber = Number(match[1]);
  return Number.isInteger(weekNumber) && weekNumber >= 1 && weekNumber <= 53
    ? weekNumber
    : undefined;
}

function compareSprintLabels(
  left: { label: string; weekNumber?: number },
  right: { label: string; weekNumber?: number }
): number {
  const leftWeekNumber = left.weekNumber ?? Number.POSITIVE_INFINITY;
  const rightWeekNumber = right.weekNumber ?? Number.POSITIVE_INFINITY;
  const weekDelta = leftWeekNumber - rightWeekNumber;
  if (weekDelta !== 0) {
    return weekDelta;
  }

  return left.label.localeCompare(right.label);
}

function createEmptySprintSummary(
  label: string,
  sprintOptions: SprintPlanningSprintOption[]
): SprintPlanningSprintSummary {
  const option = sprintOptions.find((sprintOption) => sprintOption.label === label);
  const weekNumber = parseSprintWeekNumber(label);

  return {
    label,
    ...(option?.color ? { sprintColor: option.color } : {}),
    ...(weekNumber !== undefined ? { weekNumber } : {}),
    estimateHours: 0,
    trackedHours: 0,
    remainingDays: 0,
    remainingHours: 0,
    missingEstimateCount: 0,
    rowCount: 0
  };
}

function addRowToSprintSummary(
  summary: SprintPlanningSprintSummary,
  row: SprintPlanningRow
): void {
  summary.estimateHours += row.estimateHours;
  summary.trackedHours += row.trackedHours;
  summary.remainingHours += row.remainingHours;
  summary.remainingDays += row.remainingDays;
  summary.missingEstimateCount += row.missingEstimate ? 1 : 0;
  summary.rowCount += 1;
}

function rebuildPlanningReport(
  report: SprintPlanningReport,
  rows: SprintPlanningRow[]
): SprintPlanningReport {
  const totals = {
    estimateHours: 0,
    trackedHours: 0,
    remainingHours: 0,
    remainingDays: 0,
    missingEstimateCount: 0,
    rowCount: 0
  };
  const summariesByLabel = new Map<string, SprintPlanningSprintSummary>();

  for (const row of rows) {
    totals.estimateHours += row.estimateHours;
    totals.trackedHours += row.trackedHours;
    totals.remainingHours += row.remainingHours;
    totals.remainingDays += row.remainingDays;
    totals.missingEstimateCount += row.missingEstimate ? 1 : 0;
    totals.rowCount += 1;

    const summary =
      summariesByLabel.get(row.sprintLabel) ??
      createEmptySprintSummary(row.sprintLabel, report.sprintOptions);
    addRowToSprintSummary(summary, row);
    summariesByLabel.set(row.sprintLabel, summary);
  }

  const sprints = [...summariesByLabel.values()].sort(compareSprintLabels);

  return {
    ...report,
    totals,
    sprints,
    rows
  };
}

function updatePlanningReportRow(
  report: SprintPlanningReport,
  taskId: string,
  updateRow: (row: SprintPlanningRow) => SprintPlanningRow
): SprintPlanningReport {
  return rebuildPlanningReport(
    report,
    report.rows.map((row) => (row.taskId === taskId ? updateRow(row) : row))
  );
}

function parseEditableHours(value: string): number | undefined {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return 0;
  }

  const parsedValue = Number(trimmedValue);
  return Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : undefined;
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

function PlanningTimeInput({
  disabled,
  onSave,
  value
}: {
  disabled: boolean;
  onSave: (nextValue: number) => Promise<void>;
  value: number;
}) {
  const [draftValue, setDraftValue] = useState(String(value));
  const skipNextBlurSaveRef = useRef(false);

  useEffect(() => {
    setDraftValue(String(value));
  }, [value]);

  const saveDraftValue = async () => {
    if (skipNextBlurSaveRef.current) {
      skipNextBlurSaveRef.current = false;
      setDraftValue(String(value));
      return;
    }

    const nextValue = parseEditableHours(draftValue);
    if (nextValue === undefined || nextValue === value) {
      setDraftValue(String(value));
      return;
    }

    await onSave(nextValue);
  };

  return (
    <input
      className="planning-table__time-input"
      disabled={disabled}
      inputMode="decimal"
      min="0"
      onBlur={() => {
        void saveDraftValue();
      }}
      onChange={(event) => setDraftValue(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
        }

        if (event.key === "Escape") {
          skipNextBlurSaveRef.current = true;
          setDraftValue(String(value));
          event.currentTarget.blur();
        }
      }}
      step="0.25"
      type="number"
      value={draftValue}
    />
  );
}

function PlanningSprintSelect({
  disabled,
  onSave,
  options,
  value
}: {
  disabled: boolean;
  onSave: (nextValue: string) => Promise<void>;
  options: SprintPlanningSprintOption[];
  value: string;
}) {
  const hasCurrentValue =
    value === unassignedSprintLabel ||
    options.some((option) => option.label === value);

  return (
    <select
      className="planning-table__sprint-select"
      disabled={disabled}
      onChange={(event) => {
        void onSave(event.target.value);
      }}
      value={value}
    >
      <option value={unassignedSprintLabel}>{unassignedSprintLabel}</option>
      {hasCurrentValue ? null : <option value={value}>{value}</option>}
      {options.map((option) => (
        <option key={option.label} value={option.label}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function PlanningRow({
  isSaving,
  onSprintChange,
  onTimeChange,
  row,
  sprintOptions
}: {
  isSaving: boolean;
  onSprintChange: (row: SprintPlanningRow, sprintLabel: string) => Promise<void>;
  onTimeChange: (
    row: SprintPlanningRow,
    update: { estimateHours?: number; trackedHours?: number }
  ) => Promise<void>;
  row: SprintPlanningRow;
  sprintOptions: SprintPlanningSprintOption[];
}) {
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
      <td>
        <PlanningSprintSelect
          disabled={isSaving}
          onSave={(sprintLabel) => onSprintChange(row, sprintLabel)}
          options={sprintOptions}
          value={row.sprintLabel}
        />
      </td>
      <td className="planning-table__number">
        <PlanningTimeInput
          disabled={isSaving}
          onSave={(estimateHours) => onTimeChange(row, { estimateHours })}
          value={row.estimateHours}
        />
      </td>
      <td className="planning-table__number">
        <PlanningTimeInput
          disabled={isSaving}
          onSave={(trackedHours) => onTimeChange(row, { trackedHours })}
          value={row.trackedHours}
        />
      </td>
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
        <th className="planning-table__totals-label" colSpan={9} scope="row">
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
  isSavingTask,
  onSprintChange,
  onTimeChange,
  report,
  sprint
}: {
  isSavingTask: (taskId: string) => boolean;
  onSprintChange: (row: SprintPlanningRow, sprintLabel: string) => Promise<void>;
  onTimeChange: (
    row: SprintPlanningRow,
    update: { estimateHours?: number; trackedHours?: number }
  ) => Promise<void>;
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
              <th>Sprint</th>
              <th>Estimate</th>
              <th>Tracked</th>
              <th>Remaining</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <PlanningRow
                isSaving={isSavingTask(row.taskId)}
                key={row.taskId}
                onSprintChange={onSprintChange}
                onTimeChange={onTimeChange}
                row={row}
                sprintOptions={report.sprintOptions}
              />
            ))}
          </tbody>
          <PlanningSprintTotalsRow sprint={sprint} />
        </table>
      </div>
    </section>
  );
}

function PlanningReportView({
  isSavingTask,
  onSprintChange,
  onTimeChange,
  report
}: {
  isSavingTask: (taskId: string) => boolean;
  onSprintChange: (row: SprintPlanningRow, sprintLabel: string) => Promise<void>;
  onTimeChange: (
    row: SprintPlanningRow,
    update: { estimateHours?: number; trackedHours?: number }
  ) => Promise<void>;
  report: SprintPlanningReport;
}) {
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
          <PlanningSprintSection
            isSavingTask={isSavingTask}
            key={sprint.label}
            onSprintChange={onSprintChange}
            onTimeChange={onTimeChange}
            report={report}
            sprint={sprint}
          />
        ))}
      </div>
    </div>
  );
}

export function PlanningPage({
  loader = fetchPlanningPageData
}: PlanningPageProps) {
  const { data, error, isLoading, isRefreshing, refresh } = useResourceLoader(loader);
  const [editableReport, setEditableReport] = useState<SprintPlanningReport | null>(null);
  const [saveError, setSaveError] = useState<Error | null>(null);
  const [savingTaskIds, setSavingTaskIds] = useState<Set<string>>(() => new Set());
  const handleConnect = () => startClickUpOAuth("/planning");

  useEffect(() => {
    if (data?.report) {
      setEditableReport(data.report);
    }
  }, [data]);

  const setTaskSaving = (taskId: string, isSaving: boolean) => {
    setSavingTaskIds((currentTaskIds) => {
      const nextTaskIds = new Set(currentTaskIds);
      if (isSaving) {
        nextTaskIds.add(taskId);
      } else {
        nextTaskIds.delete(taskId);
      }

      return nextTaskIds;
    });
  };

  const handleTimeChange = async (
    row: SprintPlanningRow,
    update: { estimateHours?: number; trackedHours?: number }
  ) => {
    const previousReport = editableReport;
    if (!previousReport) {
      return;
    }

    const nextEstimateHours = update.estimateHours ?? row.estimateHours;
    const nextTrackedHours = update.trackedHours ?? row.trackedHours;
    const nextRemainingHours = Math.max(0, nextEstimateHours - nextTrackedHours);

    setSaveError(null);
    setTaskSaving(row.taskId, true);
    setEditableReport(
      updatePlanningReportRow(previousReport, row.taskId, (currentRow) => ({
        ...currentRow,
        estimateHours: nextEstimateHours,
        trackedHours: nextTrackedHours,
        remainingHours: nextRemainingHours,
        remainingDays: nextRemainingHours / previousReport.dayHours,
        missingEstimate: nextEstimateHours === 0
      }))
    );

    try {
      await updatePlanningTaskTime(row.taskId, {
        currentTrackedHours: row.trackedHours,
        ...update
      });
    } catch (nextError) {
      setEditableReport(previousReport);
      setSaveError(
        nextError instanceof Error ? nextError : new Error("Planning time update failed.")
      );
    } finally {
      setTaskSaving(row.taskId, false);
    }
  };

  const handleSprintChange = async (row: SprintPlanningRow, sprintLabel: string) => {
    const previousReport = editableReport;
    if (!previousReport || sprintLabel === row.sprintLabel) {
      return;
    }

    const sprintOption = previousReport.sprintOptions.find((option) => option.label === sprintLabel);
    setSaveError(null);
    setTaskSaving(row.taskId, true);
    setEditableReport(
      updatePlanningReportRow(previousReport, row.taskId, (currentRow) => {
        const nextRow: SprintPlanningRow = {
          ...currentRow,
          sprintLabel
        };

        if (sprintOption?.color) {
          nextRow.sprintColor = sprintOption.color;
        } else {
          delete nextRow.sprintColor;
        }

        return nextRow;
      })
    );

    try {
      await updatePlanningTaskSprint(
        row.taskId,
        sprintLabel === unassignedSprintLabel ? null : sprintLabel
      );
    } catch (nextError) {
      setEditableReport(previousReport);
      setSaveError(
        nextError instanceof Error ? nextError : new Error("Sprint update failed.")
      );
    } finally {
      setTaskSaving(row.taskId, false);
    }
  };

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
      {saveError ? (
        <ResourceState
          actionLabel="Dismiss"
          message={getPlanningErrorMessage(saveError)}
          onAction={() => setSaveError(null)}
          title="Planning Update Failed"
          tone="error"
        />
      ) : null}
      <PlanningReportView
        isSavingTask={(taskId) => savingTaskIds.has(taskId)}
        onSprintChange={handleSprintChange}
        onTimeChange={handleTimeChange}
        report={editableReport ?? data.report}
      />
    </div>
  );
}
