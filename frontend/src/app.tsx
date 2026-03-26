import { useEffect, useState, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { ResourceState } from "./components/resource-state";
import { TopBarActionContext, type TopBarAction } from "./lib/top-bar-action";
import { DailyPage } from "./routes/daily-page";
import { VerificationPage } from "./routes/verification-page";

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

function getDocumentTitle(pathname: string): string {
  if (pathname.startsWith("/daily")) {
    return "Simple Clickup | Daily";
  }

  if (pathname.startsWith("/verify")) {
    return "Simple Clickup | Verification";
  }

  return "Simple Clickup";
}

function DocumentTitleManager() {
  const location = useLocation();

  useEffect(() => {
    document.title = getDocumentTitle(location.pathname);
  }, [location.pathname]);

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
      <DocumentTitleManager />
      <AppShell>
        <Routes>
          <Route path="/" element={<Navigate replace to="/daily" />} />
          <Route path="/daily" element={<DailyPage />} />
          <Route path="/verify" element={<VerificationPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}
