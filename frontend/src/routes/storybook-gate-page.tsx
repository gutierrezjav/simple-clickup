export function StorybookGatePage() {
  return (
    <div className="panel panel--route">
      <div className="panel-header">
        <div className="panel-header-copy">
          <div className="panel-eyebrow">Review milestone</div>
          <h2>Storybook Gate</h2>
          <p>Keep the daily UI reviewable in Storybook with mock-safe data.</p>
        </div>
      </div>
      <div className="gate-grid">
        <div className="gate-card">
          <span className="pill pill--kind pill--story">Shell</span>
          <strong>Workspace chrome</strong>
          <p>Header chrome and route-level state surfaces should be reviewable here.</p>
        </div>
        <div className="gate-card">
          <span className="pill pill--kind pill--standalone-bug">Daily</span>
          <strong>Board density</strong>
          <p>Columns, cards, and drag/drop placeholders should stay consistent with app routes.</p>
        </div>
        <div className="gate-card">
          <span className="pill pill--kind pill--standalone-task">Verify</span>
          <strong>Snapshot checks</strong>
          <p>Daily-only verification surfaces should stay aligned with the backend summary.</p>
        </div>
      </div>
    </div>
  );
}
