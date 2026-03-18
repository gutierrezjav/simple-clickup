import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom";
import { DailyPage } from "./routes/daily-page";
import { PlanningPage } from "./routes/planning-page";
import { VerificationPage } from "./routes/verification-page";

function getTabClassName({ isActive }: { isActive: boolean }) {
  return isActive ? "view-tab view-tab--active" : "view-tab";
}

export function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <div className="workspace-main">
          <header className="workspace-header">
            <div className="workspace-header__copy">
              <div className="workspace-header__eyebrow">R&amp;D WingtraCloud / All Tasks</div>
              <h2>Wingtra Cloud Dev</h2>
            </div>
            <div className="workspace-header__actions">
              <div className="workspace-header__search" aria-hidden="true">
                Planning + daily client
              </div>
            </div>
            <nav className="view-tabs" aria-label="Views">
              <NavLink className={getTabClassName} to="/planning">
                Planning
              </NavLink>
              <NavLink className={getTabClassName} to="/daily">
                Daily
              </NavLink>
            </nav>
          </header>
          <main className="content">
            <Routes>
              <Route path="/" element={<PlanningPage />} />
              <Route path="/planning" element={<PlanningPage />} />
              <Route path="/daily" element={<DailyPage />} />
              <Route path="/verify" element={<VerificationPage />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}
