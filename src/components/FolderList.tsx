import { useEffect, useMemo, useRef, useState } from "react";
import { FolderOpen, Trash2 } from "lucide-react";
import { api, errorText, SIZE_MODE_LABEL } from "../lib/api";
import { fitLayout, gridTemplate, type ColumnLayout } from "../lib/columns";
import { CATEGORY_VAR, categoryOf } from "../lib/fileTypes";
import { formatBytes, plural } from "../lib/format";
import { EntryIcon, OnlineBadge } from "../lib/icons";
import type { Entry, FilterHit, FilterSummary, SizeMode } from "../lib/types";
import { compareNames, cx } from "../lib/utils";
import { ListHead, RowCells } from "./ListColumns";
import { MatchesList } from "./MatchesList";
import { Button } from "./ui/Button";
import { EmptyState, Spinner } from "./ui/Feedback";
import type { MenuRequest } from "./ui/Menu";
import { t, locale } from "../lib/i18n";

interface FolderListProps {
  folderId: number;
  folderName: string;
  folderSize: number;
  sizeMode: SizeMode;
  /** Everything selected; the last one is the one the details panel shows. */
  selectedIds: number[];
  version: number;
  layout: ColumnLayout;
  onLayout: (next: ColumnLayout) => void;
  onMenu: (request: MenuRequest) => void;
  onSelect: (id: number) => void;
  /** Ctrl+click: add to or take out of the selection. */
  onToggle: (id: number) => void;
  /** Shift+click and Ctrl+A: select these, the last one in front. */
  onSelectMany: (ids: number[]) => void;
  onOpen: (entry: Entry) => void;
  onContextMenu: (id: number, x: number, y: number) => void;
  onError: (message: string) => void;
  /** While a filter is on: its matches, shown in a tab of their own. */
  filter?: { summary: FilterSummary; onPick: (hit: FilterHit) => void; onRecycleAll: () => void };
}

function sortEntries(entries: Entry[], { key, dir }: ColumnLayout["sort"]): Entry[] {
  const sign = dir === "asc" ? 1 : -1;
  const by: (a: Entry, b: Entry) => number =
    key === "name"
      ? (a, b) => compareNames(a.name, b.name)
      : key === "files"
        ? (a, b) => a.files - b.files || a.size - b.size
        : key === "modified"
          ? (a, b) => a.modified - b.modified
          : (a, b) => a.size - b.size;
  return [...entries].sort((a, b) => sign * by(a, b));
}

