export function StorybookGatePage() {
  return (
    <div className="panel">
      <h2>Storybook Gate</h2>
      <p>
        This route documents the contract for the first review milestone: all planning and daily
        components should exist in Storybook with mock-safe data before the full app is wired to
        live reads.
      </p>
      <ul>
        <li>Planning screen story</li>
        <li>Daily screen story</li>
        <li>Inline edit mock interactions</li>
        <li>Drag-and-drop mock interactions</li>
        <li>Write mode banner and disabled/live safeguards</li>
      </ul>
    </div>
  );
}
