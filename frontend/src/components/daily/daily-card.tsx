import type { DailyCard as DailyCardModel } from "@custom-clickup/shared";
import {
  getAssigneeClassName,
  getAssigneeDisplayName,
  getAssigneeInitials
} from "../../lib/assignee";

interface DailyCardProps {
  card: DailyCardModel;
}

export function DailyCard({ card }: DailyCardProps) {
  const assigneeLabel = getAssigneeDisplayName(card.assignee);
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
