import type { ReadMode } from "../lib/clickup-api";

interface StatusBannerProps {
  readMode: ReadMode;
}

export function StatusBanner({ readMode }: StatusBannerProps) {
  return (
    <div className="status-banner">
      <div
        className={`status-banner__item ${
          readMode === "live" ? "status-banner__item--live" : "status-banner__item--mock"
        }`}
      >
        {readMode === "live" ? "Live reads" : "Mock reads"}
      </div>
    </div>
  );
}
