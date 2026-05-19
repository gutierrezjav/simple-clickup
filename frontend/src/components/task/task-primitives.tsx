import {
  useEffectEvent,
  useLayoutEffect,
  useState,
  type ReactNode
} from "react";
import { getAssigneeDisplayName } from "../../lib/assignee";
import { getClickUpTaskUrl } from "../../lib/clickup-task-url";
import { AssigneeAvatar } from "../assignee-avatar";
import { useVisibleTooltip } from "../visible-tooltip";

function joinClassNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function hasTextOverflow(element: HTMLElement) {
  return element.scrollWidth > element.clientWidth || element.scrollHeight > element.clientHeight;
}

function useOverflowTooltip<T extends HTMLElement>(text: string) {
  const [isOverflowing, setIsOverflowing] = useState(false);
  const visibleTooltip = useVisibleTooltip<T>(isOverflowing ? text : undefined);

  const updateOverflow = useEffectEvent(() => {
    const element = visibleTooltip.ref.current;
    setIsOverflowing(element ? hasTextOverflow(element) : false);
  });

  useLayoutEffect(() => {
    const element = visibleTooltip.ref.current;
    if (!element) {
      return;
    }

    updateOverflow();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      updateOverflow();
    });

    resizeObserver.observe(element);

    return () => {
      resizeObserver.disconnect();
    };
  }, [text]);

  return {
    ref: visibleTooltip.ref,
    tooltip: visibleTooltip.tooltip,
    tooltipProps: visibleTooltip.tooltipProps
  };
}

interface TaskTitleLinkProps {
  taskId: string;
  title: string;
  className?: string;
}

export function TaskTitleLink({ taskId, title, className }: TaskTitleLinkProps) {
  const tooltip = useOverflowTooltip<HTMLAnchorElement>(title);

  return (
    <a
      className={joinClassNames("task-link", className)}
      href={getClickUpTaskUrl(taskId)}
      rel="noreferrer"
      target="_blank"
      ref={tooltip.ref}
      {...tooltip.tooltipProps}
    >
      {title}
      {tooltip.tooltip}
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
  const customIdTooltip = useOverflowTooltip<HTMLSpanElement>(customId);

  return (
    <div className={joinClassNames("task-identity", className)}>
      {chips ? <div className="task-identity__chips">{chips}</div> : null}
      <div className="task-identity__eyebrow">
        <span
          className="task-identity__id"
          ref={customIdTooltip.ref}
          {...customIdTooltip.tooltipProps}
        >
          {customId}
          {customIdTooltip.tooltip}
        </span>
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
  const displayName = getAssigneeDisplayName(assignee);
  const assigneeTooltip = useOverflowTooltip<HTMLSpanElement>(displayName);

  return (
    <span className={joinClassNames("task-assignee", compact && "task-assignee--compact", className)}>
      <AssigneeAvatar assignee={assignee} avatarUrl={avatarUrl} />
      <span
        className={joinClassNames("task-assignee__name", nameClassName)}
        ref={assigneeTooltip.ref}
        {...assigneeTooltip.tooltipProps}
      >
        {displayName}
        {assigneeTooltip.tooltip}
      </span>
    </span>
  );
}
