import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, FolderSearch, Trash2, X, ZoomIn } from "lucide-react";
import { api, errorText } from "../lib/api";
import { CATEGORIES, CATEGORY_LABEL, CATEGORY_VAR, categoryOfExt, type Category } from "../lib/fileTypes";
import { formatBytes, formatDate, formatShare, plural } from "../lib/format";
import { EntryIcon, OnlineBadge } from "../lib/icons";
import type { ExtStat, FileHit, NodeInfo, SizeMode } from "../lib/types";
import { cx } from "../lib/utils";
import { Button } from "./ui/Button";
import { Spinner } from "./ui/Feedback";
import { t, locale } from "../lib/i18n";

interface InspectorProps {
  /** The folder in view; file types and largest files are for this folder. */
  folderId: number;
  folderName: string;
  sizeMode: SizeMode;
  /** Everything selected; the last one is shown in detail when it's the only one. */
  selectedIds: number[];
  version: number;
  onSelect: (id: number) => void;
  onClearSelection: () => void;
  /** Recycle several items at once. */
  onRecycleMany: (items: NodeInfo[]) => void;
  onOpenFolder: (id: number) => void;
  onReveal: (path: string) => void;
  onOpenPath: (path: string) => void;
  /** Missing for a snapshot, where nothing can be deleted. */
  onRecycle?: (info: NodeInfo) => void;
  onError: (message: string) => void;
  /** While a filter is on, sizes are matching sizes. */
  filterOn: boolean;
}

/** Explains a noticeable gap between a file's length and the space it takes. */
function SizeNote({
  logical,
  allocated,
  online,
  isDir,
}: {
  logical: number;
  allocated: number;
  online: number;
  isDir: boolean;
}) {
  const diff = logical - allocated;
  // Ignore gaps under 1 MB or 5%: that's ordinary cluster rounding.
  if (Math.abs(diff) < Math.max(1024 * 1024, logical * 0.05)) return null;
  let text: string;
  if (diff < 0) {
    text = t("Takes {0} more on disk than its size. Many small files waste the unused end of each cluster.", formatBytes(-diff));
  } else if (!isDir && online > 0) {
    text = t("Online only: the data is in the cloud, not on this drive. Opening it downloads it.");
  } else if (!isDir && allocated === 0) {
    text = t("Takes no space of its own: it's small enough to live in the file table.");
  } else {
    const rest = diff - online;
    text =
      online > 0 && rest < Math.max(1024 * 1024, logical * 0.05)
        ? t("Takes {0} less on disk than its size, because {1} of it is online only.", formatBytes(diff), formatBytes(online))
        : online > 0
          ? t("Takes {0} less on disk than its size: {1} is online only, the rest is saved by compression or sparse files.", formatBytes(diff), formatBytes(online))
          : t("Takes {0} less on disk than its size, from compression or sparse files.", formatBytes(diff));
  }
  return (
    <p className="dialog-text" style={{ fontSize: "var(--font-size-small)" }}>
      {text}
    </p>
  );
}

