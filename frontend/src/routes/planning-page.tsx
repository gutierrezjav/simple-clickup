import { planningFixtures } from "@custom-clickup/shared";
import { PlanningRow } from "../components/planning/planning-row";
import { StatusBanner } from "../components/status-banner";

export function PlanningPage() {
  return (
    <div className="panel">
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h2>Planning</h2>
          <p>Storybook-first planning list scaffold with mock-safe data.</p>
        </div>
        <StatusBanner writeMode="mock" />
      </div>
      <div style={{ display: "grid", gap: 12 }}>
        {planningFixtures.map((item, index) => (
          <PlanningRow key={item.id} item={item} expanded={index === 0} />
        ))}
      </div>
    </div>
  );
}
