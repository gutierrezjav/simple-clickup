import { Fragment } from "react";
import { dailyFixtures, dailyStatuses } from "@custom-clickup/shared";
import { DailyCard } from "../components/daily/daily-card";
import { StatusBanner } from "../components/status-banner";

export function DailyPage() {
  return (
    <div className="panel">
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h2>Daily</h2>
          <p>Mock-safe daily board scaffold with story rows and fixed status columns.</p>
        </div>
        <StatusBanner writeMode="mock" />
      </div>
      <div className="daily-grid">
        <div />
        {dailyStatuses.map((status) => (
          <div className="daily-column-header" key={status}>
            {status}
          </div>
        ))}
        {dailyFixtures.map((row) => (
          <Fragment key={row.id}>
            <div className="daily-row-title" key={`${row.id}-title`}>
              {row.title}
            </div>
            {dailyStatuses.map((status) => (
              <div className="daily-column" key={`${row.id}-${status}`}>
                {row.cards
                  .filter((card) => card.status === status)
                  .map((card) => (
                    <DailyCard card={card} key={card.id} />
                ))}
              </div>
            ))}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
