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

  return (
    <div className="status-banner">
      {readMode ? (
        <div className="badge">{readMode === "live" ? "Live reads" : "Mock reads"}</div>
      ) : null}
      <div className="badge">{label}</div>
    </div>
  );
}
