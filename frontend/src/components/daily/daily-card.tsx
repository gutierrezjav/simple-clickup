import type { DailyCard as DailyCardModel } from "@custom-clickup/shared";
import { AssigneeAvatar } from "../assignee-avatar";
import { getAssigneeDisplayName } from "../../lib/assignee";
import { getClickUpTaskUrl } from "../../lib/clickup-task-url";

interface DailyCardProps {
  card: DailyCardModel;
}

export function DailyCard({ card }: DailyCardProps) {
  const assigneeLabel = getAssigneeDisplayName(card.assignee);

  return (
    <div className="daily-card">
      <div className="daily-card__eyebrow">
        <span className="daily-card__id">{card.customId}</span>
        <span className="daily-card__prio">Prio {card.prioScore ?? "—"}</span>
      </div>
      <div className="daily-card__title">
        <a
          className="task-link"
          href={getClickUpTaskUrl(card.id)}
          rel="noreferrer"
          target="_blank"
        >
          {card.title}
        </a>
      </div>
      <div className="daily-card__footer">
        <AssigneeAvatar assignee={card.assignee} avatarUrl={card.assigneeAvatarUrl} />
        <span className="daily-card__assignee">{assigneeLabel}</span>
      </div>
    </div>
  );
}
