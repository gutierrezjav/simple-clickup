import type { DailyCard as DailyCardModel } from "@custom-clickup/shared";

interface DailyCardProps {
  card: DailyCardModel;
}

function getAssigneeInitials(assignee?: string) {
  if (!assignee || assignee === "Unassigned") {
    return "";
  }

  return assignee
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getAssigneeClassName(assignee?: string) {
  if (!assignee || assignee === "Unassigned") {
    return "avatar-chip avatar-chip--unassigned";
  }

  const paletteIndex = hashString(assignee) % 6;
  return `avatar-chip avatar-chip--${paletteIndex}`;
}

export function DailyCard({ card }: DailyCardProps) {
  const assigneeLabel =
    card.assignee && card.assignee !== "Unassigned" ? card.assignee : "—";
  const assigneeInitials = getAssigneeInitials(card.assignee);

  return (
    <div className="daily-card">
      <div className="daily-card__eyebrow">
        <span className="daily-card__id">{card.customId}</span>
        <span className="daily-card__prio">Prio {card.prioScore ?? "—"}</span>
      </div>
      <div className="daily-card__title">{card.title}</div>
      <div className="daily-card__footer">
        <span className={getAssigneeClassName(card.assignee)}>
          {assigneeInitials || " "}
        </span>
        <span className="daily-card__assignee">{assigneeLabel}</span>
      </div>
    </div>
  );
}
