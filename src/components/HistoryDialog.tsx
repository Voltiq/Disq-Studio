import { useCallback, useEffect, useRef, useState } from "react";
import { save as pickSaveFile, open as pickFile } from "@tauri-apps/plugin-dialog";
import { ArrowLeftRight, FolderOpen, FolderSearch, History, Save, Trash2, X } from "lucide-react";
import { api, errorText } from "../lib/api";
import { formatBytes, formatChange, formatDateTime, plural } from "../lib/format";
import type { SavedSnapshot } from "../lib/types";
import { Button, IconButton } from "./ui/Button";
import { EmptyState, Spinner } from "./ui/Feedback";
import { t } from "../lib/i18n";

interface HistoryDialogProps {
  /** The location in view, or null on the home screen. */
  scanPath: string | null;
  /** On disk now, to show each snapshot's change against. */
  allocatedNow: number | null;
  /** The scan in view was opened from a snapshot (can't be saved into the history again). */
  viewingSnapshot: boolean;
  onCompare: (path: string) => void;
  onOpen: (path: string) => void;
  onReveal: (path: string) => void;
  onError: (message: string) => void;
  onClose: () => void;
}

const SNAPSHOT_FILTER = [{ name: "Disq Studio snapshot", extensions: ["dss"] }];

/** Earlier scans of this location, kept as snapshots: compare with one, open one, or save another. */
export function HistoryDialog({
  scanPath,
  allocatedNow,
  viewingSnapshot,
  onCompare,
  onOpen,
  onReveal,
  onError,
  onClose,
}: HistoryDialogProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [list, setList] = useState<SavedSnapshot[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [showAll, setShowAll] = useState(!scanPath);

  const load = useCallback(() => {
    setList(null);
    api
      .listSnapshots(showAll ? null : scanPath)
      .then(setList)
      .catch((e) => onError(errorText(e)));
  }, [scanPath, showAll, onError]);

  useEffect(load, [load]);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  async function saveNow(toFile: boolean) {
    let path: string | null = null;
    if (toFile) {
      const picked = await pickSaveFile({ title: t("Save this scan as a snapshot"), filters: SNAPSHOT_FILTER, defaultPath: t("Disq Studio snapshot.dss") });
      if (!picked) return;
      path = picked;
    }
    setBusy(true);
    try {
      await api.saveSnapshot(path);
      if (!toFile) load();
    } catch (e) {
      onError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function openFile(compare: boolean) {
    const picked = await pickFile({ title: compare ? t("Compare with a snapshot") : t("Open a snapshot"), filters: SNAPSHOT_FILTER, multiple: false });
    if (typeof picked !== "string") return;
    if (compare) onCompare(picked);
    else onOpen(picked);
  }

  async function remove(s: SavedSnapshot) {
    try {
      await api.deleteSnapshot(s.path);
      setList((l) => l && l.filter((x) => x.path !== s.path));
    } catch (e) {
      onError(errorText(e));
    }
  }

  const total = list?.reduce((sum, s) => sum + s.bytes, 0) ?? 0;

  return (
    <div className="blanket" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-large history" role="dialog" aria-modal="true" aria-labelledby="history-title">
        <div className="modal-header">
          <h2 className="modal-title" id="history-title">
            {t("History")}{scanPath && !showAll ? t(" of {0}", scanPath) : ""}
          </h2>
          <IconButton ref={closeRef} icon={X} label={t("Close")} onClick={onClose} />
        </div>
        <div className="modal-body">
          <p className="dialog-text">
            {t("Each finished scan is kept as a snapshot (the newest 8 of each location), so you can see what changed since. Compare one with the scan in view, or open it to look around as it was.")}
          </p>
          {scanPath && (
            <label className="history-all">
              <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
              {t("Show snapshots of every location")}
            </label>
          )}
          {!list ? (
            <Spinner size={18} label={t("Reading the history")} />
          ) : list.length === 0 ? (
            <EmptyState icon={History} title={t("No snapshots yet")} compact>
              {scanPath ? t("Save one now, or it'll be saved after the next scan.") : t("Scan a drive or folder to start the history.")}
            </EmptyState>
          ) : (
            <ul className="history-list">
              {list.map((s) => {
                const sameRoot = !!scanPath && s.root.toLowerCase().replace(/\\+$/, "") === scanPath.toLowerCase().replace(/\\+$/, "");
                return (
                  <li key={s.path} className="history-item">
                    <div className="history-text">
                      <span className="history-date">{formatDateTime(s.scannedAt)}</span>
                      <span className="hud-stat">
                        {showAll && `${s.root} · `}
                        {t("{0} on disk · {1}", formatBytes(s.allocated), plural(s.files, "file", "files"))}
                        {sameRoot && allocatedNow != null && t(" · {0} since", formatChange(allocatedNow - s.allocated))}
                      </span>
                    </div>
                    <span className="hud-stat mono">{formatBytes(s.bytes)}</span>
                    <div className="history-actions">
                      {sameRoot && (
                        <Button spacing="compact" iconBefore={ArrowLeftRight} onClick={() => onCompare(s.path)}>
                          {t("Compare")}
                        </Button>
                      )}
                      <Button spacing="compact" appearance="subtle" iconBefore={FolderOpen} onClick={() => onOpen(s.path)}>
                        {t("Open")}
                      </Button>
                      <IconButton icon={Trash2} label={t("Delete this snapshot")} spacing="compact" onClick={() => remove(s)} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {!!list?.length && <p className="hud-stat">{t("{0} of snapshots.", formatBytes(total))}</p>}
        </div>
        <div className="modal-footer">
          <Button
            appearance="subtle"
            className="footer-plain"
            iconBefore={FolderSearch}
            onClick={() => api.snapshotsFolder().then(onReveal).catch((e) => onError(errorText(e)))}
          >
            {t("Show folder")}
          </Button>
          <Button appearance="subtle" iconBefore={FolderOpen} onClick={() => openFile(false)}>
            {t("Open a file…")}
          </Button>
          {scanPath && (
            <Button appearance="subtle" iconBefore={ArrowLeftRight} onClick={() => openFile(true)}>
              {t("Compare with a file…")}
            </Button>
          )}
          {scanPath && (
            <Button appearance="subtle" iconBefore={Save} disabled={busy} onClick={() => saveNow(true)}>
              {t("Save as…")}
            </Button>
          )}
          {scanPath && !viewingSnapshot && (
            <Button appearance="primary" iconBefore={Save} loading={busy} onClick={() => saveNow(false)}>
              {t("Save snapshot now")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
