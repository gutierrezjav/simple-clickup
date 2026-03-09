import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import { DailyPage } from "./routes/daily-page";
import { PlanningPage } from "./routes/planning-page";
import { StorybookGatePage } from "./routes/storybook-gate-page";

export function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <aside className="sidebar">
          <h1>Custom ClickUp</h1>
          <nav>
            <Link to="/planning">Planning</Link>
            <Link to="/daily">Daily</Link>
            <Link to="/storybook-gate">Storybook Gate</Link>
          </nav>
        </aside>
        <main className="content">
          <Routes>
            <Route path="/" element={<PlanningPage />} />
            <Route path="/planning" element={<PlanningPage />} />
            <Route path="/daily" element={<DailyPage />} />
            <Route path="/storybook-gate" element={<StorybookGatePage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
