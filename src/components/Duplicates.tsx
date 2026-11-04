import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, FolderCheck, FolderSearch, Link2, Map as MapIcon, Search, ShoppingBasket, Square, Trash2, X } from "lucide-react";
import { api, errorText, onDupDone, onDupProgress } from "../lib/api";
import { CATEGORIES, CATEGORY_LABEL, categoryOf, type Category } from "../lib/fileTypes";
import { formatBytes, formatDate, formatElapsed, plural } from "../lib/format";
import { EntryIcon } from "../lib/icons";
import type { DupDone, DupGroup, DupProgress, LinkReport, RecycleReport } from "../lib/types";
import { cx } from "../lib/utils";
import { ConfirmBulk } from "./ConfirmBulk";
import { Button, IconButton } from "./ui/Button";
import { EmptyState, ProgressBar, SectionMessage } from "./ui/Feedback";

const MIN_SIZES = [
  { label: "64 KB", bytes: 64 * 1024 },
  { label: "1 MB", bytes: 1024 * 1024 },
  { label: "10 MB", bytes: 10 * 1024 * 1024 },
  { label: "100 MB", bytes: 100 * 1024 * 1024 },
];

const PAGE = 150;

/** An item to put in the cleanup basket. */
export interface BasketItem {
  id: number;
  path: string;
  /** Space on disk it frees. */
  size: number;
  kind: "file" | "dir";
}

interface DuplicatesProps {
  folderId: number;
  folderName: string;
  /** Changes on a rescan or a delete made outside this view, which makes results stale. */
  dataVersion: number;
  /** When a filter is on, only matching files are compared. */
  filterOn: boolean;
  /** Settings allows "Delete permanently". */
  allowPermanentDelete: boolean;
  onRecycled: (report: RecycleReport) => void;
  onDeleted: (report: RecycleReport) => void;
  onLinked: (report: LinkReport) => void;
  onAddToBasket: (items: BasketItem[]) => void;
  /** Highlights these files on the map. */
  onShowOnMap: (ids: number[], label: string) => void;
  onReveal: (path: string) => void;
  onError: (message: string) => void;
}

function splitPath(path: string) {
  const i = Math.max(path.lastIndexOf("\\"), path.lastIndexOf("/"));
  return { dir: path.slice(0, i), name: path.slice(i + 1) };
}

/** Part of a path, or a pattern with * and ?, matched anywhere in it. */
function pathMatcher(text: string): ((path: string) => boolean) | null {
  const t = text.trim().toLowerCase().replace(/\//g, "\\");
  if (!t) return null;
  if (!/[*?]/.test(t)) return (p) => p.toLowerCase().includes(t);
  const re = new RegExp(t.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, "."));
  return (p) => re.test(p.toLowerCase());
}