/** What several selected items add up to; anything inside another selected item counts once, with it. */
function useSelection(ids: number[], version: number, onError: (m: string) => void) {
  const [items, setItems] = useState<NodeInfo[] | null>(null);
  const key = ids.join(",");
  useEffect(() => {
    if (ids.length < 2) {
      setItems(null);
      return;
    }
    let stale = false;
    Promise.all(ids.map((id) => api.nodeInfo(id)))
      .then((infos) => {
        if (stale) return;
        const chosen = new Set(ids);
        setItems(infos.filter((i) => !i.ancestors.slice(0, -1).some((a) => chosen.has(a.id))));
      })
      .catch((err) => !stale && onError(errorText(err)));
    return () => {
      stale = true;
    };
    // key stands for ids.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, version]);
  return items;
}

export function Inspector({
  folderId,
  folderName,
  sizeMode,
  selectedIds,
  version,
  onSelect,
  onClearSelection,
  onRecycleMany,
  onOpenFolder,
  onReveal,
  onOpenPath,
  onRecycle,
  onError,
  filterOn,
}: InspectorProps) {
  const [info, setInfo] = useState<NodeInfo | null>(null);
  const [exts, setExts] = useState<ExtStat[] | null>(null);
  const [largest, setLargest] = useState<FileHit[] | null>(null);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const selectedId = selectedIds.length ? selectedIds[selectedIds.length - 1] : null;
  const many = useSelection(selectedIds, version, (m) => onErrorRef.current(m));

  const infoId = selectedId ?? folderId;

  useEffect(() => {
    let stale = false;
    api
      .nodeInfo(infoId)
      .then((i) => !stale && setInfo(i))
      .catch((err) => !stale && onErrorRef.current(errorText(err)));
    return () => {
      stale = true;
    };
  }, [infoId, version]);

  useEffect(() => {
    let stale = false;
    setExts(null);
    setLargest(null);
    Promise.all([api.extensions(folderId, 0), api.largestFiles(folderId, 25)])
      .then(([e, l]) => {
        if (stale) return;
        setExts(e);
        setLargest(l);
      })
      .catch((err) => !stale && onErrorRef.current(errorText(err)));
    return () => {
      stale = true;
    };
  }, [folderId, version]);

  const categories = useMemo(() => {
    if (!exts) return null;
    const by = new Map<Category, { bytes: number; count: number }>();
    for (const e of exts) {
      const cat = categoryOfExt(e.ext);
      const slot = by.get(cat) ?? { bytes: 0, count: 0 };
      slot.bytes += e.bytes;
      slot.count += e.count;
      by.set(cat, slot);
    }
    const list = CATEGORIES.filter((c) => by.has(c)).map((c) => ({ cat: c, ...by.get(c)! }));
    list.sort((a, b) => b.bytes - a.bytes);
    const total = list.reduce((s, x) => s + x.bytes, 0);
    return { list, total };
  }, [exts]);

  const isDir = info?.kind === "dir" || info?.kind === "denied";
  const isRoot = info?.id === 0;

  return (
    <aside className="panel inspector" aria-label={t("Details")}>
      {selectedIds.length > 1 && (
        <section className="inspector-section">
          <span className="eyebrow">{t("Selection")}</span>
          <h2 className="inspector-name">{plural(selectedIds.length, "item selected", "items selected")}</h2>
          {!many ? (
            <Spinner size={16} label={t("Adding up the selection")} />
          ) : (
            <>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span className="big-number">{formatBytes(many.reduce((s, i) => s + i.size, 0))}</span>
                <span className="hud-stat">
                  {filterOn
                    ? sizeMode === "allocated"
                      ? t("matching the filter, on disk")
                      : t("matching the filter, size")
                    : sizeMode === "allocated"
                      ? t("on disk")
                      : t("size")}
                </span>
              </div>
              <dl className="facts">
                <dt>{t("Size")}</dt>
                <dd>{formatBytes(many.reduce((s, i) => s + i.logical, 0))}</dd>
                <dt>{t("On disk")}</dt>
                <dd>{formatBytes(many.reduce((s, i) => s + i.allocated, 0))}</dd>
                <dt>{t("Files")}</dt>
                <dd>{many.reduce((s, i) => s + (i.kind === "file" ? 1 : i.files), 0).toLocaleString(locale())}</dd>
                {many.length < selectedIds.length && (
                  <>
                    <dt>{t("Inside others")}</dt>
                    <dd data-tooltip={t("Selected items that are inside another selected folder; they're counted with it")}>
                      {(selectedIds.length - many.length).toLocaleString(locale())}
                    </dd>
                  </>
                )}
              </dl>
              <div className="actions">
                <Button spacing="compact" iconBefore={Trash2} disabled={!onRecycle} onClick={() => onRecycleMany(many)}>
                  {t("Recycle {0}", plural(many.length, "item", "items"))}
                </Button>
                <Button spacing="compact" appearance="subtle" iconBefore={X} onClick={onClearSelection}>
                  {t("Clear selection")}
                </Button>
              </div>
              <p className="hud-stat">{t("Ctrl+click adds or removes an item; Shift+click in the list selects a range.")}</p>
            </>
          )}
        </section>
      )}
      {info && selectedIds.length <= 1 && (
        <section className="inspector-section">
          <span className="eyebrow">{selectedId == null ? t("Current folder") : isDir ? t("Folder") : t("File")}</span>
          <h2 className="inspector-name">
            <EntryIcon name={info.name} kind={info.kind} />
            <span>{info.name}</span>
          </h2>
          <p className="inspector-path">{info.path}</p>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span className="big-number">{formatBytes(info.size)}</span>
            <span className="hud-stat">
              {filterOn
                ? sizeMode === "allocated"
                  ? t("matching the filter, on disk")
                  : t("matching the filter, size")
                : sizeMode === "allocated"
                  ? t("on disk")
                  : t("size")}
            </span>
          </div>
          <dl className="facts">
            <dt>{t("Size")}</dt>
            <dd>{formatBytes(info.logical)}</dd>
            <dt>{t("On disk")}</dt>
            <dd>{formatBytes(info.allocated)}</dd>
            {info.online > 0 && (
              <>
                <dt>{t("Online only")}</dt>
                <dd>{formatBytes(info.online)}</dd>
              </>
            )}
            {info.linked > 0 && (
              <>
                <dt data-tooltip={t("Hard links here that point at data counted under another name")}>{t("Hard links")}</dt>
                <dd>{formatBytes(info.linked)} {t("counted once")}</dd>
              </>
            )}
            {info.parentSize > 0 && (
              <>
                <dt>{t("Of parent folder")}</dt>
                <dd>{formatShare(info.size, info.parentSize)}</dd>
              </>
            )}
            {!isRoot && (
              <>
                <dt>{t("Of whole scan")}</dt>
                <dd>{formatShare(info.size, info.rootSize)}</dd>
              </>
            )}
            {isDir && (
              <>
                <dt>{t("Files")}</dt>
                <dd>{info.files.toLocaleString(locale())}</dd>
                <dt>{t("Folders")}</dt>
                <dd>{info.dirs.toLocaleString(locale())}</dd>
              </>
            )}
            <dt>{t("Modified")}</dt>
            <dd>{formatDate(info.modified)}</dd>
            <dt>{t("Bytes")}</dt>
            <dd>{info.size.toLocaleString(locale())}</dd>
          </dl>
          {info.linkTarget ? (
            <div className="section-message section-message-information" role="status">
              <div className="section-message-content">
                <p className="section-message-title">{t("Hard link")}</p>
                <div className="section-message-body">
                  {t(
                    "The same {0} of data also has another name, and it's counted there so it isn't counted twice. Recycling only this name frees no space.",
                    formatBytes(info.linkTarget.logical),
                  )}
                  <p className="inspector-path" style={{ marginTop: "var(--space-050)" }}>
                    {info.linkTarget.path}
                  </p>
                </div>
                <div className="section-message-actions">
                  <button className="link-button" onClick={() => onSelect(info.linkTarget!.id)}>
                    {t("Select the counted name")}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <SizeNote logical={info.logical} allocated={info.allocated} online={info.online} isDir={isDir} />
          )}
          {info.kind === "excluded" && (
            <p className="dialog-text" style={{ fontSize: "var(--font-size-small)" }}>
              {t("Skipped because it's in Settings › Folders to skip, so its size isn't counted.")}
            </p>
          )}
          {info.kind === "denied" && (
            <p className="dialog-text" style={{ fontSize: "var(--font-size-small)" }}>
              {t("Windows didn't allow this folder to be read, so its size isn't counted.")}
            </p>
          )}
          <div className="actions">
            {isDir && info.id !== folderId && (
              <Button spacing="compact" iconBefore={ZoomIn} onClick={() => onOpenFolder(info.id)}>
                {t("Zoom in")}
              </Button>
            )}
            <Button spacing="compact" iconBefore={FolderSearch} onClick={() => onReveal(info.path)}>
              {t("Show in Explorer")}
            </Button>
            {!isDir && (
              <Button spacing="compact" iconBefore={ExternalLink} onClick={() => onOpenPath(info.path)}>
                {t("Open")}
              </Button>
            )}
            {!isRoot && onRecycle && (
              <Button spacing="compact" appearance="subtle" iconBefore={Trash2} onClick={() => onRecycle(info)}>
                {t("Recycle")}
              </Button>
            )}
          </div>
        </section>
      )}

      <section className="inspector-section" aria-labelledby="types-heading">
        <h3 className="eyebrow" id="types-heading">
          {t("File types in {0}", folderName)}
        </h3>
        {!categories ? (
          <Spinner size={16} label={t("Counting file types")} />
        ) : categories.list.length === 0 ? (
          <p className="dialog-text">{t("No files here.")}</p>
        ) : (
          <>
            <div className="stack-bar" role="img" aria-label={t("Share of space by file type")}>
              {categories.list.map((c) => (
                <span
                  key={c.cat}
                  style={{
                    width: `${(c.bytes / categories.total) * 100}%`,
                    background: `var(${CATEGORY_VAR[c.cat]})`,
                  }}
                />
              ))}
            </div>
            <div className="stat-list">
              {categories.list.map((c) => (
                <div key={c.cat} className="stat-row">
                  <span className="swatch" style={{ background: `var(${CATEGORY_VAR[c.cat]})` }} />
                  <span className="label">{CATEGORY_LABEL[c.cat]}</span>
                  <span className="count">{c.count.toLocaleString(locale())}</span>
                  <span className="bytes">{formatBytes(c.bytes)}</span>
                </div>
              ))}
            </div>
            <h4 className="eyebrow" style={{ marginTop: "var(--space-100)" }}>
              {t("Top extensions")}
            </h4>
            <div className="stat-list">
              {exts!.slice(0, 8).map((e) => (
                <div key={e.ext} className="stat-row">
                  <span
                    className="swatch"
                    style={{ background: `var(${CATEGORY_VAR[categoryOfExt(e.ext)]})` }}
                  />
                  <span className="label mono">{e.ext ? `.${e.ext}` : t("no extension")}</span>
                  <span className="count">{e.count.toLocaleString(locale())}</span>
                  <span className="bytes">{formatBytes(e.bytes)}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="inspector-section" aria-labelledby="largest-heading">
        <h3 className="eyebrow" id="largest-heading">
          {t("Largest files")}
        </h3>
        {!largest ? (
          <Spinner size={16} label={t("Finding the largest files")} />
        ) : largest.length === 0 ? (
          <p className="dialog-text">{t("No files here.")}</p>
        ) : (
          <div className="stat-list">
            {largest.map((f) => {
              const dir = f.path.slice(0, Math.max(0, f.path.length - f.name.length - 1));
              return (
                <button
                  key={f.id}
                  className={cx("file-hit", f.id === selectedId && "is-selected")}
                  onClick={() => onSelect(f.id)}
                  onDoubleClick={() => onReveal(f.path)}
                  data-tooltip={f.path}
                >
                  <EntryIcon name={f.name} kind="file" />
                  <span className="file-hit-text">
                    <span className="file-hit-name">{f.name}</span>
                    <span className="file-hit-dir">{"‎" + dir}</span>
                  </span>
                  <span className="row-name-wrap">
                    {f.online && <OnlineBadge />}
                    <span className="file-hit-size">{formatBytes(f.size)}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </aside>
  );
}
