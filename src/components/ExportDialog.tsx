import { useEffect, useRef, useState } from "react";
import { save as pickSaveFile } from "@tauri-apps/plugin-dialog";
import { Download, X } from "lucide-react";
import { api, errorText } from "../lib/api";
import { plural } from "../lib/format";
import type { ExportFormat, ExportOptions } from "../lib/types";
import { cx } from "../lib/utils";
import { Button, IconButton } from "./ui/Button";

interface ExportDialogProps {
  folderId: number;
  folderName: string;
  /** A filter is on: the export counts matching files only. */
  filterOn: boolean;
  onDone: (path: string, rows: number) => void;
  onClose: () => void;
}

const FORMATS: { value: ExportFormat; label: string; hint: string; ext: string }[] = [
  { value: "html", label: "Web page", hint: "A report to read or share: totals, contents with bars, file types, largest files.", ext: "html" },
  { value: "csv", label: "CSV", hint: "One row per item, for Excel or another spreadsheet.", ext: "csv" },
  { value: "json", label: "JSON", hint: "One object per item, for scripts and other tools.", ext: "json" },
];

const DEPTHS = [
  { value: 1, label: "1 level" },
  { value: 2, label: "2 levels" },
  { value: 3, label: "3 levels" },
  { value: 0, label: "Everything" },
];

const MIN_SIZES = [
  { value: 0, label: "Any size" },
  { value: 1024 ** 2, label: "1 MB or more" },
  { value: 100 * 1024 ** 2, label: "100 MB or more" },
  { value: 1024 ** 3, label: "1 GB or more" },
];

/** Writes a report of the folder in view. */
export function ExportDialog({ folderId, folderName, filterOn, onDone, onClose }: ExportDialogProps) {
  const exportRef = useRef<HTMLButtonElement>(null);
  const [options, setOptions] = useState<ExportOptions>({ format: "html", maxDepth: 2, minSize: 1024 ** 2, includeFiles: true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<ExportOptions>) => setOptions((o) => ({ ...o, ...patch }));
  const format = FORMATS.find((f) => f.value === options.format)!;

  useEffect(() => {
    exportRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  async function run() {
    const base = folderName.replace(/[\\/:*?"<>|]+/g, " ").trim() || "Disk";
    const path = await pickSaveFile({
      title: "Export a report",
      defaultPath: `${base} - Disq Studio report.${format.ext}`,
      filters: [{ name: format.label, extensions: [format.ext] }],
    });
    if (!path) return;
    setBusy(true);
    setError(null);
    try {
      const rows = await api.exportReport(folderId, path, options);
      onDone(path, rows);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="blanket" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-medium settings" role="dialog" aria-modal="true" aria-labelledby="export-title">
        <div className="modal-header">
          <h2 className="modal-title" id="export-title">
            Export {folderName}
          </h2>
          <IconButton icon={X} label="Close" onClick={onClose} />
        </div>
        <div className="modal-body">
          <div className="settings-row">
            <span className="settings-label">
              Format
              <span className="settings-hint">{format.hint}</span>
            </span>
            <div className="segmented" role="radiogroup" aria-label="Format">
              {FORMATS.map((f) => (
                <button
                  key={f.value}
                  className={cx("segment", options.format === f.value && "is-selected")}
                  role="radio"
                  aria-checked={options.format === f.value}
                  onClick={() => set({ format: f.value })}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div className="settings-row">
            <span className="settings-label">
              How deep
              <span className="settings-hint">Levels of folders below {folderName}.</span>
            </span>
            <div className="segmented" role="radiogroup" aria-label="How deep">
              {DEPTHS.map((d) => (
                <button
                  key={d.value}
                  className={cx("segment", options.maxDepth === d.value && "is-selected")}
                  role="radio"
                  aria-checked={options.maxDepth === d.value}
                  onClick={() => set({ maxDepth: d.value })}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          <div className="settings-row">
            <span className="settings-label">Leave out items smaller than</span>
            <select className="filter-select" aria-label="Leave out items smaller than" value={options.minSize} onChange={(e) => set({ minSize: Number(e.target.value) })}>
              {MIN_SIZES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <label className="settings-row settings-check">
            <span className="settings-label">
              Include files
              <span className="settings-hint">Off: folders only.</span>
            </span>
            <input type="checkbox" checked={options.includeFiles} onChange={(e) => set({ includeFiles: e.target.checked })} />
          </label>
          {options.maxDepth === 0 && options.minSize === 0 && options.includeFiles && (
            <p className="settings-hint">Every item, of any size: for a whole drive that's a file with millions of rows.</p>
          )}
          {filterOn && <p className="settings-hint">A filter is on, so only matching files are counted, as on screen.</p>}
          {error && <p className="settings-hint settings-warning">{error}</p>}
        </div>
        <div className="modal-footer">
          <Button appearance="subtle" onClick={onClose}>
            Cancel
          </Button>
          <Button ref={exportRef} appearance="primary" iconBefore={Download} loading={busy} onClick={run}>
            Export…
          </Button>
        </div>
      </div>
    </div>
  );
}

export function exportedText(rows: number): string {
  return plural(rows, "row", "rows");
}
