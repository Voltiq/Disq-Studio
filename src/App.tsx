import { useCallback, useEffect, useRef, useState } from "react";
import { open as pickFolder } from "@tauri-apps/plugin-dialog";
import { openPath, revealItemInDir } from "@tauri-apps/plugin-opener";
import {
  ArrowLeft,
  ArrowUp,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  ArrowLeftRight,
  Copy,
  ChartPie,
  Download,
  History as HistoryIcon,
  Check,
  ExternalLink,
  FolderSearch,
  House,
  LayoutGrid,
  Monitor,
  Moon,
  PanelRight,
  Settings,
  ShoppingBasket,
  SlidersHorizontal,
  Undo2,
  RefreshCw,
  RotateCw,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  X,
  ZoomIn,
} from "lucide-react";
import {
  api,
  errorText,
  loadSizeMode,
  onOpenPath,
  onScanDone,
  onScanProgress,
  saveSizeMode,
  SIZE_MODE_LABEL,
} from "./lib/api";
import { CATEGORIES, CATEGORY_LABEL, CATEGORY_VAR, type Category } from "./lib/fileTypes";
import { loadColumns, saveColumns, MAX_PANEL, MIN_PANEL, type ColumnLayout } from "./lib/columns";
import { AGE_BUCKETS } from "./lib/mapStyle";
import { formatBytes, formatElapsed, plural } from "./lib/format";
import {
  applyTheme,
  loadThemePreference,
  resolveTheme,
  saveThemePreference,
  watchSystemTheme,
  type Theme,
} from "./lib/theme";
import type {
  CompareSummary,
  SnapshotMeta,
  Entry,
  LinkReport,
  FilterHit,
  FilterSummary,
  NodeInfo,
  RecycleReport,
  ScanDone,
  ScanProgress,
  SizeMode,
  ThemePreference,
  Volume,
} from "./lib/types";
import { cx, isEditableTarget } from "./lib/utils";
import { setDecimalUnits } from "./lib/format";
import { applyAccent, loadPrefs, savePrefs, type Prefs } from "./lib/settings";
import { SettingsDialog } from "./components/SettingsDialog";
import { Cleanup } from "./components/Cleanup";
import { Basket } from "./components/Basket";
import { Changes } from "./components/Changes";
import { ExportDialog } from "./components/ExportDialog";
import { HistoryDialog } from "./components/HistoryDialog";
import { formatDateTime } from "./lib/format";
import { findUpdateQuietly, installUpdate } from "./lib/updates";
import { ConfirmBulk } from "./components/ConfirmBulk";
import type { BasketItem } from "./components/Duplicates";
import { ConfirmRecycle } from "./components/ConfirmRecycle";
import { Sunburst } from "./components/Sunburst";
import { Duplicates } from "./components/Duplicates";
import { FilterBar } from "./components/FilterBar";
import { EMPTY_FILTER, isActive, toQuery, type FilterState } from "./lib/filterState";
import { FolderList } from "./components/FolderList";
import { Home } from "./components/Home";
import { Inspector } from "./components/Inspector";
import { ScanScreen } from "./components/ScanScreen";
import { Treemap } from "./components/Treemap";
import { Button, IconButton } from "./components/ui/Button";
import { Menu, type MenuRequest } from "./components/ui/Menu";
import { TooltipLayer } from "./components/ui/Tooltip";

type Screen = "home" | "scanning" | "results";

interface Toast {
  kind: "success" | "error";
  title: string;
  description?: string;
  /** A button in the toast, such as "Undo". */
  action?: { label: string; onClick: () => void };
}

/** Several items waiting for the Recycle Bin confirmation. */
interface BulkRequest {
  ids: number[];
  bytes: number;
  paths: string[];
  note?: string;
}

/** For a snapshot: the menu without anything that changes the drive. */
function lookOnly(menu: MenuRequest): MenuRequest {
  const changes = /Recycle Bin|basket|Refresh|reading it again/;
  const items = menu.items.filter((i) => !("label" in i) || i.type === "heading" || !changes.test(i.label));
  // No separator left dangling at the end.
  while (items.length && items[items.length - 1].type === "separator") items.pop();
  return { ...menu, items };
}

/** Leaves out items inside another of them: they go with that one. */
function outermost(infos: NodeInfo[]): NodeInfo[] {
  const ids = new Set(infos.map((i) => i.id));
  return infos.filter((i) => i.id !== 0 && !i.ancestors.slice(0, -1).some((a) => ids.has(a.id)));
}

function bulkOf(infos: NodeInfo[]): BulkRequest {
  const items = outermost(infos);
  const largest = [...items].sort((a, b) => b.allocated - a.allocated);
  return {
    ids: items.map((i) => i.id),
    bytes: items.reduce((s, i) => s + Math.max(i.allocated, i.logical - i.online), 0),
    paths: largest.slice(0, 6).map((i) => i.path),
  };
}

