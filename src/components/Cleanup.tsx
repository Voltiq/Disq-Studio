import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, FolderSearch, Info, RefreshCw, ShieldCheck, ShoppingBasket, Sparkles, Trash2, TriangleAlert, X } from "lucide-react";
import { api, errorText } from "../lib/api";
import { formatBytes, formatDate, plural } from "../lib/format";
import { EntryIcon } from "../lib/icons";
import type { JunkCategory, JunkItem, RecycleReport } from "../lib/types";
import { cx } from "../lib/utils";
import { ConfirmBulk } from "./ConfirmBulk";
import type { BasketItem } from "./Duplicates";
import { Button, IconButton } from "./ui/Button";
import { EmptyState, Spinner } from "./ui/Feedback";

const PREVIEW = 5;

interface CleanupProps {
  scanPath: string;
  /** Changes after a rescan or any delete, so suggestions are found again. */
  dataVersion: number;
  /** Only fetch while the view is open. */
  visible: boolean;
  /** The user's own rules from Settings. */
  rules: string[];
  /** Settings allows "Delete permanently". */
  allowPermanentDelete: boolean;
  onRecycled: (report: RecycleReport) => void;
  onDeleted: (report: RecycleReport) => void;
  onAddToBasket: (items: BasketItem[]) => void;
  onReveal: (path: string) => void;
  onError: (message: string) => void;
}

function splitPath(path: string) {
  const i = Math.max(path.lastIndexOf("\\"), path.lastIndexOf("/"));
  return { dir: path.slice(0, i), name: path.slice(i + 1) };
}

