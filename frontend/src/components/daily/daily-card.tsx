import type { DailyCard as DailyCardModel } from "@custom-clickup/shared";
import {
  TaskAssigneeInline,
  TaskIdentityBlock,
  TaskPriorityLabel
} from "../task/task-primitives";

interface DailyCardProps {
  card: DailyCardModel;
}

export function DailyCard({ card }: DailyCardProps) {
  return (
    <div className="daily-card">
      <TaskIdentityBlock
        customId={card.customId}
        eyebrowEnd={<TaskPriorityLabel className="daily-card__prio" prioScore={card.prioScore} />}
        taskId={card.id}
        title={card.title}
        titleClassName="daily-card__title"
      />
      <div className="daily-card__footer">
        <TaskAssigneeInline
          assignee={card.assignee}
          avatarUrl={card.assigneeAvatarUrl}
          compact
          nameClassName="daily-card__assignee"
        />
      </div>
    </div>
  );
}
