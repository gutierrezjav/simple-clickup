import type { WriteMode } from "@custom-clickup/shared";

interface StatusBannerProps {
  writeMode: WriteMode;
}

export function StatusBanner({ writeMode }: StatusBannerProps) {
  const label =
    writeMode === "mock"
      ? "Mock writes enabled"
      : writeMode === "test-space"
        ? "Writing to allowlisted test space"
        : "Live write mode";

  return <div className="badge">{label}</div>;
}
