import type { PlanningItem } from "@custom-clickup/shared";

interface PlanningRowProps {
  item: PlanningItem;
  expanded?: boolean;
}

export function PlanningRow({ item, expanded = false }: PlanningRowProps) {
  return (
    <div className="planning-row">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div className="badge">{item.kind}</div>
          <h3>{item.title}</h3>
          <p>
            {item.customId} · {item.status}
          </p>
        </div>
        <div>
          <div>Prio: {item.prioScore ?? "—"}</div>
          <div>Assignee: {item.assignee ?? "—"}</div>
          <div>Bucket: {item.planningBucket ?? "—"}</div>
        </div>
      </div>
      {expanded && item.children?.length ? (
        <div className="planning-children">
          {item.children.map((child) => (
            <div className="planning-row" key={child.id}>
              <strong>{child.title}</strong>
              <div>
                {child.customId} · {child.status} · {child.prioScore ?? "—"}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