export function Cleanup({
  scanPath,
  dataVersion,
  visible,
  rules,
  allowPermanentDelete,
  onRecycled,
  onDeleted,
  onAddToBasket,
  onReveal,
  onError,
}: CleanupProps) {
  const [categories, setCategories] = useState<JunkCategory[] | null>(null);
  const [loadedVersion, setLoadedVersion] = useState("");
  const loadKey = `${dataVersion}|${rules.join("\n")}`;
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const load = () => {
    setCategories(null);
    api
      .findJunk(rules)
      .then((found) => {
        setCategories(found);
        setLoadedVersion(loadKey);
        // Keep only selections that still exist.
        const ids = new Set(found.flatMap((c) => c.items.map((i) => i.id)));
        setSelected((prev) => new Set([...prev].filter((id) => ids.has(id))));
      })
      .catch((err) => onErrorRef.current(errorText(err)));
  };

  // Look again whenever the view is opened on changed data or rules.
  useEffect(() => {
    if (visible && loadedVersion !== loadKey) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, loadKey]);

  const itemById = useMemo(() => {
    const map = new Map<number, JunkItem>();
    for (const c of categories ?? []) for (const i of c.items) map.set(i.id, i);
    return map;
  }, [categories]);

  const selectedBytes = useMemo(() => {
    let sum = 0;
    for (const id of selected) sum += itemById.get(id)?.size ?? 0;
    return sum;
  }, [selected, itemById]);

  const totals = useMemo(() => {
    const t = { safe: 0, review: 0, info: 0 };
    for (const c of categories ?? []) t[c.safety] += c.total;
    return t;
  }, [categories]);

  function setMany(ids: number[], on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  function toggleExpanded(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function addToBasket() {
    const items: BasketItem[] = [];
    for (const id of selected) {
      const item = itemById.get(id);
      if (item) items.push({ id, path: item.path, size: item.size, kind: item.kind === "file" ? "file" : "dir" });
    }
    onAddToBasket(items);
    setSelected(new Set());
  }

  async function deletePermanently() {
    setBusy(true);
    try {
      const report = await api.deleteEach([...selected]);
      setSelected(new Set());
      setConfirming(false);
      onDeleted(report);
    } catch (err) {
      onError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function recycle(allowPermanent: boolean) {
    setBusy(true);
    try {
      const report = await api.recycleEach([...selected], allowPermanent);
      setSelected(new Set());
      setConfirming(false);
      onRecycled(report);
    } catch (err) {
      onError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel dup-panel" aria-label="Cleanup suggestions">
      <header className="dup-toolbar">
        <div className="dup-scope">
          <span className="eyebrow">Cleanup suggestions in</span>
          <span className="panel-title">{scanPath}</span>
          <span className="hud-stat">Caches, temp files and build output that apps rebuild on their own</span>
        </div>
        <div className="dup-controls">
          <Button iconBefore={RefreshCw} onClick={load} disabled={!categories}>
            Look again
          </Button>
        </div>
      </header>

      {!categories && (
        <div className="dup-empty">
          <Spinner size={24} label="Looking for junk" />
        </div>
      )}

      {categories && categories.length === 0 && (
        <div className="dup-empty">
          <EmptyState icon={Sparkles} title="Nothing to clean up here">
            No caches, temp files or build output of 1 MB or more were found in this scan.
          </EmptyState>
        </div>
      )}

      {categories && categories.length > 0 && (
        <>
          <div className="dup-summary">
            <div className="scan-stat">
              <span className="eyebrow">Safe to remove</span>
              <span className="value">{formatBytes(totals.safe)}</span>
            </div>
            <div className="scan-stat">
              <span className="eyebrow">Review first</span>
              <span className="value">{formatBytes(totals.review)}</span>
            </div>
            <div className="scan-stat">
              <span className="eyebrow">Selected</span>
              <span className="value">{formatBytes(selectedBytes)}</span>
            </div>
            <div className="dup-bulk" style={{ padding: 0 }}>
              <Button
                spacing="compact"
                iconBefore={ShieldCheck}
                onClick={() =>
                  setMany(
                    categories.filter((c) => c.safety === "safe").flatMap((c) => c.items.map((i) => i.id)),
                    true,
                  )
                }
              >
                Select everything safe
              </Button>
              {selected.size > 0 && (
                <Button spacing="compact" appearance="subtle" iconBefore={X} onClick={() => setSelected(new Set())}>
                  Clear
                </Button>
              )}
            </div>
          </div>

          <div className="dup-list" style={{ paddingTop: "var(--space-200)" }}>
            {categories.map((c) => {
              const ids = c.items.map((i) => i.id);
              const picked = ids.filter((id) => selected.has(id)).length;
              const open = expanded.has(c.key);
              const shown = open ? c.items : c.items.slice(0, PREVIEW);
              // Shown so it's known where the space goes; removing these loses data.
              const infoOnly = c.safety === "info";
              return (
                <article key={c.key} className="dup-group junk-group">
                  <header className="junk-head">
                    <label className="dup-check junk-check">
                      {infoOnly ? (
                        <Info size={16} className="junk-info-icon" aria-hidden="true" />
                      ) : (
                        <input
                          type="checkbox"
                          checked={picked === ids.length}
                          ref={(el) => {
                            if (el) el.indeterminate = picked > 0 && picked < ids.length;
                          }}
                          onChange={(e) => setMany(ids, e.target.checked)}
                          aria-label={`Select all ${c.label}`}
                        />
                      )}
                      <span className="dup-file-text">
                        <span className="dup-group-name">{c.label}</span>
                        <span className="junk-desc">{c.description}</span>
                      </span>
                    </label>
                    {c.safety === "safe" ? (
                      <span className="lozenge lozenge-success">
                        <ShieldCheck size={12} aria-hidden="true" />
                        Safe
                      </span>
                    ) : infoOnly ? (
                      <span className="lozenge lozenge-information">
                        <Info size={12} aria-hidden="true" />
                        For information
                      </span>
                    ) : (
                      <span className="lozenge lozenge-warning">
                        <TriangleAlert size={12} aria-hidden="true" />
                        Review first
                      </span>
                    )}
                    <span className="junk-total">
                      <b className="mono">{formatBytes(c.total)}</b>
                      <span className="hud-stat">{plural(c.totalItems, "item", "items")}</span>
                    </span>
                  </header>
                  {shown.map((item) => {
                    const { dir, name } = splitPath(item.path);
                    const checked = selected.has(item.id);
                    return (
                      <div key={item.id} className={cx("dup-file", checked && "is-selected")}>
                        <label className="dup-check">
                          {!infoOnly && (
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => setMany([item.id], !checked)}
                              aria-label={`Select ${item.path}`}
                            />
                          )}
                          <EntryIcon name={name} kind={item.kind} />
                          <span className="dup-file-text">
                            <span className="dup-file-name">{name}</span>
                            <span className="dup-file-dir">{"‎" + dir}</span>
                          </span>
                        </label>
                        <span className="hud-stat">
                          {item.kind === "file" ? formatDate(item.modified) : plural(item.files, "file", "files")}
                        </span>
                        <span className="junk-size mono">{formatBytes(item.size)}</span>
                        <IconButton
                          icon={FolderSearch}
                          label="Show in Explorer"
                          spacing="compact"
                          onClick={() => onReveal(item.path)}
                        />
                      </div>
                    );
                  })}
                  {c.items.length > PREVIEW && (
                    <button className="junk-more" onClick={() => toggleExpanded(c.key)} aria-expanded={open}>
                      <ChevronDown size={14} aria-hidden="true" style={{ transform: open ? "rotate(180deg)" : undefined }} />
                      {open ? "Show fewer" : `Show all ${c.items.length.toLocaleString()}`}
                      {c.totalItems > c.items.length && ` (largest ${c.items.length} of ${c.totalItems.toLocaleString()})`}
                    </button>
                  )}
                </article>
              );
            })}
          </div>

          <footer className={cx("dup-footer", selected.size > 0 && "is-active")}>
            <span>
              {selected.size > 0 ? (
                <>
                  <b>{plural(selected.size, "item", "items")}</b> selected · frees about{" "}
                  <b className="mono">{formatBytes(selectedBytes)}</b>
                </>
              ) : (
                "Tick what you want gone. Nothing is removed until you confirm."
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
              <Button appearance="danger" iconBefore={Trash2} disabled={selected.size === 0} onClick={() => setConfirming(true)}>
                Move to Recycle Bin
              </Button>
            </div>
          </footer>
        </>
      )}

      {confirming && (
        <ConfirmBulk
          ids={[...selected]}
          bytes={selectedBytes}
          paths={[...selected].slice(0, 5).map((id) => itemById.get(id)?.path ?? "")}
          busy={busy}
          note={
            <>
              Files a program is still using are skipped and listed afterwards.
            </>
          }
          onConfirm={recycle}
          onDeletePermanently={allowPermanentDelete ? deletePermanently : undefined}
          onClose={() => !busy && setConfirming(false)}
        />
      )}
    </section>
  );
}
