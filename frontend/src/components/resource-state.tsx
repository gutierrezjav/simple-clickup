interface ResourceStateProps {
  actionLabel?: string;
  disabled?: boolean;
  message: string;
  onAction?: () => void;
  title: string;
  tone?: "info" | "warning" | "error";
}

export function ResourceState({
  actionLabel,
  disabled = false,
  message,
  onAction,
  title,
  tone = "info"
}: ResourceStateProps) {
  return (
    <div className={`resource-state resource-state--${tone}`}>
      <strong>{title}</strong>
      <p>{message}</p>
      {actionLabel && onAction ? (
        <button
          className="toolbar-button"
          disabled={disabled}
          onClick={onAction}
          type="button"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
