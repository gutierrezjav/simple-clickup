import type { ReactNode } from "react";
import { getAssigneeDisplayName } from "../../lib/assignee";
import { getClickUpTaskUrl } from "../../lib/clickup-task-url";
import { AssigneeAvatar } from "../assignee-avatar";

function joinClassNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

interface TaskTitleLinkProps {
  taskId: string;
  title: string;
  className?: string;
}

export function TaskTitleLink({ taskId, title, className }: TaskTitleLinkProps) {
  return (
    <a
      className={joinClassNames("task-link", className)}
      href={getClickUpTaskUrl(taskId)}
      rel="noreferrer"
      target="_blank"
    >
      {title}
    </a>
  );
}

interface TaskIdentityBlockProps {
  taskId: string;
  title: string;
  customId: string;
  chips?: ReactNode;
  eyebrowEnd?: ReactNode;
  className?: string;
  titleClassName?: string;
}

export function TaskIdentityBlock({
  taskId,
  title,
  customId,
  chips,
  eyebrowEnd,
  className,
  titleClassName
}: TaskIdentityBlockProps) {
  return (
    <div className={joinClassNames("task-identity", className)}>
      {chips ? <div className="task-identity__chips">{chips}</div> : null}
      <div className="task-identity__eyebrow">
        <span className="task-identity__id">{customId}</span>
        {eyebrowEnd ? <span className="task-identity__eyebrow-side">{eyebrowEnd}</span> : null}
      </div>
      <div className={joinClassNames("task-identity__title", titleClassName)}>
        <TaskTitleLink taskId={taskId} title={title} />
      </div>
    </div>
  );
}

interface TaskPriorityLabelProps {
  prioScore?: number | undefined;
  className?: string;
}

export function TaskPriorityLabel({ prioScore, className }: TaskPriorityLabelProps) {
  return (
    <span className={joinClassNames("task-priority", className)}>
      Prio {prioScore ?? "—"}
    </span>
  );
}

interface TaskAssigneeInlineProps {
  assignee: string | undefined;
  avatarUrl: string | undefined;
  className?: string;
  nameClassName?: string;
  compact?: boolean;
}

export function TaskAssigneeInline({
  assignee,
  avatarUrl,
  className,
  nameClassName,
  compact = false
}: TaskAssigneeInlineProps) {
  return (
    <span className={joinClassNames("task-assignee", compact && "task-assignee--compact", className)}>
      <AssigneeAvatar assignee={assignee} avatarUrl={avatarUrl} />
      <span className={joinClassNames("task-assignee__name", nameClassName)}>
        {getAssigneeDisplayName(assignee)}
      </span>
    </span>
  );
}
