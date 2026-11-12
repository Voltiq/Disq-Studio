import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftRight, ChevronRight, FolderSearch, X } from "lucide-react";
import { api, errorText } from "../lib/api";
import { formatBytes, formatChange, formatDateTime } from "../lib/format";
import { EntryIcon } from "../lib/icons";
import type { CompareSummary, CompareTop, DiffEntry, SizeMode } from "../lib/types";
import { cx } from "../lib/utils";
import { Button, IconButton } from "./ui/Button";
import { EmptyState, Spinner } from "./ui/Feedback";
import { t, locale } from "../lib/i18n";

interface ChangesProps {
  summary: CompareSummary;
  sizeMode: SizeMode;
  /** Changes when the scan in view does (a refresh, a delete), so lists reload. */
  version: number;
  onReveal: (path: string) => void;
  /** Shows an item of the scan in view on the map. */
  onShow: (id: number) => void;
  onClose: () => void;
  onError: (message: string) => void;
}

type Tab = "folders" | "grew" | "shrank" | "added" | "removed";

const TABS: { key: Tab; label: string }[] = [
  { key: "folders", label: t("Folder by folder") },
  { key: "grew", label: t("Grew") },
  { key: "shrank", label: t("Shrank") },
  { key: "added", label: t("New") },
  { key: "removed", label: t("Gone") },
];

function change(e: DiffEntry): number {
  return (e.now ?? 0) - (e.before ?? 0);
}

