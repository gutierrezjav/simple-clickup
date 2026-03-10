import type { WriteMode } from "@custom-clickup/shared";
import type { ReadMode } from "../lib/clickup-api";

interface StatusBannerProps {
  readMode?: ReadMode;
  writeMode: WriteMode;
}

export function StatusBanner({ readMode, writeMode }: StatusBannerProps) {
  const label =
    writeMode === "mock"
      ? "Mock writes enabled"
      : writeMode === "test-space"
        ? "Writing to allowlisted test space"
        : "Live write mode";

  const writeTone =
    writeMode === "mock"
      ? "status-banner__item status-banner__item--mock"
      : writeMode === "test-space"
        ? "status-banner__item status-banner__item--test"
        : "status-banner__item status-banner__item--live";

  return (
    <div className="status-banner">
      {readMode ? (
        <div
          className={`status-banner__item ${
            readMode === "live" ? "status-banner__item--live" : "status-banner__item--mock"
          }`}
        >
          {readMode === "live" ? "Live reads" : "Mock reads"}
        </div>
      ) : null}
      <div className={writeTone}>{label}</div>
    </div>
  );
}
