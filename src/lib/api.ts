import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  DupDone,
  DupProgress,
  Entry,
  ExtStat,
  FilterQuery,
  FilterResult,
  JunkCategory,
  LinkReport,
  UndoReport,
  BackgroundConfig,
  BackgroundState,
  CompareSummary,
  CompareTop,
  DiffEntry,
  ExportOptions,
  Finding,
  OpenedSnapshot,
  SavedSnapshot,
  MatchSelection,
  RecycleCheck,
  RecycleReport,
  RefreshResult,
  FileHit,
  MapNode,
  NodeInfo,
  ScanDone,
  ScanProgress,
  SizeMode,
  Volume,
} from "./types";

const SIZE_MODE_KEY = "disk-studio.sizeMode";

export function loadSizeMode(): SizeMode {
  try {
    return localStorage.getItem(SIZE_MODE_KEY) === "allocated" ? "allocated" : "logical";
  } catch {
    return "logical";
  }
}

export function saveSizeMode(mode: SizeMode) {
  try {
    localStorage.setItem(SIZE_MODE_KEY, mode);
  } catch {
    // Not fatal: the choice just won't be remembered.
  }
}

export const SIZE_MODE_LABEL: Record<SizeMode, string> = {
  logical: "Size",
  allocated: "On disk",
};

export const api = {
  listVolumes: () => invoke<Volume[]>("list_volumes"),
  /** The folder the app was started with (from Explorer's right-click menu), if any. */
  startupPath: () => invoke<string | null>("startup_path"),
  startScan: (path: string, excludes: string[]) => invoke<number>("start_scan", { path, excludes }),
  /** The result of a scan if it already finished; catches a `scan-done` that came before anyone listened. */
  scanResult: (generation: number) => invoke<ScanDone | null>("scan_result", { generation }),
  cancelScan: () => invoke<void>("cancel_scan"),
  setSizeMode: (mode: SizeMode) => invoke<Entry | null>("set_size_mode", { mode }),
  findDuplicates: (id: number, minSize: number) => invoke<number>("find_duplicates", { id, minSize }),
  cancelDuplicates: () => invoke<void>("cancel_duplicates"),
  setFilter: (query: FilterQuery) => invoke<FilterResult>("set_filter", { query }),
  filterResults: () => invoke<FilterResult>("filter_results"),
  /** Everything the filter matches, ready to recycle without taking anything that doesn't match. */
  filterSelection: () => invoke<MatchSelection>("filter_selection"),
  findJunk: (rules: string[]) => invoke<JunkCategory[]>("find_junk", { rules }),
  /** Replaces each `copy` with a hard link to its `keep`; changed or locked files are reported, not thrown. */
  linkDuplicates: (pairs: { keep: number; copy: number }[]) => invoke<LinkReport>("link_duplicates", { pairs }),
  /** Deletes for good, skipping the Recycle Bin. Only behind Settings › Delete permanently. */
  deleteEach: (ids: number[]) => invoke<RecycleReport>("delete_each", { ids }),
  /** Puts back what the last recycle moved to the Recycle Bin. */
  undoRecycle: () => invoke<UndoReport>("undo_recycle"),
  canUndoRecycle: () => invoke<boolean>("can_undo_recycle"),
  /** Saves the scan in view: to `path`, or into the history when null. */
  saveSnapshot: (path: string | null) => invoke<{ path: string; bytes: number }>("save_snapshot", { path }),
  listSnapshots: (root: string | null) => invoke<SavedSnapshot[]>("list_snapshots", { root }),
  snapshotsFolder: () => invoke<string>("snapshots_folder"),
  deleteSnapshot: (path: string) => invoke<void>("delete_snapshot", { path }),
  /** Opens a snapshot in place of the scan in view. */
  openSnapshot: (path: string) => invoke<OpenedSnapshot>("open_snapshot", { path }),
  compareWith: (path: string) => invoke<CompareSummary>("compare_with", { path }),
  compareClose: () => invoke<void>("compare_close"),
  compareChildren: (id: number) => invoke<DiffEntry[]>("compare_children", { id }),
  compareTop: (limit = 100) => invoke<CompareTop>("compare_top", { limit }),
  exportReport: (id: number, path: string, options: ExportOptions) => invoke<number>("export_report", { id, path, options }),
  backgroundState: () => invoke<BackgroundState>("background_state"),
  setBackground: (config: BackgroundConfig) => invoke<BackgroundState>("set_background", { config }),
  checkNow: () => invoke<Finding[]>("check_now"),
  /** What the Recycle Bin can take; call before showing a delete confirmation. */
  recycleCheck: (ids: number[]) => invoke<RecycleCheck>("recycle_check", { ids }),
  /**
   * Recycles items one by one; failures (files in use) are reported, not thrown.
   * Items Windows would delete permanently are kept unless `allowPermanent`.
   */
  recycleEach: (ids: number[], allowPermanent: boolean) =>
    invoke<RecycleReport>("recycle_each", { ids, allowPermanent }),
  listChildren: (id: number) => invoke<Entry[]>("list_children", { id }),
  /** The id of whatever is at `path` in the current scan, if it's still there. */
  findPath: (path: string) => invoke<number | null>("find_path", { path }),
  nodeInfo: (id: number) => invoke<NodeInfo>("node_info", { id }),
  treemap: (id: number, maxDepth: number, minSize: number) =>
    invoke<MapNode>("treemap", { id, maxDepth, minSize: Math.max(1, Math.floor(minSize)) }),
  /** Space by extension, largest first; a `limit` of 0 returns every extension. */
  extensions: (id: number, limit = 10) => invoke<ExtStat[]>("extensions", { id, limit }),
  largestFiles: (id: number, limit = 40) => invoke<FileHit[]>("largest_files", { id, limit }),
  /** Rescans one folder and puts it in place; ids inside it change. */
  refreshFolder: (id: number, excludes: string[]) => invoke<RefreshResult>("refresh_folder", { id, excludes }),
  isElevated: () => invoke<boolean>("is_elevated"),
  /** Restarts as administrator after Windows asks; resolves false if the user said no (otherwise the app closes). */
  relaunchAsAdmin: (path: string | null) => invoke<boolean>("relaunch_as_admin", { path }),
};

export function onScanProgress(cb: (p: ScanProgress) => void): Promise<UnlistenFn> {
  return listen<ScanProgress>("scan-progress", (e) => cb(e.payload));
}

export function onScanDone(cb: (d: ScanDone) => void): Promise<UnlistenFn> {
  return listen<ScanDone>("scan-done", (e) => cb(e.payload));
}

/** A folder handed over by a second launch, e.g. "Analyze with Disq Studio" while the app is open. */
export function onOpenPath(cb: (path: string) => void): Promise<UnlistenFn> {
  return listen<string>("open-path", (e) => cb(e.payload));
}

export function onDupProgress(cb: (p: DupProgress) => void): Promise<UnlistenFn> {
  return listen<DupProgress>("dup-progress", (e) => cb(e.payload));
}

export function onDupDone(cb: (d: DupDone) => void): Promise<UnlistenFn> {
  return listen<DupDone>("dup-done", (e) => cb(e.payload));
}

export function errorText(err: unknown): string {
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  return String(err);
}
