export function StorybookGatePage() {
  return (
    <div className="panel panel--route">
      <div className="panel-header">
        <div className="panel-header-copy">
          <div className="panel-eyebrow">Review milestone</div>
          <h2>Storybook Gate</h2>
          <p>
            Keep the planning and daily UI reviewable in Storybook with mock-safe data before the
            rest of the interaction work resumes.
          </p>
        </div>
      </div>
      <div className="gate-grid">
        <div className="gate-card">
          <span className="pill pill--kind pill--story">Shell</span>
          <strong>Workspace chrome</strong>
          <p>Sidebar, header tabs, and route-level state surfaces should be reviewable here.</p>
        </div>
        <div className="gate-card">
          <span className="pill pill--kind pill--standalone-task">Planning</span>
          <strong>List density</strong>
          <p>Rows, nested subtasks, and mock-safe edit affordances should match the app contract.</p>
        </div>
        <div className="gate-card">
          <span className="pill pill--kind pill--standalone-bug">Daily</span>
          <strong>Board density</strong>
          <p>Columns, cards, and drag/drop placeholders should stay consistent with app routes.</p>
        </div>
      </div>
    </div>
  );
}
