export function getClickUpTaskUrl(taskId: string): string {
  return `https://app.clickup.com/t/${encodeURIComponent(taskId)}`;
}
