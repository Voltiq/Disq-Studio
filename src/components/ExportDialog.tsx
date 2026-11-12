import { useEffect, useRef, useState } from "react";
import { save as pickSaveFile } from "@tauri-apps/plugin-dialog";
import { Download, X } from "lucide-react";
import { api, errorText } from "../lib/api";
import { plural } from "../lib/format";
import type { ExportFormat, ExportOptions } from "../lib/types";
import { cx } from "../lib/utils";
import { Button, IconButton } from "./ui/Button";
import { Select } from "./ui/Select";
import { t } from "../lib/i18n";

interface ExportDialogProps {
  folderId: number;
  folderName: string;
  /** A filter is on: the export counts matching files only. */
  filterOn: boolean;
  onDone: (path: string, rows: number) => void;
  onClose: () => void;
}

const FORMATS: { value: ExportFormat; label: string; hint: string; ext: string }[] = [
  { value: "html", label: t("Web page"), hint: t("A report to read or share: totals, contents with bars, file types, largest files."), ext: "html" },
  { value: "csv", label: "CSV", hint: t("One row per item, for Excel or another spreadsheet."), ext: "csv" },
  { value: "json", label: "JSON", hint: t("One object per item, for scripts and other tools."), ext: "json" },
];

const DEPTHS = [
  { value: 1, label: t("1 level") },
  { value: 2, label: t("2 levels") },
  { value: 3, label: t("3 levels") },
  { value: 0, label: t("Everything") },
];

const MIN_SIZES = [
  { value: 0, label: t("Any size") },
  { value: 1024 ** 2, label: t("1 MB or more") },
  { value: 100 * 1024 ** 2, label: t("100 MB or more") },
  { value: 1024 ** 3, label: t("1 GB or more") },
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
    const base = folderName.replace(/[\\/:*?"<>|]+/g, " ").trim() || t("Disk");
    const path = await pickSaveFile({
      title: t("Export a report"),
      defaultPath: t("{0} - Disq Studio report.{1}", base, format.ext),
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
            {t("Export")}{" "}{folderName}
          </h2>
          <IconButton icon={X} label={t("Close")} onClick={onClose} />
        </div>
        <div className="modal-body">
          <div className="settings-row">
            <span className="settings-label">
              {t("Format")}
              <span className="settings-hint">{format.hint}</span>
            </span>
            <div className="segmented" role="radiogroup" aria-label={t("Format")}>
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
              {t("How deep")}
              <span className="settings-hint">{t("Levels of folders below {0}.", folderName)}</span>
            </span>
            <div className="segmented" role="radiogroup" aria-label={t("How deep")}>
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
            <span className="settings-label">{t("Leave out items smaller than")}</span>
            <Select label={t("Leave out items smaller than")} value={options.minSize} options={MIN_SIZES} onChange={(minSize) => set({ minSize })} />
          </div>
          <label className="settings-row settings-check">
            <span className="settings-label">
              {t("Include files")}
              <span className="settings-hint">{t("Off: folders only.")}</span>
            </span>
            <input type="checkbox" checked={options.includeFiles} onChange={(e) => set({ includeFiles: e.target.checked })} />
          </label>
          {options.maxDepth === 0 && options.minSize === 0 && options.includeFiles && (
            <p className="settings-hint">{t("Every item, of any size: for a whole drive that's a file with millions of rows.")}</p>
          )}
          {filterOn && <p className="settings-hint">{t("A filter is on, so only matching files are counted, as on screen.")}</p>}
          {error && <p className="settings-hint settings-warning">{error}</p>}
        </div>
        <div className="modal-footer">
          <Button appearance="subtle" onClick={onClose}>
            {t("Cancel")}
          </Button>
          <Button ref={exportRef} appearance="primary" iconBefore={Download} loading={busy} onClick={run}>
            {t("Export…")}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function exportedText(rows: number): string {
  return plural(rows, "row", "rows");
}
