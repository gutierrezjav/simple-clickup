import { useState, type ReactNode } from "react";
import { BrowserRouter, Navigate, NavLink, Route, Routes } from "react-router-dom";
import { TopBarActionContext, type TopBarAction } from "./lib/top-bar-action";
import { DailyPage } from "./routes/daily-page";
import { PlanningPage } from "./routes/planning-page";
import { VerificationPage } from "./routes/verification-page";

function getTabClassName({ isActive }: { isActive: boolean }) {
  return isActive ? "view-tab view-tab--active" : "view-tab";
}

function AppShell({ children }: { children: ReactNode }) {
  const [topBarAction, setTopBarAction] = useState<TopBarAction | null>(null);

  return (
    <TopBarActionContext.Provider value={setTopBarAction}>
      <div className="app-shell">
        <div className="workspace-main">
          <header className="workspace-header">
            <div className="workspace-header__main">
              <div className="workspace-header__copy">
                <div className="workspace-header__eyebrow">R&amp;D WingtraCloud / All Tasks</div>
                <h2>Wingtra Cloud Dev</h2>
              </div>
              <nav className="view-tabs" aria-label="Views">
                <NavLink className={getTabClassName} to="/daily">
                  Daily
                </NavLink>
                <NavLink className={getTabClassName} to="/planning">
                  Planning
                </NavLink>
              </nav>
              {topBarAction ? (
                <div className="workspace-header__actions">
                  <button
                    className="toolbar-button"
                    disabled={topBarAction.disabled}
                    onClick={topBarAction.onAction}
                    type="button"
                  >
                    {topBarAction.label}
                  </button>
                </div>
              ) : null}
            </div>
          </header>
          <main className="content">{children}</main>
        </div>
      </div>
    </TopBarActionContext.Provider>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<Navigate replace to="/daily" />} />
          <Route path="/planning" element={<PlanningPage />} />
          <Route path="/daily" element={<DailyPage />} />
          <Route path="/verify" element={<VerificationPage />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}
