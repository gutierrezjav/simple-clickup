import type { NamedCountSummary } from "@custom-clickup/shared";
import { ResourceState } from "../components/resource-state";
import { StatusBanner } from "../components/status-banner";
import {
  ClickUpApiError,
  fetchVerificationPageData,
  startClickUpOAuth,
  type ReadMode,
  type VerificationPageData
} from "../lib/clickup-api";
import { useResourceLoader } from "../lib/use-resource-loader";

export interface VerificationPageProps {
  loader?: () => Promise<VerificationPageData>;
}

function getVerificationErrorMessage(error: Error): string {
  if (error instanceof ClickUpApiError && error.status === 429) {
    const retryMessage =
      typeof error.retryAfterSeconds === "number"
        ? ` Retry after about ${error.retryAfterSeconds} seconds.`
        : "";
    return `The backend is being rate-limited by ClickUp.${retryMessage}`;
  }

  return error.message || "Verification data could not be loaded.";
}

function formatCounts(items: NamedCountSummary[]): string {
  return items.map((item) => `${item.name}: ${item.count}`).join(", ");
}

function VerificationHeader({
  isRefreshing,
  onRefresh,
  readMode
}: {
  isRefreshing: boolean;
  onRefresh: () => void;
  readMode?: ReadMode;
}) {
  return (
    <div className="panel-header">
      <div className="panel-header-copy">
        <div className="panel-eyebrow">Phase 2</div>
        <h2>Verification</h2>
        <p>Live snapshot summary fetched through the current browser session.</p>
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

function VerificationSection({
  title,
  metrics,
  counts
}: {
  title: string;
  metrics: Array<{ label: string; value: number | string }>;
  counts: Array<{ label: string; items: NamedCountSummary[] }>;
}) {
  return (
    <section className="verification-section">
      <div className="verification-section__header">
        <h3>{title}</h3>
      </div>
      <div className="verification-metrics">
        {metrics.map((metric) => (
          <div className="verification-metric" key={metric.label}>
            <span className="verification-metric__label">{metric.label}</span>
            <strong className="verification-metric__value">{metric.value}</strong>
          </div>
        ))}
      </div>
      <div className="verification-lists">
        {counts.map((group) => (
          <div className="verification-list" key={group.label}>
            <div className="verification-list__label">{group.label}</div>
            <div className="verification-list__value">{formatCounts(group.items)}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function VerificationPage({
  loader = fetchVerificationPageData
}: VerificationPageProps) {
  const { data, error, isLoading, isRefreshing, refresh } = useResourceLoader(loader);
  const handleConnect = () => startClickUpOAuth("/verify");

  if (isLoading && !data) {
    return (
      <div className="panel panel--route">
        <VerificationHeader isRefreshing={false} onRefresh={refresh} />
        <ResourceState
          actionLabel="Retry"
          message="Loading the verification snapshot from the backend."
          onAction={refresh}
          title="Loading Verification"
        />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="panel panel--route">
        <VerificationHeader isRefreshing={false} onRefresh={refresh} />
        <ResourceState
          actionLabel={
            error instanceof ClickUpApiError && error.status === 401
              ? "Connect ClickUp"
              : "Retry"
          }
          message={getVerificationErrorMessage(error ?? new Error("Verification data could not be loaded."))}
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
                  : "Verification Unavailable"
              : "Verification Unavailable"
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

  const { summary } = data;

  return (
    <div className="panel panel--route">
      <VerificationHeader
        isRefreshing={isRefreshing}
        onRefresh={refresh}
        readMode={data.readMode}
      />
      <div className="verification-meta">
        <div className="verification-meta__item">
          <span className="verification-meta__label">Workspace</span>
          <strong>{summary.schema.workspaceId}</strong>
        </div>
        <div className="verification-meta__item">
          <span className="verification-meta__label">List</span>
          <strong>{summary.schema.listId}</strong>
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
          message={getVerificationErrorMessage(error)}
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
      <div className="verification-layout">
        <VerificationSection
          counts={[
            { label: "By kind", items: summary.planning.byKind },
            { label: "By status", items: summary.planning.byStatus }
          ]}
          metrics={[
            { label: "Top-level items", value: summary.planning.itemCount },
            { label: "Child items", value: summary.planning.childCount },
            { label: "Missing assignee", value: summary.planning.missingAssigneeCount },
            {
              label: "Missing budget",
              value: summary.planning.missingBudgetCount
            },
            { label: "Missing prio score", value: summary.planning.missingPrioScoreCount }
          ]}
          title="Planning"
        />
        <VerificationSection
          counts={[
            { label: "By row type", items: summary.daily.byRowType },
            { label: "By status", items: summary.daily.byStatus }
          ]}
          metrics={[
            { label: "Rows", value: summary.daily.rowCount },
            { label: "Cards", value: summary.daily.cardCount },
            { label: "Story rows", value: summary.daily.storyRowCount },
            {
              label: "Story rows without direct cards",
              value: summary.daily.storyRowsWithoutCards
            },
            { label: "Missing assignee", value: summary.daily.missingAssigneeCount },
            { label: "Missing prio score", value: summary.daily.missingPrioScoreCount }
          ]}
          title="Daily"
        />
      </div>
    </div>
  );
}