export function Duplicates({
  folderId,
  folderName,
  dataVersion,
  filterOn,
  allowPermanentDelete,
  onRecycled,
  onDeleted,
  onLinked,
  onAddToBasket,
  onShowOnMap,
  onReveal,
  onError,
}: DuplicatesProps) {
  const [minSize, setMinSize] = useState(MIN_SIZES[1].bytes);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<DupProgress | null>(null);
  const [result, setResult] = useState<DupDone | null>(null);
  const [scope, setScope] = useState<string>("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [shown, setShown] = useState(PAGE);
  const [confirming, setConfirming] = useState<"recycle" | "link" | null>(null);
  const [busy, setBusy] = useState(false);
  const [pathFilter, setPathFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<Category | "">("");
  const generation = useRef(0);
  const searchedVersion = useRef(dataVersion);

  useEffect(() => {
    const p = onDupProgress((e) => e.generation === generation.current && setProgress(e));
    const d = onDupDone((e) => {
      if (e.generation !== generation.current) return;
      setRunning(false);
      if (e.status === "done") {
        setResult(e);
        setSelected(new Set());
        setShown(PAGE);
      }
    });
    return () => {
      p.then((un) => un());
      d.then((un) => un());
    };
  }, []);

  // A rescan or a recycle elsewhere makes earlier results stale.
  const stale = !!result && dataVersion !== searchedVersion.current;

  async function start() {
    setProgress(null);
    setRunning(true);
    setScope(folderName);
    searchedVersion.current = dataVersion;
    try {
      generation.current = await api.findDuplicates(folderId, minSize);
    } catch (err) {
      setRunning(false);
      onError(errorText(err));
    }
  }

  function cancel() {
    api.cancelDuplicates();
    setRunning(false);
  }

  const allGroups = result?.groups ?? [];
  // Groups shown: any copy's path matches the text, and the files are of the chosen type.
  const groups = useMemo(() => {
    const match = pathMatcher(pathFilter);
    if (!match && !typeFilter) return allGroups;
    return allGroups.filter(
      (g) =>
        (!match || g.files.some((f) => match(f.path))) &&
        (!typeFilter || categoryOf(splitPath(g.files[0].path).name) === typeFilter),
    );
  }, [allGroups, pathFilter, typeFilter]);
  const filtering = groups !== allGroups;

  const groupOf = useMemo(() => {
    const map = new Map<number, DupGroup>();
    for (const g of allGroups) for (const f of g.files) map.set(f.id, g);
    return map;
  }, [allGroups]);

  const selectedBytes = useMemo(() => {
    let sum = 0;
    for (const id of selected) sum += groupOf.get(id)?.size ?? 0;
    return sum;
  }, [selected, groupOf]);

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /** Selects every copy except the one `keep` picks, in every group shown. */
  function selectAllBut(keep: (g: DupGroup) => number) {
    const next = new Set(selected);
    for (const g of groups) {
      const kept = keep(g);
      for (const f of g.files) {
        if (f.id !== kept) next.add(f.id);
        else next.delete(f.id);
      }
    }
    setSelected(next);
  }

  /** Selects every copy inside `dir`, in every group, but never the last copy of a group. */
  function selectInFolder(dir: string) {
    const prefix = dir.toLowerCase() + "\\";
    const next = new Set(selected);
    for (const g of allGroups) {
      for (const f of g.files) {
        if (!f.path.toLowerCase().startsWith(prefix) || next.has(f.id)) continue;
        // A group whose every copy is in the folder keeps its last one.
        if (g.files.filter((x) => !next.has(x.id)).length > 1) next.add(f.id);
      }
    }
    setSelected(next);
  }

  /** Drops the copies that are gone (or became links) from the results. */
  function dropFromResults(gone: Set<number>) {
    setResult((r) => {
      if (!r) return r;
      let freed = 0;
      let removedFiles = 0;
      const kept: DupGroup[] = [];
      for (const g of r.groups) {
        const files = g.files.filter((f) => !gone.has(f.id));
        const removed = g.files.length - files.length;
        freed += removed * g.size;
        removedFiles += removed;
        if (files.length > 1) kept.push({ ...g, files });
      }
      return {
        ...r,
        groups: kept,
        totalGroups: r.totalGroups - (r.groups.length - kept.length),
        duplicateFiles: r.duplicateFiles - removedFiles,
        wasted: r.wasted - freed,
      };
    });
    // Whatever was skipped stays selected, so it can be retried.
    setSelected((prev) => new Set([...prev].filter((id) => !gone.has(id))));
  }

  async function recycle(allowPermanent: boolean) {
    setBusy(true);
    try {
      const report = await api.recycleEach([...selected], allowPermanent);
      onRecycled(report);
      dropFromResults(new Set(report.done));
      setConfirming(null);
    } catch (err) {
      onError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function deletePermanently() {
    setBusy(true);
    try {
      const report = await api.deleteEach([...selected]);
      onDeleted(report);
      dropFromResults(new Set(report.done));
      setConfirming(null);
    } catch (err) {
      onError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  /** Each selected copy, paired with the copy of its group that stays (the first one not selected). */
  const linkPairs = useMemo(() => {
    const pairs: { keep: number; copy: number }[] = [];
    for (const id of selected) {
      const g = groupOf.get(id);
      const keep = g?.files.find((f) => !selected.has(f.id));
      if (keep) pairs.push({ keep: keep.id, copy: id });
    }
    return pairs;
  }, [selected, groupOf]);

  async function link() {
    setBusy(true);
    try {
      const report = await api.linkDuplicates(linkPairs);
      onLinked(report);
      dropFromResults(new Set(report.done));
      setConfirming(null);
    } catch (err) {
      onError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  function addToBasket() {
    const items: BasketItem[] = [];
    for (const id of selected) {
      const g = groupOf.get(id);
      const f = g?.files.find((x) => x.id === id);
      if (g && f) items.push({ id, path: f.path, size: g.size, kind: "file" });
    }
    onAddToBasket(items);
    setSelected(new Set());
  }

  const fraction = progress && progress.bytesTotal > 0 ? progress.bytesDone / progress.bytesTotal : undefined;

  return (
    <section className="panel dup-panel" aria-label="Duplicate files">
      <header className="dup-toolbar">
        <div className="dup-scope">
          <span className="eyebrow">Find duplicates in</span>
          <span className="panel-title">{folderName}</span>
          {filterOn && <span className="hud-stat">Only files that match the filter are compared</span>}
        </div>
        <div className="dup-controls">
          <span className="hud-stat">Files from</span>
          <div className="segmented" role="radiogroup" aria-label="Smallest file to check">
            {MIN_SIZES.map((m) => (
              <button
                key={m.bytes}
                className={cx("segment", minSize === m.bytes && "is-selected")}
                role="radio"
                aria-checked={minSize === m.bytes}
                disabled={running}
                onClick={() => setMinSize(m.bytes)}
              >
                {m.label}
              </button>
            ))}
          </div>
          {running ? (
            <Button iconBefore={Square} onClick={cancel}>
              Cancel
            </Button>
          ) : (
            <Button appearance="primary" iconBefore={Search} onClick={start}>
              {result ? "Search again" : "Find duplicates"}
            </Button>
          )}
        </div>
      </header>

      {running && (
        <div className="dup-progress" aria-live="polite">
          <div className="dup-progress-text">
            <span>
              {progress?.phase === "full" ? "Comparing whole files" : "Comparing the start and end of same-size files"}
            </span>
            <span className="hud-stat">
              {progress ? `${progress.done.toLocaleString()} of ${progress.total.toLocaleString()} files` : "Starting…"}
              {progress && ` · ${formatBytes(progress.bytesDone)} read · ${formatElapsed(progress.elapsedMs)}`}
            </span>
          </div>
          <ProgressBar value={fraction} indeterminate={fraction === undefined} label="Duplicate search progress" />
        </div>
      )}

      {!running && !result && (
        <div className="dup-empty">
          <EmptyState icon={Copy} title="Find files that are stored more than once">
            Disq Studio compares files of the same size, first by their start and end, then by their whole contents.
            Online-only cloud files are skipped, so nothing gets downloaded, and files that haven&apos;t changed since an
            earlier search aren&apos;t read again.
          </EmptyState>
        </div>
      )}

      {!running && result && (
        <>
          <div className="dup-summary">
            <div className="scan-stat">
              <span className="eyebrow">Can be freed</span>
              <span className="value">{formatBytes(result.wasted)}</span>
            </div>
            <div className="scan-stat">
              <span className="eyebrow">Extra copies</span>
              <span className="value">{result.duplicateFiles.toLocaleString()}</span>
            </div>
            <div className="scan-stat">
              <span className="eyebrow">Groups</span>
              <span className="value">{result.totalGroups.toLocaleString()}</span>
            </div>
            <p className="dup-summary-note">
              In {scope}: checked {plural(result.candidates, "file", "files")} with a same-size twin in{" "}
              {formatElapsed(result.elapsedMs)}
              {result.cached > 0 && `, ${plural(result.cached, "hash", "hashes")} remembered from earlier searches`}
              {result.skipped > 0 && `, ${plural(result.skipped, "file", "files")} couldn't be read`}.
              {result.totalGroups > result.groups.length &&
                ` Showing the ${result.groups.length.toLocaleString()} groups that waste the most.`}
              {stale && " The scan has changed since; search again for current results."}
            </p>
          </div>

          {allGroups.length === 0 ? (
            <div className="dup-empty">
              <EmptyState icon={Copy} title="No duplicates found">
                No two files of {MIN_SIZES.find((m) => m.bytes === minSize)?.label ?? "this size"} or more have the same
                contents here.
              </EmptyState>
            </div>
          ) : (
            <>
              <div className="dup-bulk">
                <label className="filter-search dup-filter">
                  <Search size={14} aria-hidden="true" />
                  <input
                    type="search"
                    value={pathFilter}
                    placeholder="Only groups with a copy in… (path or *pattern)"
                    aria-label="Show only groups with a copy whose path matches"
                    spellCheck={false}
                    onChange={(e) => setPathFilter(e.target.value)}
                  />
                </label>
                <select
                  className="filter-select"
                  aria-label="File type"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as Category | "")}
                >
                  <option value="">All types</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABEL[c]}
                    </option>
                  ))}
                </select>
                {filtering && (
                  <span className="hud-stat">
                    {plural(groups.length, "group", "groups")} of {allGroups.length.toLocaleString()}
                  </span>
                )}
                <Button
                  spacing="compact"
                  iconBefore={MapIcon}
                  tooltip="Highlight the extra copies (all but the oldest of each) on the map"
                  onClick={() =>
                    onShowOnMap(
                      groups.flatMap((g) => g.files.slice(1).map((f) => f.id)),
                      `${plural(groups.reduce((s, g) => s + g.files.length - 1, 0), "extra copy", "extra copies")} of duplicate files`,
                    )
                  }
                >
                  Show on map
                </Button>
              </div>
              <div className="dup-bulk" style={{ paddingTop: 0 }}>
                <span className="hud-stat">Select extra copies{filtering ? " in the groups shown" : ""}:</span>
                <Button spacing="compact" onClick={() => selectAllBut((g) => g.files[0].id)}>
                  Keep oldest
                </Button>
                <Button spacing="compact" onClick={() => selectAllBut((g) => g.files[g.files.length - 1].id)}>
                  Keep newest
                </Button>
                <Button
                  spacing="compact"
                  onClick={() =>
                    selectAllBut((g) => [...g.files].sort((a, b) => a.path.length - b.path.length)[0].id)
                  }
                >
                  Keep shortest path
                </Button>
                {selected.size > 0 && (
                  <Button spacing="compact" appearance="subtle" iconBefore={X} onClick={() => setSelected(new Set())}>
                    Clear
                  </Button>
                )}
              </div>

              <div className="dup-list">
                {groups.length === 0 && (
                  <EmptyState icon={Search} title="No groups match" compact>
                    No duplicate group has a copy matching that path and type.
                  </EmptyState>
                )}
                {groups.slice(0, shown).map((g) => {
                  const picked = g.files.filter((f) => selected.has(f.id)).length;
                  const first = splitPath(g.files[0].path).name;
                  return (
                    <article key={g.files[0].id} className="dup-group">
                      <header className="dup-group-head">
                        <EntryIcon name={first} kind="file" />
                        <span className="dup-group-name">{first}</span>
                        <span className="hud-stat">
                          {g.files.length} × {formatBytes(g.size)}
                        </span>
                        <span className="lozenge lozenge-discovery">{formatBytes(g.size * (g.files.length - 1))} extra</span>
                      </header>
                      {g.files.map((f, i) => {
                        const { dir, name } = splitPath(f.path);
                        const checked = selected.has(f.id);
                        // Always keep at least one copy.
                        const locked = !checked && picked === g.files.length - 1;
                        return (
                          <div key={f.id} className={cx("dup-file", checked && "is-selected")}>
                            <label
                              className="dup-check"
                              data-tooltip={locked ? "Keep at least one copy" : undefined}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={locked}
                                onChange={() => toggle(f.id)}
                                aria-label={`Select ${f.path}`}
                              />
                              <span className="dup-file-text">
                                <span className="dup-file-name">
                                  {name}
                                  {i === 0 && <span className="lozenge">oldest</span>}
                                </span>
                                <span className="dup-file-dir">{"‎" + dir}</span>
                              </span>
                            </label>
                            <span className="hud-stat">{formatDate(f.modified)}</span>
                            <span className="dup-file-actions">
                              <IconButton
                                icon={FolderCheck}
                                label={`Select every copy in ${dir}`}
                                spacing="compact"
                                onClick={() => selectInFolder(dir)}
                              />
                              <IconButton
                                icon={FolderSearch}
                                label="Show in Explorer"
                                spacing="compact"
                                onClick={() => onReveal(f.path)}
                              />
                            </span>
                          </div>
                        );
                      })}
                    </article>
                  );
                })}
                {groups.length > shown && (
                  <div style={{ display: "flex", justifyContent: "center", padding: "var(--space-150)" }}>
                    <Button onClick={() => setShown((s) => s + PAGE)}>
                      Show {Math.min(PAGE, groups.length - shown)} more groups
                    </Button>
                  </div>
                )}
              </div>

              <footer className={cx("dup-footer", selected.size > 0 && "is-active")}>
                <span>
                  {selected.size > 0 ? (
                    <>
                      <b>{plural(selected.size, "copy", "copies")}</b> selected · frees{" "}
                      <b className="mono">{formatBytes(selectedBytes)}</b>
                    </>
                  ) : (
                    "Select the copies you don't need. One copy in each group always stays."
                  )}
                </span>
                <div className="dup-footer-actions">
                  <Button
                    appearance="subtle"
                    iconBefore={ShoppingBasket}
                    disabled={selected.size === 0}
                    tooltip="Collect them in the basket and recycle everything there in one go"
                    onClick={addToBasket}
                  >
                    Add to basket
                  </Button>
                  <Button
                    iconBefore={Link2}
                    disabled={linkPairs.length === 0}
                    tooltip="Keep every name, but store the data once: each selected copy becomes a hard link to the copy that stays"
                    onClick={() => setConfirming("link")}
                  >
                    Replace with links
                  </Button>
                  <Button
                    appearance="danger"
                    iconBefore={Trash2}
                    disabled={selected.size === 0}
                    onClick={() => setConfirming("recycle")}
                  >
                    Move to Recycle Bin
                  </Button>
                </div>
              </footer>
            </>
          )}
        </>
      )}

      {confirming === "recycle" && (
        <ConfirmBulk
          ids={[...selected]}
          bytes={selectedBytes}
          paths={[...selected].slice(0, 5).map((id) => groupOf.get(id)?.files.find((f) => f.id === id)?.path ?? "")}
          busy={busy}
          note="One copy of every file stays where it is."
          onConfirm={recycle}
          onDeletePermanently={allowPermanentDelete ? deletePermanently : undefined}
          onClose={() => !busy && setConfirming(null)}
        />
      )}
      {confirming === "link" && (
        <ConfirmLink
          count={linkPairs.length}
          bytes={selectedBytes}
          busy={busy}
          onConfirm={link}
          onClose={() => !busy && setConfirming(null)}
        />
      )}
    </section>
  );
}

function ConfirmLink({
  count,
  bytes,
  busy,
  onConfirm,
  onClose,
}: {
  count: number;
  bytes: number;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return (
    <div className="blanket" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-medium" role="alertdialog" aria-modal="true" aria-labelledby="link-title">
        <div className="modal-header">
          <h2 className="modal-title" id="link-title">
            Replace {plural(count, "copy", "copies")} with links?
          </h2>
          <IconButton icon={X} label="Close" onClick={onClose} />
        </div>
        <div className="modal-body">
          <p className="dialog-text">
            Every file stays where it is and opens as before, but the data is stored once, freeing about{" "}
            <span className="path-text">{formatBytes(bytes)}</span>. Each selected copy becomes a hard link: another name
            for the copy that stays.
          </p>
          <SectionMessage appearance="warning" title="Linked names share one file">
            Editing a linked file changes it under every name. Use this for files you only keep, like photos, music,
            installers or downloads, not for copies you mean to edit separately. Copies that changed since the search,
            or are on another drive, are skipped.
          </SectionMessage>
        </div>
        <div className="modal-footer">
          <Button appearance="subtle" onClick={onClose}>
            Cancel
          </Button>
          <Button ref={confirmRef} appearance="primary" iconBefore={Link2} loading={busy} onClick={onConfirm}>
            Replace with links
          </Button>
        </div>
      </div>
    </div>
  );
}