/** What changed between a snapshot and the scan in view. */
export function Changes({ summary, sizeMode, version, onReveal, onShow, onClose, onError }: ChangesProps) {
  const [tab, setTab] = useState<Tab>("folders");
  const [trail, setTrail] = useState<{ id: number; name: string }[]>([{ id: 0, name: summary.meta.root }]);
  const [rows, setRows] = useState<DiffEntry[] | null>(null);
  const [top, setTop] = useState<CompareTop | null>(null);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const folder = trail[trail.length - 1];

  useEffect(() => {
    let stale = false;
    setRows(null);
    api
      .compareChildren(folder.id)
      .then((r) => !stale && setRows(r))
      .catch((e) => !stale && onErrorRef.current(errorText(e)));
    return () => {
      stale = true;
    };
  }, [folder.id, version, sizeMode, summary]);

  useEffect(() => {
    let stale = false;
    setTop(null);
    api
      .compareTop(150)
      .then((t) => !stale && setTop(t))
      .catch((e) => !stale && onErrorRef.current(errorText(e)));
    return () => {
      stale = true;
    };
  }, [version, sizeMode, summary]);

  const list = tab === "folders" ? rows : top?.[tab] ?? null;
  const largest = useMemo(() => Math.max(1, ...(list ?? []).map((e) => Math.abs(change(e)))), [list]);
  const total = summary.now - summary.before;
  const measure = sizeMode === "allocated" ? t("on disk") : t("size");

  return (
    <section className="panel dup-panel changes" aria-label={t("Changes since a snapshot")}>
      <header className="dup-toolbar">
        <div className="dup-scope">
          <span className="eyebrow">{t("Changes in {0} since", summary.meta.root)}</span>
          <span className="panel-title">{formatDateTime(summary.meta.scannedAt)}</span>
        </div>
        <div className="dup-controls">
          <Button iconBefore={X} onClick={onClose}>
            {t("Stop comparing")}
          </Button>
        </div>
      </header>

      <div className="dup-summary">
        <div className="scan-stat">
          <span className="eyebrow">{t("Then")}</span>
          <span className="value">{formatBytes(summary.before)}</span>
        </div>
        <div className="scan-stat">
          <span className="eyebrow">{t("Now")}</span>
          <span className="value">{formatBytes(summary.now)}</span>
        </div>
        <div className="scan-stat">
          <span className="eyebrow">{t("Change")}</span>
          <span className={cx("value", total > 0 ? "is-up" : total < 0 ? "is-down" : undefined)}>{formatChange(total)}</span>
        </div>
        <p className="dup-summary-note">
          {t(
            "By {0}. Files: {1} then, {2} now. Items are matched by path.",
            measure,
            summary.filesBefore.toLocaleString(locale()),
            summary.filesNow.toLocaleString(locale()),
          )}
        </p>
      </div>

      <div className="dup-bulk">
        <div className="segmented" role="tablist" aria-label={t("Show")}>
          {TABS.map((t) => (
            <button
              key={t.key}
              className={cx("segment", tab === t.key && "is-selected")}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
            >
              {t.label}
              {t.key !== "folders" && top && <span className="badge">{top[t.key].length}</span>}
            </button>
          ))}
        </div>
        {tab === "folders" && (
          <nav className="crumbs changes-crumbs" aria-label={t("Folder")}>
            {trail.map((c, i) => (
              <span key={c.id} style={{ display: "contents" }}>
                {i > 0 && <ChevronRight size={14} className="crumb-sep" aria-hidden="true" />}
                <button className={cx("crumb", i === trail.length - 1 && "is-current")} onClick={() => setTrail(trail.slice(0, i + 1))}>
                  {c.name}
                </button>
              </span>
            ))}
          </nav>
        )}
      </div>

      <div className="dup-list changes-list" role="list">
        {!list ? (
          <div className="dup-empty">
            <Spinner size={22} label={t("Comparing")} />
          </div>
        ) : list.length === 0 ? (
          <EmptyState icon={ArrowLeftRight} title={t("Nothing here")} compact>
            {tab === "folders" ? t("This folder is empty in both scans.") : t("No items of this kind changed.")}
          </EmptyState>
        ) : (
          list.map((e) => {
            const delta = change(e);
            const status = e.before == null ? t("New") : e.now == null ? t("Gone") : delta === 0 ? "" : delta > 0 ? t("Grew") : t("Shrank");
            const dir = e.path.slice(0, Math.max(0, e.path.length - e.name.length - 1));
            return (
              <div
                key={`${e.path}|${e.id ?? "gone"}`}
                role="listitem"
                className={cx("change-row", e.now == null && "is-gone", e.canOpen && "is-openable")}
                onDoubleClick={() => e.canOpen && e.id != null && setTrail([...trail, { id: e.id, name: e.name }])}
              >
                <span className="row-icon">
                  <EntryIcon name={e.name} kind={e.kind} />
                </span>
                <span className="change-text">
                  {e.canOpen && e.id != null ? (
                    <button className="link-button change-name" onClick={() => setTrail([...trail, { id: e.id!, name: e.name }])}>
                      {e.name}
                    </button>
                  ) : (
                    <span className="change-name">{e.name}</span>
                  )}
                  {tab !== "folders" && <span className="file-hit-dir">{"‎" + dir}</span>}
                </span>
                {status ? <span className={cx("lozenge", `change-${status.toLowerCase()}`)}>{status}</span> : <span />}
                <span className="change-num hud-stat">{e.before == null ? "—" : formatBytes(e.before)}</span>
                <span className="change-num hud-stat">{e.now == null ? "—" : formatBytes(e.now)}</span>
                <span className={cx("change-num change-delta", delta > 0 ? "is-up" : delta < 0 ? "is-down" : undefined)}>
                  {formatChange(delta)}
                </span>
                <span className="change-bar" aria-hidden="true">
                  <span
                    className={delta >= 0 ? "is-up" : "is-down"}
                    style={{ width: `${(Math.abs(delta) / largest) * 100}%` }}
                  />
                </span>
                <span className="dup-file-actions">
                  {e.id != null && (
                    <IconButton icon={ChevronRight} label={t("Show on the map")} spacing="compact" onClick={() => onShow(e.id!)} />
                  )}
                  {e.now != null && (
                    <IconButton icon={FolderSearch} label={t("Show in Explorer")} spacing="compact" onClick={() => onReveal(e.path)} />
                  )}
                </span>
              </div>
            );
          })
        )}
      </div>
      {tab !== "folders" && top && (
        <footer className="dup-footer">
          <span>
            {tab === "added" || tab === "removed"
              ? t("The largest new or gone items; a new folder is listed once, not every file in it.")
              : t("Up to 150 files that changed most. Folders are compared on the Folder by folder tab.")}
          </span>
        </footer>
      )}
    </section>
  );
}
