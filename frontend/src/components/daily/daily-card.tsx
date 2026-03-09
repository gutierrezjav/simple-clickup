import type { DailyCard as DailyCardModel } from "@custom-clickup/shared";

interface DailyCardProps {
  card: DailyCardModel;
}

export function DailyCard({ card }: DailyCardProps) {
  return (
    <div className="daily-card">
      <strong>{card.title}</strong>
      <div>{card.customId}</div>
      <div>{card.assignee ?? "Unassigned"}</div>
    </div>
  );
}
