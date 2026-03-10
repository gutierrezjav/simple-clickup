import type { PlanningItem } from "@custom-clickup/shared";

interface PlanningRowProps {
  item: PlanningItem;
  expanded?: boolean;
  onToggle?: () => void;
}

function formatKindLabel(kind: PlanningItem["kind"]) {
  switch (kind) {
    case "story":
      return "Story";
    case "standalone-task":
      return "Task";
    case "standalone-bug":
      return "Bug";
    case "subtask":
      return "Subtask";
    default:
      return kind;
  }
}

export function PlanningRow({ item, expanded = false, onToggle }: PlanningRowProps) {
  const isExpandable = Boolean(item.children?.length);

  return (
    <div className="planning-row">
      <div className="planning-row__layout">
        <div className="planning-row__summary">
          {isExpandable ? (
            <button
              aria-expanded={expanded}
              className={`planning-row__toggle ${expanded ? "planning-row__toggle--open" : ""}`}
              onClick={() => onToggle?.()}
              type="button"
            >
              ▸
            </button>
          ) : (
            <span className="planning-row__toggle planning-row__toggle--placeholder" aria-hidden="true" />
          )}
          <div className="planning-row__content">
            <div className="planning-row__chips">
              <span className={`pill pill--kind pill--${item.kind}`}>{formatKindLabel(item.kind)}</span>
              <span className="pill pill--status">{item.status}</span>
            </div>
            <h3 className="planning-row__title">{item.title}</h3>
            <div className="planning-row__meta">{item.customId}</div>
          </div>
        </div>
        <dl className="planning-row__stats">
          <div>
            <dt>Assignee</dt>
            <dd>{item.assignee ?? "—"}</dd>
          </div>
          <div>
            <dt>Priority</dt>
            <dd>{item.prioScore ?? "—"}</dd>
          </div>
        </dl>
      </div>
      {expanded && isExpandable ? (
        <div className="planning-children">
          {(item.children ?? []).map((child) => (
            <div className="planning-child-row" key={child.id}>
              <div className="planning-child-row__main">
                <span className={`pill pill--kind pill--${child.kind}`}>
                  {formatKindLabel(child.kind)}
                </span>
                <div className="planning-child-row__copy">
                  <strong>{child.title}</strong>
                  <div>
                    {child.customId} · {child.status}
                  </div>
                </div>
              </div>
              <div className="planning-child-row__meta">
                <span>{child.assignee ?? "—"}</span>
                <span>{child.prioScore ?? "—"}</span>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
