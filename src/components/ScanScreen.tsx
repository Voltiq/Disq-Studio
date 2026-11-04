import { Square } from "lucide-react";
import { formatBytes, formatElapsed } from "../lib/format";
import type { ScanProgress, SizeMode } from "../lib/types";
import { Button } from "./ui/Button";
import { ProgressBar, Spinner } from "./ui/Feedback";

interface ScanScreenProps {
  path: string;
  progress: ScanProgress | null;
  /** Space used on the drive, when a whole drive is scanned; makes the bar real. */
  expectedBytes: number | null;
  sizeMode: SizeMode;
  onCancel: () => void;
}

export function ScanScreen({ path, progress, expectedBytes, sizeMode, onCancel }: ScanScreenProps) {
  // A drive's used space is space on disk, so measure progress the same way.
  const fraction = expectedBytes && progress ? Math.min(0.99, progress.allocated / expectedBytes) : undefined;
  const shownBytes = (sizeMode === "allocated" ? progress?.allocated : progress?.bytes) ?? 0;
  return (
    <main className="scan-screen">
      <section className="panel scan-card" aria-live="polite" style={{ padding: "var(--space-400)", gap: "var(--space-300)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-150)" }}>
          <Spinner size={20} />
          <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <span className="eyebrow">Scanning</span>
            <h1 className="panel-title" style={{ fontSize: "1.25rem" }}>
              {path}
            </h1>
          </div>
        </div>

        <ProgressBar value={fraction} indeterminate={fraction === undefined} label="Scan progress" />

        <div className="scan-stats">
          <div className="scan-stat">
            <span className="eyebrow">Files</span>
            <span className="value">{(progress?.files ?? 0).toLocaleString()}</span>
          </div>
          <div className="scan-stat">
            <span className="eyebrow">Folders</span>
            <span className="value">{(progress?.dirs ?? 0).toLocaleString()}</span>
          </div>
          <div className="scan-stat">
            <span className="eyebrow">{sizeMode === "allocated" ? "On disk" : "Size"}</span>
            <span className="value">{formatBytes(shownBytes)}</span>
          </div>
        </div>

        <p className="scan-current" title={progress?.current}>
          {"‎" + (progress?.current || "Starting…")}
        </p>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span className="hud-stat">
            {formatElapsed(progress?.elapsedMs ?? 0)}
            {fraction !== undefined && ` · ${Math.floor(fraction * 100)}%`}
            {!!progress?.errors && ` · ${progress.errors.toLocaleString()} folders skipped`}
          </span>
          <Button iconBefore={Square} onClick={onCancel} shortcut="Esc">
            Cancel
          </Button>
        </div>
      </section>
    </main>
  );
}
