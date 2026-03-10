export function getAssigneeDisplayName(assignee?: string): string {
  return assignee && assignee !== "Unassigned" ? assignee : "Unassigned";
}

export function getAssigneeInitials(assignee?: string): string {
  const displayName = getAssigneeDisplayName(assignee);

  if (displayName === "Unassigned") {
    return "";
  }

  return displayName
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function hashString(value: string): number {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash);
}

export function getAssigneeClassName(assignee?: string): string {
  const displayName = getAssigneeDisplayName(assignee);

  if (displayName === "Unassigned") {
    return "avatar-chip avatar-chip--unassigned";
  }

  const paletteIndex = hashString(displayName) % 6;
  return `avatar-chip avatar-chip--${paletteIndex}`;
}
