interface ResourceStateProps {
  actionLabel?: string;
  disabled?: boolean;
  isLoading?: boolean;
  message: string;
  onAction?: () => void;
  title: string;
  tone?: "info" | "warning" | "error";
}

export function ResourceState({
  actionLabel,
  disabled = false,
  isLoading = false,
  message,
  onAction,
  title,
  tone = "info"
}: ResourceStateProps) {
  return (
    <div className={`resource-state resource-state--${tone}`}>
      <div className="resource-state__copy">
        <strong>{title}</strong>
        <p>{message}</p>
      </div>
      {isLoading ? (
        <div className="resource-state__spinner" aria-hidden="true" />
      ) : actionLabel && onAction ? (
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
