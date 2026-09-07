import { useEffect, useState, type ReactNode } from "react";
import { BrowserRouter, Navigate, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { ResourceState } from "./components/resource-state";
import { fetchListInfo } from "./lib/clickup-api";
import { useResourceLoader } from "./lib/use-resource-loader";
import { TopBarActionContext, type TopBarAction } from "./lib/top-bar-action";
import { DailyPage } from "./routes/daily-page";
import { PlanningPage } from "./routes/planning-page";
import { VerificationPage } from "./routes/verification-page";

function getViewTabClassName({ isActive }: { isActive: boolean }): string {
  return `view-tab${isActive ? " view-tab--active" : ""}`;
}

function AppShell({ children }: { children: ReactNode }) {
  const [topBarAction, setTopBarAction] = useState<TopBarAction | null>(null);
  const { data, refresh } = useResourceLoader(fetchListInfo);
  const listName = data?.list.name ?? "ClickUp";
  const subtitle = [data?.list.spaceName, data?.list.folderName].filter(Boolean).join(" / ");

  return (
    <TopBarActionContext.Provider value={setTopBarAction}>
      <DocumentTitleManager listName={listName} />
      <div className="app-shell">
        <div className="workspace-main">
          <header className="workspace-header">
            <div className="workspace-header__main">
              <div className="workspace-header__copy">
                {subtitle ? <div className="workspace-header__eyebrow">{subtitle}</div> : null}
                <h2>{listName}</h2>
              </div>
              {topBarAction ? (
                <div className="workspace-header__actions">
                  <button
                    className="toolbar-button"
                    disabled={topBarAction.disabled}
                    onClick={() => {
                      refresh();
                      topBarAction.onAction();
                    }}
                    type="button"
                  >
                    {topBarAction.label}
                  </button>
                </div>
              ) : null}
            </div>
            <nav className="view-tabs" aria-label="Views">
              <NavLink className={getViewTabClassName} to="/daily">
                Daily
              </NavLink>
            </nav>
          </header>
          <main className="content">{children}</main>
        </div>
      </div>
    </TopBarActionContext.Provider>
  );
}

function getDocumentTitle(pathname: string, listName: string): string {
  if (pathname.startsWith("/daily")) {
    return `${listName} | Daily`;
  }

  if (pathname.startsWith("/planning")) {
    return `${listName} | Sprint Planning`;
  }

  if (pathname.startsWith("/verify")) {
    return `${listName} | Verification`;
  }

  return listName;
}

function DocumentTitleManager({ listName }: { listName: string }) {
  const location = useLocation();

  useEffect(() => {
    document.title = getDocumentTitle(location.pathname, listName);
  }, [location.pathname, listName]);

  return null;
}

function NotFoundPage() {
  return (
    <div className="panel panel--route">
      <ResourceState
        message="This route is not available in the app."
        title="Page Not Found"
      />
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<Navigate replace to="/daily" />} />
          <Route path="/daily" element={<DailyPage />} />
          <Route path="/planning" element={<PlanningPage />} />
          <Route path="/verify" element={<VerificationPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}