const THEME_ORDER: ThemePreference[] = ["dark", "light", "system"];
const THEME_ICON = { dark: Moon, light: Sun, system: Monitor };
const THEME_LABEL = { dark: "Theme: dark", light: "Theme: light", system: "Theme: follow Windows" };

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [volumes, setVolumes] = useState<Volume[] | null>(null);
  const [scanPath, setScanPath] = useState("");
  const [expectedBytes, setExpectedBytes] = useState<number | null>(null);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [root, setRoot] = useState<Entry | null>(null);
  const [scanStats, setScanStats] = useState<{ elapsedMs: number; errors: number; excluded: number; fromMft: boolean } | null>(null);
  /** Running as administrator: every folder is readable, and drives are read from their file table. */
  const [elevated, setElevated] = useState(false);
  /** The folder being rescanned in place, if any. */
  const [refreshingId, setRefreshingId] = useState<number | null>(null);

  const [folderId, setFolderId] = useState(0);
  const [folder, setFolder] = useState<NodeInfo | null>(null);
  /** Everything selected, in the order picked; the last one is what the details panel shows. */
  const [selected, setSelected] = useState<number[]>([]);
  const selectedId = selected.length ? selected[selected.length - 1] : null;
  const setSelectedId = useCallback((id: number | null) => setSelected(id == null ? [] : [id]), []);
  const toggleSelected = useCallback(
    (id: number) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id])),
    [],
  );
  const [columns, setColumns] = useState<ColumnLayout>(loadColumns);
  const updateColumns = useCallback((next: ColumnLayout) => {
    setColumns(next);
    saveColumns(next);
  }, []);
  const [history, setHistory] = useState<number[]>([]);
  const [version, setVersion] = useState(0);
  /** Bumped when files change under the duplicate finder: a new scan, or a delete from the map. */
  const [dataVersion, setDataVersion] = useState(0);
  const [view, setView] = useState<"map" | "duplicates" | "cleanup" | "changes">("map");
  /** The scan in view was opened from a snapshot: look only, nothing is deleted from it. */
  const [snapshotView, setSnapshotView] = useState<SnapshotMeta | null>(null);
  /** Comparing the scan in view with a snapshot. */
  const [comparing, setComparing] = useState<{ path: string; summary: CompareSummary } | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const readOnly = !!snapshotView;
  const [showInspector, setShowInspector] = useState(true);
  /** Bumped by each finished scan; a new scan needs the filter sent again. */
  const [scanCount, setScanCount] = useState(0);
  const [filter, setFilter] = useState<FilterState>(EMPTY_FILTER);
  const [filterSummary, setFilterSummary] = useState<FilterSummary | null>(null);
  const [filtering, setFiltering] = useState(false);
  const filterInputRef = useRef<HTMLInputElement>(null);
  const filterSeq = useRef(0);
  const filterOn = isActive(filter);

  const [themePref, setThemePref] = useState<ThemePreference>(loadThemePreference);
  const [theme, setTheme] = useState<Theme>(() => resolveTheme(loadThemePreference()));
  const [sizeMode, setSizeMode] = useState<SizeMode>(loadSizeMode);
  const [prefs, setPrefs] = useState<Prefs>(() => {
    // Apply before the first paint, so numbers and colours don't change after it.
    const p = loadPrefs();
    setDecimalUnits(p.units === "decimal");
    applyAccent(p.accent);
    return p;
  });
  const [showSettings, setShowSettings] = useState(false);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  const updatePrefs = useCallback((next: Prefs) => {
    setPrefs(next);
    savePrefs(next);
    applyAccent(next.accent);
    setDecimalUnits(next.units === "decimal");
    // Sizes are formatted while rendering, so a units change needs everything redrawn.
    setVersion((v) => v + 1);
  }, []);
  const [menu, setMenu] = useState<MenuRequest | null>(null);
  const [recycleItem, setRecycleItem] = useState<NodeInfo | null>(null);
  const [recycling, setRecycling] = useState(false);
  const [bulk, setBulk] = useState<BulkRequest | null>(null);
  /** Collected for one recycle; kept by path, so it survives rescans and refreshes. */
  const [basket, setBasket] = useState<BasketItem[]>([]);
  const [showBasket, setShowBasket] = useState(false);
  /** Files picked out on the map (duplicates), everything else dimmed. */
  const [highlight, setHighlight] = useState<{ ids: Set<number>; label: string } | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  const generation = useRef(0);
  /** Where to return after a rescan of the same place: paths, as ids change between scans. */
  const restorePlace = useRef<{ folder: string | null; selected: string | null } | null>(null);

  const showError = useCallback((message: string) => {
    setToast({ kind: "error", title: "Something went wrong", description: message });
  }, []);

  // ----- Theme -----

  useEffect(() => {
    applyTheme(themePref).then(setTheme);
    saveThemePreference(themePref);
    if (themePref !== "system") return;
    return watchSystemTheme(() => applyTheme("system").then(setTheme));
  }, [themePref]);

  // ----- Drives -----

  const refreshVolumes = useCallback(() => {
    setVolumes(null);
    api.listVolumes().then(setVolumes).catch((err) => showError(errorText(err)));
  }, [showError]);

  useEffect(refreshVolumes, [refreshVolumes]);

  useEffect(() => {
    api.isElevated().then(setElevated).catch(() => {});
  }, []);

  // A newer version: offer it once, without getting in the way.
  useEffect(() => {
    findUpdateQuietly().then((update) => {
      if (!update) return;
      setToast({
        kind: "success",
        title: `Disq Studio ${update.version} is available`,
        description: "It installs in a moment, then Disq Studio starts again. Or later, from Settings › Updates.",
        action: {
          label: "Install and restart",
          onClick: () => installUpdate(update).catch((e) => showError(errorText(e))),
        },
      });
    });
  }, [showError]);

  // ----- Size mode -----

  // Tells the backend on start and on every change; the tree re-sorts in place.
  useEffect(() => {
    saveSizeMode(sizeMode);
    api
      .setSizeMode(sizeMode)
      .then((newRoot) => {
        if (!newRoot) return;
        setRoot(newRoot);
        setVersion((v) => v + 1);
        refreshFilter();
        // The comparison's totals are in the size mode too.
        setComparing((c) => {
          if (c) api.compareWith(c.path).then((summary) => setComparing({ path: c.path, summary })).catch(() => {});
          return c;
        });
      })
      .catch((err) => showError(errorText(err)));
    // refreshFilter only reads refs and setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sizeMode, showError]);

  // ----- Filter -----

  // Sends the filter shortly after the last change (so typing doesn't fire a
  // query per key), and again after each new scan.
  useEffect(() => {
    if (!scanCount) return;
    const seq = ++filterSeq.current;
    const timer = window.setTimeout(async () => {
      setFiltering(true);
      try {
        const result = await api.setFilter(toQuery(filter));
        if (seq !== filterSeq.current) return;
        setRoot(result.root);
        setFilterSummary(result.summary);
        setVersion((v) => v + 1);
      } catch (err) {
        showError(errorText(err));
      } finally {
        if (seq === filterSeq.current) setFiltering(false);
      }
    }, 200);
    return () => window.clearTimeout(timer);
  }, [filter, scanCount, showError]);

  /** Re-reads the filter's matches after sizes changed underneath it. */
  const refreshFilter = useCallback(() => {
    api
      .filterResults()
      .then((result) => {
        setRoot(result.root);
        setFilterSummary(result.summary);
      })
      .catch(() => {});
  }, []);

  // ----- Scanning -----

  /** The last scan whose result was applied, so the event and the check after starting can't both apply it. */
  const handledGeneration = useRef(0);

  // Applies a finished scan. Reached two ways: the `scan-done` event, or asking
  // right after starting, for scans that finish before the event can be heard.
  const handleScanDone = useRef<(d: ScanDone) => void>(() => {});
  handleScanDone.current = (d: ScanDone) => {
    if (d.generation !== generation.current || d.generation === handledGeneration.current) return;
    handledGeneration.current = d.generation;
    {
      if (d.status === "done" && d.root) {
        setRoot(d.root);
        setScanStats({ elapsedMs: d.elapsedMs, errors: d.errors, excluded: d.excluded, fromMft: d.fromMft });
        setFolderId(0);
        setSelectedId(null);
        setHistory([]);
        setVersion((v) => v + 1);
        setDataVersion((v) => v + 1);
        setScanCount((v) => v + 1);
        setHighlight(null);
        setSnapshotView(null);
        setComparing(null);
        setView((v) => (v === "changes" ? "map" : v));
        setScreen("results");
        // Free space for the map's free-space block, as it is now.
        api.listVolumes().then(setVolumes).catch(() => {});
        // Kept for History; quietly, as it's a convenience.
        if (prefsRef.current.keepHistory) api.saveSnapshot(null).catch(() => {});
        // After a rescan, go back to where the user was, if it still exists.
        const place = restorePlace.current;
        restorePlace.current = null;
        if (place) {
          Promise.all([
            place.folder ? api.findPath(place.folder) : null,
            place.selected ? api.findPath(place.selected) : null,
          ])
            .then(([folder, selected]) => {
              if (generation.current !== d.generation) return;
              if (folder != null) setFolderId(folder);
              if (selected != null) setSelectedId(selected);
            })
            .catch(() => {});
        }
      } else {
        setScreen((s) => (s === "scanning" ? (root ? "results" : "home") : s));
      }
    }
  };

  useEffect(() => {
    const progressSub = onScanProgress((p) => {
      if (p.generation === generation.current) setProgress(p);
    });
    const doneSub = onScanDone((d) => handleScanDone.current(d));
    return () => {
      progressSub.then((un) => un());
      doneSub.then((un) => un());
    };
  }, []);

  const startScan = useCallback(
    async (path: string) => {
      // Rescanning the same place: remember where the user was, by path, since ids change.
      restorePlace.current = null;
      if (screen === "results" && path === scanPath && folder) {
        const selected = selectedId != null ? await api.nodeInfo(selectedId).catch(() => null) : null;
        restorePlace.current = { folder: folder.id === 0 ? null : folder.path, selected: selected?.path ?? null };
      }
      const volume = volumes?.find((v) => v.path.toLowerCase() === path.toLowerCase());
      setExpectedBytes(volume ? volume.total - volume.free : null);
      setScanPath(path);
      setProgress(null);
      setScreen("scanning");
      try {
        const gen = await api.startScan(path, prefsRef.current.excludes);
        generation.current = gen;
        // A small folder can finish before this point, its `scan-done` already gone by.
        const finished = await api.scanResult(gen);
        if (finished) handleScanDone.current(finished);
      } catch (err) {
        setScreen(root ? "results" : "home");
        showError(errorText(err));
      }
    },
    [volumes, root, showError, screen, scanPath, folder, selectedId],
  );

  const cancelScan = useCallback(() => {
    api.cancelScan();
    setScreen(root ? "results" : "home");
  }, [root]);

  // Started from Explorer's "Analyze with Disq Studio": scan that folder right away.
  const checkedStartupPath = useRef(false);
  useEffect(() => {
    if (checkedStartupPath.current) return;
    checkedStartupPath.current = true;
    api
      .startupPath()
      .then((path) => {
        if (path) startScan(path);
      })
      .catch(() => {});
  }, [startScan]);

  // "Analyze with Disq Studio" while the app is already open: the folder arrives here instead.
  const startScanRef = useRef(startScan);
  startScanRef.current = startScan;
  useEffect(() => {
    const sub = onOpenPath((path) => {
      setView("map");
      startScanRef.current(path);
    });
    return () => {
      sub.then((un) => un());
    };
  }, []);

  /** Rescans one folder and puts it in place, keeping the rest of the scan. */
  const refreshFolder = useCallback(
    async (id: number) => {
      if (refreshingId != null) return;
      setRefreshingId(id);
      try {
        const before = await api.nodeInfo(id);
        const result = await api.refreshFolder(id, prefsRef.current.excludes);
        // Everything inside the folder got new ids; step back out to it if needed.
        if (folder && folder.id !== id && folder.ancestors.some((a) => a.id === id)) setFolderId(id);
        setSelectedId(null);
        setHistory([]);
        setRoot(result.root);
        setScanStats((s) => s && { ...s, errors: result.errors });
        setVersion((v) => v + 1);
        setDataVersion((v) => v + 1);
        refreshFilter();
        const after = await api.nodeInfo(id);
        const change = after.size - before.size;
        setToast({
          kind: "success",
          title: `Refreshed ${before.name}`,
          description:
            change === 0
              ? `Still ${formatBytes(after.size)}.`
              : `Now ${formatBytes(after.size)}, ${formatBytes(Math.abs(change))} ${change > 0 ? "more" : "less"} than before.`,
        });
      } catch (err) {
        showError(errorText(err));
      } finally {
        setRefreshingId(null);
      }
    },
    [refreshingId, folder, refreshFilter, showError],
  );

  /** Opens a snapshot to look around in, in place of the scan in view. */
  const openSnapshot = useCallback(
    async (path: string) => {
      try {
        const r = await api.openSnapshot(path);
        setShowHistory(false);
        setRoot(r.root);
        setScanPath(r.meta.root);
        setScanStats({ elapsedMs: 0, errors: r.errors, excluded: 0, fromMft: r.meta.fromMft });
        setFolderId(0);
        setSelectedId(null);
        setHistory([]);
        setHighlight(null);
        setComparing(null);
        setSnapshotView(r.meta);
        setView("map");
        setVersion((v) => v + 1);
        setDataVersion((v) => v + 1);
        setScanCount((v) => v + 1);
        setScreen("results");
      } catch (err) {
        showError(errorText(err));
      }
    },
    [showError],
  );

  /** Compares the scan in view with a snapshot, in the Changes view. */
  const compareWith = useCallback(
    async (path: string) => {
      try {
        const summary = await api.compareWith(path);
        setComparing({ path, summary });
        setShowHistory(false);
        setView("changes");
      } catch (err) {
        showError(errorText(err));
      }
    },
    [showError],
  );

  const stopComparing = useCallback(() => {
    api.compareClose().catch(() => {});
    setComparing(null);
    setView("map");
  }, []);

  /** Shows an item of the scan on the map: a folder by going into it, a file in its folder. */
  const showOnMap = useCallback(
    (id: number) => {
      api
        .nodeInfo(id)
        .then((info) => {
          setView("map");
          const isDir = info.kind === "dir" || info.kind === "denied";
          const target = isDir ? info.id : info.ancestors[info.ancestors.length - 2]?.id ?? 0;
          setHistory((h) => [...h, folderId]);
          setFolderId(target);
          setSelectedId(isDir ? null : info.id);
        })
        .catch((e) => showError(errorText(e)));
    },
    [folderId, showError, setSelectedId],
  );

  /** Restarts as administrator, opening the same location; this window closes if the user agrees. */
  const relaunchAsAdmin = useCallback(async () => {
    try {
      const restarted = await api.relaunchAsAdmin(screen === "results" ? scanPath : null);
      if (!restarted) {
        setToast({ kind: "error", title: "Still running normally", description: "Windows didn't get permission to restart Disq Studio as administrator." });
      }
    } catch (err) {
      showError(errorText(err));
    }
  }, [screen, scanPath, showError]);

  const chooseFolder = useCallback(async () => {
    const picked = await pickFolder({ directory: true, title: "Choose a folder to scan" });
    if (typeof picked === "string") startScan(picked);
  }, [startScan]);

  // ----- Navigation -----

  useEffect(() => {
    if (screen !== "results") return;
    let stale = false;
    api
      .nodeInfo(folderId)
      .then((info) => !stale && setFolder(info))
      .catch((err) => !stale && showError(errorText(err)));
    return () => {
      stale = true;
    };
  }, [folderId, version, screen, showError]);

  const navigateTo = useCallback(
    (id: number) => {
      if (id === folderId) return;
      setHistory((h) => [...h, folderId]);
      setFolderId(id);
      setSelectedId(null);
    },
    [folderId],
  );

  const goUp = useCallback(() => {
    if (!folder || folder.ancestors.length < 2) return;
    const parent = folder.ancestors[folder.ancestors.length - 2].id;
    setHistory((h) => [...h, folderId]);
    setFolderId(parent);
    setSelectedId(folderId);
  }, [folder, folderId]);

  const goBack = useCallback(() => {
    setHistory((h) => {
      if (!h.length) return h;
      setFolderId(h[h.length - 1]);
      setSelectedId(null);
      return h.slice(0, -1);
    });
  }, []);

  /** Shows a match: a folder by going into it, a file by selecting it in its folder. */
  const pickMatch = useCallback(
    (hit: FilterHit) => {
      const isDir = hit.kind === "dir" || hit.kind === "denied";
      const target = isDir ? hit.id : hit.parent;
      if (target !== folderId) {
        setHistory((h) => [...h, folderId]);
        setFolderId(target);
      }
      setSelectedId(isDir ? null : hit.id);
    },
    [folderId],
  );

  const openEntry = useCallback(
    (entry: Entry) => {
      if (entry.kind === "dir" && entry.hasChildren) navigateTo(entry.id);
      else if (entry.kind === "file") api.nodeInfo(entry.id).then((i) => openPath(i.path)).catch((e) => showError(errorText(e)));
    },
    [navigateTo, showError],
  );

  // ----- Actions on items -----

  const reveal = useCallback(
    (path: string) => revealItemInDir(path).catch((e) => showError(errorText(e))),
    [showError],
  );
  const openFile = useCallback(
    (path: string) => openPath(path).catch((e) => showError(errorText(e))),
    [showError],
  );

  const askRecycle = useCallback(
    (id: number) => {
      if (id === 0) return;
      api.nodeInfo(id).then(setRecycleItem).catch((e) => showError(errorText(e)));
    },
    [showError],
  );

  /** Asks before recycling several items; one item gets the usual single-item confirmation. */
  const askRecycleMany = useCallback(
    (infos: NodeInfo[]) => {
      const request = bulkOf(infos);
      if (request.ids.length === 1) setRecycleItem(infos.find((i) => i.id === request.ids[0]) ?? null);
      else if (request.ids.length) setBulk(request);
    },
    [],
  );

  const askRecycleIds = useCallback(
    (ids: number[]) => {
      Promise.all(ids.map((id) => api.nodeInfo(id)))
        .then(askRecycleMany)
        .catch((e) => showError(errorText(e)));
    },
    [askRecycleMany, showError],
  );

  /** Every match of the filter, without anything that doesn't match. */
  const askRecycleMatches = useCallback(async () => {
    try {
      const sel = await api.filterSelection();
      if (!sel.ids.length) return;
      setBulk({
        ids: sel.ids,
        bytes: sel.bytes,
        paths: sel.paths,
        note: `${plural(sel.files, "matching file", "matching files")}. A folder goes as a whole only when everything in it matches; elsewhere just the matching files go, and nothing that doesn't match is touched.`,
      });
    } catch (err) {
      showError(errorText(err));
    }
  }, [showError]);

  /** Takes out of the basket whatever is no longer in the scan. */
  const pruneBasket = useCallback(() => {
    setBasket((items) => {
      if (items.length) {
        Promise.all(items.map((i) => api.findPath(i.path).catch(() => null))).then((ids) => {
          const gone = new Set(items.filter((_, k) => ids[k] == null).map((i) => i.path));
          if (gone.size) setBasket((now) => now.filter((i) => !gone.has(i.path)));
        });
      }
      return items;
    });
  }, []);

  const addToBasket = useCallback((items: BasketItem[]) => {
    setBasket((now) => {
      const have = new Set(now.map((i) => i.path.toLowerCase()));
      const added = items.filter((i) => !have.has(i.path.toLowerCase()));
      const next = [...now, ...added];
      setToast({
        kind: "success",
        title: added.length ? `Added ${plural(added.length, "item", "items")} to the basket` : "Already in the basket",
        description: `The basket holds ${plural(next.length, "item", "items")}, ${formatBytes(next.reduce((s, i) => s + i.size, 0))} on disk.`,
        action: { label: "Open basket", onClick: () => setShowBasket(true) },
      });
      return next;
    });
  }, []);

  /** Puts back what the last recycle moved to the Recycle Bin. */
  const undoRecycle = useCallback(async () => {
    try {
      const r = await api.undoRecycle();
      setRoot(r.root);
      setScanStats((s) => s && { ...s, errors: r.errors });
      setVersion((v) => v + 1);
      setDataVersion((v) => v + 1);
      refreshFilter();
      api.listVolumes().then(setVolumes).catch(() => {});
      setToast({
        kind: r.restored ? "success" : "error",
        title: r.restored ? `Restored ${plural(r.restored, "item", "items")}` : "Nothing was restored",
        description: r.missing
          ? `${plural(r.missing, "item wasn't", "items weren't")} in the Recycle Bin any more.`
          : "Everything is back where it was.",
      });
    } catch (err) {
      showError(errorText(err));
    }
  }, [refreshFilter, showError]);

  /** Takes in the result of any delete and says plainly what happened. */
  const applyReport = useCallback(
    (report: RecycleReport, staleDuplicates: boolean) => {
      setRoot(report.root);
      setSelectedId(null);
      setVersion((v) => v + 1);
      if (staleDuplicates) setDataVersion((v) => v + 1);
      refreshFilter();
      pruneBasket();
      api.listVolumes().then(setVolumes).catch(() => {});

      const moved = report.done.length - report.permanent;
      const lines: string[] = [];
      if (report.done.length) lines.push(`${formatBytes(report.freed)} freed${moved ? " once the Recycle Bin is emptied" : ""}.`);
      if (report.permanent) lines.push(`${plural(report.permanent, "item was", "items were")} deleted permanently, as you chose.`);
      if (report.kept.length)
        lines.push(`${plural(report.kept.length, "item was", "items were")} kept: Windows would have deleted ${report.kept.length === 1 ? "it" : "them"} permanently.`);
      if (report.failed.length) {
        const some = report.failed.slice(0, 2).map((f) => f.path).join(", ");
        lines.push(
          `${plural(report.failed.length, "item was", "items were")} skipped, most likely because a program is using ${report.failed.length === 1 ? "it" : "them"}: ${some}${report.failed.length > 2 ? "…" : ""}`,
        );
      }
      setToast({
        kind: report.done.length ? "success" : "error",
        title: report.done.length
          ? moved
            ? `Moved ${plural(moved, "item", "items")} to the Recycle Bin`
            : `Deleted ${plural(report.permanent, "item", "items")} permanently`
          : "Nothing was removed",
        description: lines.join(" "),
        action: moved > 0 ? { label: "Undo", onClick: undoRecycle } : undefined,
      });
    },
    [refreshFilter, setSelectedId, pruneBasket, undoRecycle],
  );

  /** After duplicates were replaced with hard links. */
  const applyLinkReport = useCallback(
    (report: LinkReport) => {
      setRoot(report.root);
      setVersion((v) => v + 1);
      refreshFilter();
      api.listVolumes().then(setVolumes).catch(() => {});
      const some = report.failed.slice(0, 2).map((f) => `${f.path}: ${f.error}`).join("; ");
      setToast({
        kind: report.done.length ? "success" : "error",
        title: report.done.length
          ? `Replaced ${plural(report.done.length, "copy", "copies")} with links`
          : "Nothing was replaced",
        description: [
          report.done.length ? `${formatBytes(report.freed)} freed. Every file still opens under its own name.` : "",
          report.failed.length ? `${plural(report.failed.length, "copy was", "copies were")} skipped: ${some}${report.failed.length > 2 ? "…" : ""}` : "",
        ]
          .filter(Boolean)
          .join(" "),
      });
    },
    [refreshFilter],
  );

  /** Collects the basket's items as they are in the scan now, and asks before recycling them. */
  const recycleBasket = useCallback(async () => {
    const ids = await Promise.all(basket.map((i) => api.findPath(i.path).catch(() => null)));
    const found = basket.filter((_, k) => ids[k] != null);
    setShowBasket(false);
    if (!found.length) {
      setBasket([]);
      showError("Nothing in the basket is in the scan any more.");
      return;
    }
    setBasket(found);
    const largest = [...found].sort((a, b) => b.size - a.size);
    setBulk({
      ids: ids.filter((id): id is number => id != null),
      bytes: found.reduce((s, i) => s + i.size, 0),
      paths: largest.slice(0, 6).map((i) => i.path),
      note: "What goes is taken out of the basket.",
    });
  }, [basket, showError]);

  const confirmBulk = useCallback(
    async (allowPermanent: boolean) => {
      if (!bulk) return;
      setRecycling(true);
      try {
        const report = await api.recycleEach(bulk.ids, allowPermanent);
        // If the folder in view was inside something removed, step out above it.
        if (folder) {
          const gone = new Set(report.done);
          const i = folder.ancestors.findIndex((a) => gone.has(a.id));
          if (i >= 0) setFolderId(folder.ancestors[Math.max(0, i - 1)].id);
        }
        applyReport(report, true);
        setBulk(null);
      } catch (err) {
        showError(errorText(err));
      } finally {
        setRecycling(false);
      }
    },
    [bulk, folder, applyReport, showError],
  );

  /** Deletes for good: what `confirmBulk` and `confirmRecycle` do, past the Recycle Bin. */
  const deletePermanently = useCallback(
    async (ids: number[], ancestorsOf: NodeInfo | null) => {
      setRecycling(true);
      try {
        const report = await api.deleteEach(ids);
        if (folder) {
          const gone = new Set(report.done);
          const i = folder.ancestors.findIndex((a) => gone.has(a.id));
          if (i >= 0) setFolderId(folder.ancestors[Math.max(0, i - 1)].id);
        } else if (ancestorsOf) {
          setFolderId(ancestorsOf.ancestors[ancestorsOf.ancestors.length - 2]?.id ?? 0);
        }
        applyReport(report, true);
        setBulk(null);
        setRecycleItem(null);
      } catch (err) {
        showError(errorText(err));
      } finally {
        setRecycling(false);
      }
    },
    [folder, applyReport, showError],
  );

  const confirmRecycle = useCallback(
    async (allowPermanent: boolean) => {
      if (!recycleItem) return;
      setRecycling(true);
      try {
        const report = await api.recycleEach([recycleItem.id], allowPermanent);
        // If the folder in view was inside what got removed, step out of it.
        const removedId = recycleItem.id;
        if (report.done.includes(removedId) && folder?.ancestors.some((a) => a.id === removedId)) {
          setFolderId(recycleItem.ancestors[recycleItem.ancestors.length - 2]?.id ?? 0);
        }
        applyReport(report, true);
        setRecycleItem(null);
      } catch (err) {
        showError(errorText(err));
      } finally {
        setRecycling(false);
      }
    },
    [recycleItem, folder, showError, applyReport],
  );

  const openContextMenu = useCallback(
    (id: number, x: number, y: number) => {
      // Right-clicking inside a multi-selection acts on all of it.
      if (selected.length > 1 && selected.includes(id)) {
        const ids = selected;
        setMenu({
          x,
          y,
          items: [
            { type: "heading", label: plural(ids.length, "item selected", "items selected") },
            {
              label: "Copy paths",
              icon: Copy,
              onSelect: () =>
                Promise.all(ids.map((i) => api.nodeInfo(i)))
                  .then((infos) => navigator.clipboard.writeText(infos.map((i) => i.path).join("\r\n")))
                  .catch((e) => showError(errorText(e))),
            },
            { label: "Clear selection", icon: X, shortcut: "Esc", onSelect: () => setSelectedId(null) },
            {
              label: "Add to basket",
              icon: ShoppingBasket,
              onSelect: () =>
                Promise.all(ids.map((i) => api.nodeInfo(i)))
                  .then((infos) =>
                    addToBasket(
                      infos.map((i) => ({
                        id: i.id,
                        path: i.path,
                        size: Math.max(i.allocated, i.logical - i.online),
                        kind: i.kind === "file" ? "file" : "dir",
                      })),
                    ),
                  )
                  .catch((e) => showError(errorText(e))),
            },
            { type: "separator" },
            {
              label: `Move ${plural(ids.length, "item", "items")} to Recycle Bin`,
              icon: Trash2,
              shortcut: "Del",
              danger: true,
              onSelect: () => askRecycleIds(ids),
            },
          ],
        });
        return;
      }
      api
        .nodeInfo(id)
        .then((info) => {
          const isDir = info.kind === "dir";
          setMenu({
            x,
            y,
            items: [
              ...(isDir
                ? [
                    { label: "Zoom in", icon: ZoomIn, shortcut: "Enter", onSelect: () => navigateTo(id) },
                    { label: "Refresh this folder", icon: RotateCw, onSelect: () => refreshFolder(id) },
                  ]
                : info.kind === "denied"
                  ? [{ label: "Try reading it again", icon: RotateCw, onSelect: () => refreshFolder(id) }]
                  : [{ label: "Open", icon: ExternalLink, onSelect: () => openFile(info.path) }]),
              { label: "Show in Explorer", icon: FolderSearch, onSelect: () => reveal(info.path) },
              {
                label: "Copy path",
                icon: Copy,
                shortcut: "Ctrl+Shift+C",
                onSelect: () => navigator.clipboard.writeText(info.path),
              },
              {
                label: "Add to basket",
                icon: ShoppingBasket,
                disabled: id === 0,
                onSelect: () =>
                  addToBasket([
                    {
                      id: info.id,
                      path: info.path,
                      size: Math.max(info.allocated, info.logical - info.online),
                      kind: info.kind === "file" ? "file" : "dir",
                    },
                  ]),
              },
              { type: "separator" },
              {
                label: "Move to Recycle Bin",
                icon: Trash2,
                shortcut: "Del",
                danger: true,
                disabled: id === 0,
                onSelect: () => setRecycleItem(info),
              },
            ],
          });
        })
        .catch((e) => showError(errorText(e)));
    },
    [navigateTo, openFile, reveal, refreshFolder, showError, selected, setSelectedId, askRecycleIds, addToBasket],
  );

  /** A legend entry clicked: show only that file type (or add it to those shown). */
  const toggleCategory = useCallback((c: Category) => {
    setFilter((f) => ({
      ...f,
      categories: f.categories.includes(c) ? f.categories.filter((x) => x !== c) : [...f.categories, c],
    }));
  }, []);

  const openMapOptions = useCallback(
    (anchor: HTMLElement) => {
      const p = prefsRef.current;
      setMenu({
        anchor,
        align: "end",
        items: [
          { type: "heading", label: "Colour files by" },
          { label: "File type", icon: p.colorBy === "type" ? Check : undefined, checked: p.colorBy === "type", onSelect: () => updatePrefs({ ...p, colorBy: "type" }) },
          { label: "Age (last changed)", icon: p.colorBy === "age" ? Check : undefined, checked: p.colorBy === "age", onSelect: () => updatePrefs({ ...p, colorBy: "age" }) },
          { type: "separator" },
          {
            label: "Cushion shading",
            icon: p.cushions ? Check : undefined,
            checked: p.cushions,
            disabled: p.mapView !== "treemap",
            onSelect: () => updatePrefs({ ...p, cushions: !p.cushions }),
          },
        ],
      });
    },
    [updatePrefs],
  );

  // ----- Keyboard -----

  // Tab and Shift+Tab stay inside an open dialog instead of reaching the page behind it.
  useEffect(() => {
    const onTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const dialogs = document.querySelectorAll<HTMLElement>('[aria-modal="true"]');
      const dialog = dialogs[dialogs.length - 1];
      if (!dialog) return;
      const focusable = [
        ...dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((el) => el.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const inside = dialog.contains(document.activeElement);
      if (e.shiftKey && (document.activeElement === first || !inside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !inside)) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onTab);
    return () => window.removeEventListener("keydown", onTab);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (screen === "results" && e.ctrlKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        filterInputRef.current?.focus();
        filterInputRef.current?.select();
        return;
      }
      if (recycleItem || bulk || menu || showBasket || isEditableTarget(e.target)) return;
      if (screen === "results" && e.ctrlKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        api.canUndoRecycle().then((can) => {
          if (can) undoRecycle();
        });
        return;
      }
      if (screen === "scanning" && e.key === "Escape") {
        cancelScan();
        return;
      }
      if (e.ctrlKey && e.key === ",") {
        e.preventDefault();
        setShowSettings(true);
        return;
      }
      if (e.ctrlKey && e.key.toLowerCase() === "o") {
        e.preventDefault();
        chooseFolder();
        return;
      }
      if (screen !== "results") return;
      if (e.ctrlKey && e.key.toLowerCase() === "r") {
        e.preventDefault();
        startScan(scanPath);
      } else if (view !== "map") {
        // The rest act on the map's selection.
        return;
      } else if (e.key === "Backspace" || (e.altKey && e.key === "ArrowUp")) {
        e.preventDefault();
        goUp();
      } else if (e.altKey && e.key === "ArrowLeft") {
        e.preventDefault();
        goBack();
      } else if (e.key === "Delete" && !readOnly && selected.length > 1) {
        e.preventDefault();
        askRecycleIds(selected);
      } else if (e.key === "Delete" && !readOnly && selectedId != null) {
        e.preventDefault();
        askRecycle(selectedId);
      } else if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "c" && selectedId != null) {
        e.preventDefault();
        api.nodeInfo(selectedId).then((i) => navigator.clipboard.writeText(i.path));
      } else if (e.key === "Escape") {
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen, view, recycleItem, bulk, menu, showBasket, selected, selectedId, scanPath, cancelScan, chooseFolder, startScan, goUp, goBack, askRecycle, askRecycleIds, setSelectedId, undoRecycle, readOnly]);

  useEffect(() => {
    if (!toast) return;
    // A toast with a button (Undo) stays long enough to use it.
    const t = window.setTimeout(() => setToast(null), toast.kind === "error" || toast.action ? 9000 : 5000);
    return () => window.clearTimeout(t);
  }, [toast]);

  // ----- Render -----

  const ThemeIcon = THEME_ICON[themePref];
  // A whole drive in view, unfiltered: its free space gets a block of its own.
  const scanVolume = volumes?.find((v) => v.path.toLowerCase() === scanPath.toLowerCase());
  const freeBytes = scanVolume && folderId === 0 && !filterOn ? scanVolume.free : 0;
  const startPanelDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const x0 = e.clientX;
    const w0 = columns.panel;
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const panel = Math.round(Math.min(MAX_PANEL, Math.max(MIN_PANEL, w0 + ev.clientX - x0)));
      setColumns((c) => ({ ...c, panel }));
    };
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      setColumns((c) => {
        saveColumns(c);
        return c;
      });
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  };
  const crumbs = folder?.ancestors ?? [];
  const visibleCrumbs = crumbs.length > 5 ? crumbs.slice(-4) : crumbs;

  return (
    <div className="app">
      <header className={cx("topbar", screen === "results" && "has-results")}>
        <div className="topbar-start">
          <div className="brand">
            <img className="brand-glyph" src="/app-icon.svg" alt="" />
            <span className="brand-name">Disq Studio</span>
            {elevated && (
              <span className="lozenge lozenge-information" data-tooltip="Running as administrator: every folder can be read">
                <ShieldCheck size={12} aria-hidden="true" />
                Admin
              </span>
            )}
          </div>
          {screen === "results" && (
            <>
              <span className="topbar-divider" />
              <IconButton icon={House} label="All drives" onClick={() => setScreen("home")} />
              <div className="segmented" role="tablist" aria-label="View">
                <button
                  className={cx("segment", view === "map" && "is-selected")}
                  role="tab"
                  aria-selected={view === "map"}
                  onClick={() => setView("map")}
                >
                  <LayoutGrid size={14} aria-hidden="true" />
                  Map
                </button>
                <button
                  className={cx("segment", view === "duplicates" && "is-selected")}
                  role="tab"
                  aria-selected={view === "duplicates"}
                  disabled={readOnly}
                  data-tooltip={readOnly ? "Not for a snapshot: scan again to look for duplicates" : undefined}
                  onClick={() => setView("duplicates")}
                >
                  <Copy size={14} aria-hidden="true" />
                  Duplicates
                </button>
                <button
                  className={cx("segment", view === "cleanup" && "is-selected")}
                  role="tab"
                  aria-selected={view === "cleanup"}
                  disabled={readOnly}
                  data-tooltip={readOnly ? "Not for a snapshot: scan again to clean up" : undefined}
                  onClick={() => setView("cleanup")}
                >
                  <Sparkles size={14} aria-hidden="true" />
                  Cleanup
                </button>
                {comparing && (
                  <button
                    className={cx("segment", view === "changes" && "is-selected")}
                    role="tab"
                    aria-selected={view === "changes"}
                    onClick={() => setView("changes")}
                  >
                    <ArrowLeftRight size={14} aria-hidden="true" />
                    Changes
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        <div className="hud" aria-live="polite">
          {screen === "results" && root ? (
            <>
              <span className="hud-path">{scanPath}</span>
              <span className="hud-sep" />
              {filterOn && filterSummary ? (
                <span
                  className="lozenge lozenge-discovery"
                  data-tooltip="A filter is on: the map, lists and totals only count matching files"
                >
                  Filtered · {formatBytes(filterSummary.bytes)} in {plural(filterSummary.files, "file", "files")}
                </span>
              ) : (
                <>
                  <span className="hud-stat">{formatBytes(root.size)}</span>
                  <span className="hud-stat">{plural(root.files, "file", "files")}</span>
                  {scanStats && !snapshotView && <span className="hud-stat">in {formatElapsed(scanStats.elapsedMs)}</span>}
                </>
              )}
              {snapshotView && (
                <span
                  className="lozenge lozenge-discovery"
                  data-tooltip="An earlier scan, opened from History. Nothing can be deleted from it; Rescan to see the drive as it is now."
                >
                  Snapshot · {formatDateTime(snapshotView.scannedAt)}
                </span>
              )}
              {!!root.online && (
                <span
                  className="lozenge lozenge-information"
                  data-tooltip="Online-only cloud files (OneDrive and similar). Their data isn't on this drive; switch to On disk to leave them out."
                >
                  {formatBytes(root.online)} online only
                </span>
              )}
              {!!scanStats?.excluded && (
                <span className="lozenge" data-tooltip="Folders left out by Settings › Folders to skip">
                  {scanStats.excluded.toLocaleString()} excluded
                </span>
              )}
              {scanStats?.fromMft && (
                <span
                  className="lozenge lozenge-success"
                  data-tooltip="Read from the drive's file table in one go. Includes NTFS's own files ($MFT and others) and System Volume Information."
                >
                  File table
                </span>
              )}
              {!!scanStats?.errors &&
                (elevated ? (
                  <span className="lozenge lozenge-warning" data-tooltip="Folders Windows didn't allow to be read, even as administrator. Their sizes aren't counted.">
                    {scanStats.errors.toLocaleString()} skipped
                  </span>
                ) : (
                  <button
                    className="lozenge lozenge-warning lozenge-button"
                    data-tooltip="Folders your account isn't allowed to read; their sizes aren't counted. Click to restart as administrator and read them too."
                    onClick={(e) => {
                      const r = e.currentTarget.getBoundingClientRect();
                      setMenu({
                        x: r.left,
                        y: r.bottom + 4,
                        items: [{ label: "Restart as administrator", icon: ShieldCheck, onSelect: relaunchAsAdmin }],
                      });
                    }}
                  >
                    {scanStats.errors.toLocaleString()} skipped
                  </button>
                ))}
            </>
          ) : screen === "scanning" ? (
            <span>Scanning {scanPath}…</span>
          ) : (
            <span>No scan yet</span>
          )}
        </div>

        <div className="topbar-end">
          {screen === "results" && (
            <>
              <div className="segmented" role="radiogroup" aria-label="Measure sizes by">
                {(["logical", "allocated"] as const).map((mode) => (
                  <button
                    key={mode}
                    className={cx("segment", sizeMode === mode && "is-selected")}
                    role="radio"
                    aria-checked={sizeMode === mode}
                    data-tooltip={
                      mode === "logical"
                        ? "How long each file is, like Explorer's Size column"
                        : "Space actually used on the drive: whole clusters, after compression, without online-only cloud files"
                    }
                    onClick={() => setSizeMode(mode)}
                  >
                    {SIZE_MODE_LABEL[mode]}
                  </button>
                ))}
              </div>
              <Button iconBefore={RefreshCw} shortcut="Ctrl+R" tooltip="Scan this location again" onClick={() => startScan(scanPath)}>
                Rescan
              </Button>
              <IconButton
                icon={HistoryIcon}
                label="History: earlier scans, and what changed since"
                selected={showHistory}
                onClick={() => setShowHistory(true)}
              />
              <IconButton icon={Download} label="Export a report of the folder in view" selected={showExport} onClick={() => setShowExport(true)} />
              <span className="basket-button">
                <IconButton
                  icon={ShoppingBasket}
                  label={basket.length ? `Cleanup basket: ${plural(basket.length, "item", "items")}` : "Cleanup basket"}
                  selected={showBasket}
                  onClick={() => setShowBasket(true)}
                />
                {basket.length > 0 && <span className="badge badge-primary basket-count">{basket.length}</span>}
              </span>
              <IconButton
                icon={PanelRight}
                label={showInspector ? "Hide details" : "Show details"}
                selected={showInspector}
                onClick={() => setShowInspector((s) => !s)}
              />
            </>
          )}
          <IconButton
            icon={ThemeIcon}
            label={THEME_LABEL[themePref]}
            onClick={() => setThemePref((p) => THEME_ORDER[(THEME_ORDER.indexOf(p) + 1) % THEME_ORDER.length])}
          />
          <IconButton
            icon={Settings}
            label="Settings"
            shortcut="Ctrl+,"
            selected={showSettings}
            onClick={() => setShowSettings(true)}
          />
        </div>
      </header>

      {screen === "home" && (
        <Home
          volumes={volumes}
          onScan={startScan}
          onPickFolder={chooseFolder}
          onRefresh={refreshVolumes}
          onHistory={() => setShowHistory(true)}
        />
      )}

      {screen === "scanning" && (
        <ScanScreen
          path={scanPath}
          progress={progress}
          expectedBytes={expectedBytes}
          sizeMode={sizeMode}
          onCancel={cancelScan}
        />
      )}

      {screen === "results" && root && (
      <div className="results">
        <FilterBar
          ref={filterInputRef}
          value={filter}
          summary={filterSummary}
          busy={filtering}
          onChange={setFilter}
        />

        {comparing && (
          <div className="dup-workspace" hidden={view !== "changes"}>
            <Changes
              summary={comparing.summary}
              sizeMode={sizeMode}
              version={version}
              onReveal={reveal}
              onShow={showOnMap}
              onClose={stopComparing}
              onError={showError}
            />
          </div>
        )}

        <div className="dup-workspace" hidden={view !== "cleanup"}>
          <Cleanup
            scanPath={scanPath}
            dataVersion={dataVersion}
            visible={view === "cleanup"}
            rules={prefs.cleanupRules}
            allowPermanentDelete={prefs.allowPermanentDelete}
            onRecycled={(report) => applyReport(report, true)}
            onDeleted={(report) => applyReport(report, true)}
            onAddToBasket={addToBasket}
            onReveal={reveal}
            onError={showError}
          />
        </div>

        <div className="dup-workspace" hidden={view !== "duplicates"}>
          <Duplicates
            folderId={folderId}
            folderName={folder?.name ?? scanPath}
            dataVersion={dataVersion}
            filterOn={filterOn}
            allowPermanentDelete={prefs.allowPermanentDelete}
            // The finder updates its own results, so they don't count as stale.
            onRecycled={(report) => applyReport(report, false)}
            onDeleted={(report) => applyReport(report, false)}
            onLinked={applyLinkReport}
            onAddToBasket={addToBasket}
            onShowOnMap={(ids, label) => {
              setHighlight({ ids: new Set(ids), label });
              setView("map");
            }}
            onReveal={reveal}
            onError={showError}
          />
        </div>

        <div
          className={cx("workspace", !showInspector && "no-inspector")}
          hidden={view !== "map"}
          style={{ ["--list-w" as string]: `${columns.panel}px` }}
        >
          <div className="list-column">
            <FolderList
              folderId={folderId}
              folderName={folder?.name ?? scanPath}
              folderSize={folder?.size ?? root.size}
              sizeMode={sizeMode}
              selectedIds={selected}
              version={version}
              layout={columns}
              onLayout={updateColumns}
              onMenu={setMenu}
              onSelect={setSelectedId}
              onToggle={toggleSelected}
              onSelectMany={setSelected}
              onOpen={openEntry}
              onContextMenu={openContextMenu}
              onError={showError}
              filter={
                filterOn && filterSummary
                  ? { summary: filterSummary, onPick: pickMatch, onRecycleAll: askRecycleMatches }
                  : undefined
              }
            />
            <div
              className="panel-resizer"
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize the folder list"
              data-tooltip="Drag to resize; double-click to reset"
              onPointerDown={startPanelDrag}
              onDoubleClick={() => updateColumns({ ...columns, panel: 480 })}
            />
          </div>

          <div className="center">
            <section className="panel map-panel" aria-label="Treemap">
              <nav className="navbar" aria-label="Location">
                <IconButton icon={ArrowLeft} label="Back" shortcut="Alt+←" disabled={!history.length} onClick={goBack} />
                <IconButton icon={ArrowUp} label="Up one level" shortcut="Backspace" disabled={crumbs.length < 2} onClick={goUp} />
                <div className="crumbs">
                  {crumbs.length > visibleCrumbs.length && (
                    <>
                      <button className="crumb" onClick={() => navigateTo(crumbs[0].id)}>
                        {crumbs[0].name}
                      </button>
                      <ChevronRight size={14} className="crumb-sep" aria-hidden="true" />
                      <span className="crumb-ellipsis">…</span>
                      <ChevronRight size={14} className="crumb-sep" aria-hidden="true" />
                    </>
                  )}
                  {visibleCrumbs.map((c, i) => (
                    <span key={c.id} style={{ display: "contents" }}>
                      {i > 0 && <ChevronRight size={14} className="crumb-sep" aria-hidden="true" />}
                      <button
                        className={cx("crumb", c.id === folderId && "is-current")}
                        aria-current={c.id === folderId ? "location" : undefined}
                        onClick={() => navigateTo(c.id)}
                      >
                        {c.name}
                      </button>
                    </span>
                  ))}
                </div>
                {folder && <span className="hud-stat" style={{ padding: "0 var(--space-100)" }}>{formatBytes(folder.size)}</span>}
                <div className="segmented segmented-icons" role="radiogroup" aria-label="Chart">
                  <button
                    className={cx("segment", prefs.mapView === "treemap" && "is-selected")}
                    role="radio"
                    aria-checked={prefs.mapView === "treemap"}
                    aria-label="Treemap"
                    data-tooltip="Treemap: blocks sized by space used"
                    onClick={() => updatePrefs({ ...prefs, mapView: "treemap" })}
                  >
                    <LayoutGrid size={14} aria-hidden="true" />
                  </button>
                  <button
                    className={cx("segment", prefs.mapView === "sunburst" && "is-selected")}
                    role="radio"
                    aria-checked={prefs.mapView === "sunburst"}
                    aria-label="Sunburst"
                    data-tooltip="Sunburst: rings out from this folder, one per level"
                    onClick={() => updatePrefs({ ...prefs, mapView: "sunburst" })}
                  >
                    <ChartPie size={14} aria-hidden="true" />
                  </button>
                </div>
                <IconButton icon={SlidersHorizontal} label="Map options" onClick={(e) => openMapOptions(e.currentTarget)} />
                <IconButton
                  icon={RotateCw}
                  label={refreshingId != null ? "Refreshing…" : "Refresh this folder"}
                  disabled={refreshingId != null}
                  iconClassName={refreshingId != null ? "spin" : undefined}
                  onClick={() => refreshFolder(folderId)}
                />
              </nav>
              {prefs.mapView === "sunburst" ? (
                <Sunburst
                  rootId={folderId}
                  selectedIds={selected}
                  freeBytes={freeBytes}
                  colorBy={prefs.colorBy}
                  highlight={highlight?.ids ?? null}
                  version={version}
                  theme={`${theme}-${prefs.accent}-${prefs.units}`}
                  onSelect={setSelectedId}
                  onToggle={toggleSelected}
                  onOpen={navigateTo}
                  onUp={goUp}
                  onContextMenu={openContextMenu}
                  onError={showError}
                />
              ) : (
                <Treemap
                  rootId={folderId}
                  selectedIds={selected}
                  freeBytes={freeBytes}
                  colorBy={prefs.colorBy}
                  cushions={prefs.cushions}
                  highlight={highlight?.ids ?? null}
                  version={version}
                  // Anything the canvas reads at draw time: colours and unit labels.
                  theme={`${theme}-${prefs.accent}-${prefs.units}`}
                  onSelect={setSelectedId}
                  onToggle={toggleSelected}
                  onOpen={navigateTo}
                  onContextMenu={openContextMenu}
                  onError={showError}
                />
              )}
              {highlight && (
                <div className="map-banner" role="status">
                  <span>Showing {highlight.label}</span>
                  <Button spacing="compact" appearance="subtle" iconBefore={X} onClick={() => setHighlight(null)}>
                    Stop
                  </Button>
                </div>
              )}
            </section>
            {prefs.colorBy === "age" ? (
              <div className="legend" aria-label="Colours by when files last changed">
                {AGE_BUCKETS.map((b) => (
                  <span key={b.label} className="legend-item">
                    <span className="swatch" style={{ background: `var(${b.var})` }} />
                    {b.label}
                  </span>
                ))}
                {!!freeBytes && (
                  <span className="legend-item">
                    <span className="swatch swatch-free" />
                    Free space
                  </span>
                )}
              </div>
            ) : (
              <div className="legend" role="group" aria-label="File types: click one to show only that type">
                {CATEGORIES.map((c) => {
                  const on = filter.categories.includes(c);
                  return (
                    <button
                      key={c}
                      className={cx("legend-item legend-button", on && "is-selected", filter.categories.length > 0 && !on && "is-muted")}
                      aria-pressed={on}
                      data-tooltip={on ? `Stop showing only ${CATEGORY_LABEL[c].toLowerCase()}` : `Show only ${CATEGORY_LABEL[c].toLowerCase()}`}
                      onClick={() => toggleCategory(c)}
                    >
                      <span className="swatch" style={{ background: `var(${CATEGORY_VAR[c]})` }} />
                      {CATEGORY_LABEL[c]}
                    </button>
                  );
                })}
                {sizeMode === "logical" && !!root.online && (
                  <span className="legend-item">
                    <span className="swatch swatch-online" />
                    Online only
                  </span>
                )}
                {!!freeBytes && (
                  <span className="legend-item">
                    <span className="swatch swatch-free" />
                    Free space
                  </span>
                )}
              </div>
            )}
          </div>

          {showInspector && (
            <Inspector
              folderId={folderId}
              folderName={folder?.name ?? ""}
              sizeMode={sizeMode}
              selectedIds={selected}
              version={version}
              onSelect={setSelectedId}
              onClearSelection={() => setSelectedId(null)}
              onRecycleMany={askRecycleMany}
              onOpenFolder={navigateTo}
              onReveal={reveal}
              onOpenPath={openFile}
              onRecycle={readOnly ? undefined : (info) => setRecycleItem(info)}
              onError={showError}
              filterOn={filterOn}
            />
          )}
        </div>
      </div>
      )}

      {recycleItem && (
        <ConfirmRecycle
          item={recycleItem}
          busy={recycling}
          onConfirm={confirmRecycle}
          onDeletePermanently={
            prefs.allowPermanentDelete ? () => deletePermanently([recycleItem.id], recycleItem) : undefined
          }
          onClose={() => !recycling && setRecycleItem(null)}
        />
      )}
      {showHistory && (
        <HistoryDialog
          scanPath={screen === "results" ? scanPath : null}
          allocatedNow={screen === "results" && root ? root.allocated : null}
          viewingSnapshot={readOnly}
          onCompare={compareWith}
          onOpen={openSnapshot}
          onReveal={reveal}
          onError={showError}
          onClose={() => setShowHistory(false)}
        />
      )}
      {showExport && (
        <ExportDialog
          folderId={folderId}
          folderName={folder?.name ?? scanPath}
          filterOn={filterOn}
          onDone={(path, rows) => {
            setShowExport(false);
            setToast({
              kind: "success",
              title: "Report exported",
              description: `${plural(rows, "row", "rows")} in ${path}`,
              action: { label: "Open", onClick: () => openFile(path) },
            });
          }}
          onClose={() => setShowExport(false)}
        />
      )}
      {showBasket && (
        <Basket
          items={basket}
          onRemove={(path) => setBasket((items) => items.filter((i) => i.path !== path))}
          onClear={() => setBasket([])}
          onReveal={reveal}
          onRecycleAll={recycleBasket}
          onClose={() => setShowBasket(false)}
        />
      )}
      {bulk && (
        <ConfirmBulk
          ids={bulk.ids}
          bytes={bulk.bytes}
          paths={bulk.paths}
          busy={recycling}
          note={bulk.note}
          onConfirm={confirmBulk}
          onDeletePermanently={prefs.allowPermanentDelete ? () => deletePermanently(bulk.ids, null) : undefined}
          onClose={() => !recycling && setBulk(null)}
        />
      )}
      {showSettings && (
        <SettingsDialog
          theme={themePref}
          sizeMode={sizeMode}
          prefs={prefs}
          canRescan={screen === "results"}
          elevated={elevated}
          volumes={volumes}
          onRelaunchAsAdmin={relaunchAsAdmin}
          onTheme={setThemePref}
          onSizeMode={setSizeMode}
          onPrefs={updatePrefs}
          onRescan={() => {
            setShowSettings(false);
            startScan(scanPath);
          }}
          onClose={() => setShowSettings(false)}
        />
      )}
      {menu && <Menu request={readOnly ? lookOnly(menu) : menu} onClose={() => setMenu(null)} />}
      {toast && (
        <div className={cx("toast", `toast-${toast.kind}`)} role={toast.kind === "error" ? "alert" : "status"}>
          {toast.kind === "success" ? <CircleCheck size={18} aria-hidden="true" /> : <CircleAlert size={18} aria-hidden="true" />}
          <div className="toast-content">
            <p className="toast-title">{toast.title}</p>
            {toast.description && <p className="toast-description">{toast.description}</p>}
          </div>
          {toast.action && (
            <Button
              spacing="compact"
              iconBefore={toast.action.label === "Undo" ? Undo2 : undefined}
              onClick={() => {
                const act = toast.action!.onClick;
                setToast(null);
                act();
              }}
            >
              {toast.action.label}
            </Button>
          )}
          <IconButton icon={X} label="Dismiss" spacing="compact" onClick={() => setToast(null)} />
        </div>
      )}
      <TooltipLayer />
    </div>
  );
}