/** Children of the current folder, with share bars; sorted by any column. */
export function FolderList({
  folderId,
  folderName,
  folderSize,
  sizeMode,
  selectedIds,
  version,
  layout,
  onLayout,
  onMenu,
  onSelect,
  onToggle,
  onSelectMany,
  onOpen,
  onContextMenu,
  onError,
  filter,
}: FolderListProps) {
  const [raw, setRaw] = useState<Entry[] | null>(null);
  const [tab, setTab] = useState<"matches" | "folder">("matches");
  const listRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const [panelWidth, setPanelWidth] = useState(0);
  const fitted = useMemo(() => fitLayout(layout, panelWidth), [layout, panelWidth]);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const selectedId = selectedIds.length ? selectedIds[selectedIds.length - 1] : null;
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);

  // Each new filter opens on its matches.
  const filterOn = !!filter;
  useEffect(() => {
    if (filterOn) setTab("matches");
  }, [filterOn]);
  const showMatches = !!filter && tab === "matches";

  useEffect(() => {
    let stale = false;
    api
      .listChildren(folderId)
      .then((list) => !stale && setRaw(list))
      .catch((err) => !stale && onErrorRef.current(errorText(err)));
    return () => {
      stale = true;
    };
  }, [folderId, version]);

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setPanelWidth(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const entries = useMemo(() => (raw ? sortEntries(raw, layout.sort) : null), [raw, layout.sort]);

  // Keep the selected row in view when it is picked on the map.
  useEffect(() => {
    if (selectedId == null) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-id="${selectedId}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [selectedId, entries]);

  const largest = raw?.reduce((m, e) => Math.max(m, e.size), 0) ?? 0;

  /** From the selection's front item to `id`, in list order. */
  function rangeTo(id: number): number[] {
    if (!entries) return [id];
    const to = entries.findIndex((x) => x.id === id);
    const from = selectedId == null ? -1 : entries.findIndex((x) => x.id === selectedId);
    if (from < 0 || to < 0) return [id];
    const [lo, hi] = from < to ? [from, to] : [to, from];
    const ids = entries.slice(lo, hi + 1).map((x) => x.id);
    // The clicked row ends up in front, as with a plain click.
    return [...ids.filter((x) => x !== id), id];
  }

  function onClickRow(e: React.MouseEvent, id: number) {
    if (e.shiftKey) onSelectMany(rangeTo(id));
    else if (e.ctrlKey || e.metaKey) onToggle(id);
    else onSelect(id);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!entries?.length) return;
    if (e.ctrlKey && e.key.toLowerCase() === "a") {
      e.preventDefault();
      onSelectMany(entries.map((x) => x.id));
      return;
    }
    const i = entries.findIndex((x) => x.id === selectedId);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = e.key === "ArrowDown" ? Math.min(entries.length - 1, i + 1) : Math.max(0, i - 1);
      const id = entries[next].id;
      if (e.shiftKey) onSelectMany(selected.has(id) ? selectedIds.filter((x) => x !== selectedId) : [...selectedIds, id]);
      else onSelect(id);
      listRef.current?.querySelector<HTMLElement>(`[data-id="${id}"]`)?.focus();
    }
  }

  return (
    <section
      ref={panelRef}
      className="panel"
      aria-label={t("Folder contents")}
      style={{ ["--row-cols" as string]: gridTemplate(fitted) }}
    >
      <header className="panel-header">
        {filter ? (
          <>
            <div className="segmented" role="tablist" aria-label={t("List")}>
              <button
                className={cx("segment", tab === "matches" && "is-selected")}
                role="tab"
                aria-selected={tab === "matches"}
                onClick={() => setTab("matches")}
              >
                {t("Matches")}
                <span className="badge">{filter.summary.totalHits.toLocaleString(locale())}</span>
              </button>
              <button
                className={cx("segment", tab === "folder" && "is-selected")}
                role="tab"
                aria-selected={tab === "folder"}
                onClick={() => setTab("folder")}
              >
                {t("This folder")}
              </button>
            </div>
            {showMatches && filter.summary.totalHits > 0 && (
              <Button
                spacing="compact"
                appearance="subtle"
                iconBefore={Trash2}
                tooltip={t("Move every match to the Recycle Bin, after a check of what the Recycle Bin can take")}
                onClick={filter.onRecycleAll}
              >
                {t("Recycle all")}
              </Button>
            )}
          </>
        ) : (
          <>
            <h2 className="panel-title" data-tooltip={folderName} data-tooltip-overflow="">
              {folderName}
            </h2>
            {selectedIds.length > 1 ? (
              <span className="badge badge-primary">{t("{0} selected", selectedIds.length.toLocaleString(locale()))}</span>
            ) : (
              entries && <span className="badge">{entries.length.toLocaleString(locale())}</span>
            )}
          </>
        )}
      </header>
      <ListHead
        layout={layout}
        fitted={fitted}
        sizeLabel={SIZE_MODE_LABEL[sizeMode]}
        sortable={!showMatches}
        onLayout={onLayout}
        onMenu={onMenu}
      />
      {showMatches && (
        <MatchesList
          summary={filter.summary}
          layout={fitted}
          selectedIds={selectedIds}
          onPick={filter.onPick}
          onContextMenu={onContextMenu}
        />
      )}
      <div
        className="list"
        ref={listRef}
        role="listbox"
        aria-multiselectable="true"
        aria-label={t("Contents of {0}", folderName)}
        onKeyDown={onKeyDown}
        hidden={showMatches}
      >
        {!entries && (
          <div className="map-loading" style={{ position: "static", padding: "2rem" }}>
            <Spinner size={20} label={t("Loading")} />
          </div>
        )}
        {entries?.length === 0 &&
          (filter ? (
            <EmptyState icon={FolderOpen} title={t("Nothing in this folder matches")} compact />
          ) : (
            <EmptyState icon={FolderOpen} title={t("This folder is empty")} compact />
          ))}
        {entries?.map((entry) => {
          const isDir = entry.kind === "dir";
          const share = folderSize > 0 ? entry.size / folderSize : 0;
          const width = largest > 0 ? (entry.size / largest) * 100 : 0;
          const fill = isDir ? undefined : `var(${CATEGORY_VAR[categoryOf(entry.name)]})`;
          const isSelected = selected.has(entry.id);
          return (
            <button
              key={entry.id}
              data-id={entry.id}
              role="option"
              aria-selected={isSelected}
              className={cx(
                "row",
                isSelected && "is-selected",
                (entry.kind === "link" || entry.kind === "hardlink" || entry.kind === "excluded" || entry.size === 0) &&
                  "is-dimmed",
              )}
              onClick={(e) => onClickRow(e, entry.id)}
              onDoubleClick={() => onOpen(entry)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onOpen(entry);
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                // Keep a multi-selection when right-clicking inside it.
                if (!isSelected) onSelect(entry.id);
                onContextMenu(entry.id, e.clientX, e.clientY);
              }}
              data-tooltip={
                isDir
                  ? `${entry.name} · ${plural(entry.files, "file", "files")}, ${plural(entry.dirs, "folder", "folders")}` +
                    (entry.online > 0 ? t(" · {0} online only", formatBytes(entry.online)) : "")
                  : entry.kind === "denied"
                    ? t("{0} · couldn't be read", entry.name)
                    : entry.kind === "excluded"
                      ? t("{0} · skipped by Settings › Folders to skip, so its size isn't counted", entry.name)
                      : entry.kind === "hardlink"
                      ? t("{0} · hard link, counted once under its other name", entry.name)
                      : undefined
              }
            >
              <span className="row-icon">
                <EntryIcon name={entry.name} kind={entry.kind} />
              </span>
              <span className="row-name-wrap">
                <span className="row-name">{entry.name}</span>
                {entry.kind === "file" && entry.online > 0 && <OnlineBadge />}
              </span>
              <RowCells
                layout={fitted}
                size={entry.size}
                whole={folderSize}
                files={isDir || entry.kind === "denied" ? entry.files : null}
                modified={entry.modified}
              />
              <span className="row-bar" aria-hidden="true">
                <span
                  className={cx("row-bar-fill", !isDir && "is-file")}
                  style={{ display: "block", width: `${Math.max(width, share > 0 ? 0.5 : 0)}%`, ["--fill-color" as string]: fill }}
                />
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
