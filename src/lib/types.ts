export type ThemePreference = "system" | "light" | "dark";

/**
 * "hardlink" is another name for a file counted elsewhere in the scan.
 * "free" is only ever the map's free-space block.
 */
export type Kind = "file" | "dir" | "link" | "denied" | "excluded" | "hardlink" | "deleted" | "free";

/** "logical" is the file's length; "allocated" is the space it takes on the drive. */
export type SizeMode = "logical" | "allocated";

export interface Volume {
  path: string;
  label: string;
  fileSystem: string;
  kind: "removable" | "fixed" | "network" | "optical" | "ram";
  total: number;
  free: number;
}

export interface Entry {
  id: number;
  name: string;
  /** Size in the current mode. */
  size: number;
  logical: number;
  allocated: number;
  /** Logical bytes of online-only cloud files at or under this entry. */
  online: number;
  /** Bytes of hard links under this entry that are counted at another name. */
  linked: number;
  files: number;
  dirs: number;
  modified: number;
  kind: Kind;
  hasChildren: boolean;
}

export interface NodeInfo extends Entry {
  path: string;
  ancestors: { id: number; name: string }[];
  parentSize: number;
  rootSize: number;
  linkTarget?: { id: number; path: string; logical: number; allocated: number };
}

export interface MapNode {
  id: number;
  name: string;
  size: number;
  kind: Kind;
  /** An online-only cloud file. */
  online?: boolean;
  /** Milliseconds since the Unix epoch. */
  modified: number;
  children?: MapNode[];
  rest?: number;
  restCount?: number;
}

export interface ExtStat {
  ext: string;
  bytes: number;
  count: number;
}

export interface FileHit {
  id: number;
  name: string;
  path: string;
  size: number;
  modified: number;
  online: boolean;
}

export interface JunkItem {
  id: number;
  path: string;
  kind: Kind;
  size: number;
  files: number;
  modified: number;
}

export interface JunkCategory {
  key: string;
  label: string;
  description: string;
  /** "safe": rebuilt automatically. "review": costs a re-download or rebuild. "info": shown only, never selectable. */
  safety: "safe" | "review" | "info";
  total: number;
  totalItems: number;
  /** The largest items, capped. */
  items: JunkItem[];
}

export interface RecycleIssue {
  id: number;
  path: string;
  error: string;
}

export interface RecycleReport {
  root: Entry;
  done: number[];
  /** On-disk bytes of the items that were moved. */
  freed: number;
  /** Windows refused these, usually because a program has them open. */
  failed: RecycleIssue[];
  /** Left alone because they would have been deleted permanently. */
  kept: RecycleIssue[];
  /** Deleted permanently, as the user allowed. */
  permanent: number;
}

/** What the Recycle Bin can take, worked out before deleting. */
export interface RecycleCheck {
  root: string;
  hasBin: boolean;
  nukeOnDelete: boolean;
  maxBytes: number | null;
  maxIsEstimate: boolean;
  usedBytes: number;
  selectedBytes: number;
  /** Older items Windows will permanently drop from the bin to make room. */
  overflowBytes: number;
  /** Items that can't be recycled and would be deleted permanently. */
  blocked: { id: number; path: string; size: number; reason: string }[];
  /** Items holding online-only cloud files; those skip Windows' Recycle Bin. */
  onlineItems: number;
  onlineBytes: number;
}

/** After replacing duplicate copies with hard links. */
export interface LinkReport {
  root: Entry;
  done: number[];
  freed: number;
  failed: RecycleIssue[];
}

/** After putting the last recycled items back. */
export interface UndoReport {
  root: Entry;
  restored: number;
  /** No longer in the Recycle Bin. */
  missing: number;
  errors: number;
}

export interface FilterQuery {
  /** Part of a file or folder name, or a pattern with * and ?. */
  text: string;
  exts: string[];
  /** Files whose extension is none of these also pass (the "Other" type). */
  otherThan?: string[];
  minSize?: number;
  maxSize?: number;
  modifiedAfter?: number;
  modifiedBefore?: number;
}

/** An outermost match: a folder whose name matches, or a matching file outside one. */
export interface FilterHit {
  id: number;
  parent: number;
  name: string;
  path: string;
  kind: Kind;
  /** Matching bytes. */
  size: number;
  files: number;
  modified: number;
  online: boolean;
}

export interface FilterSummary {
  files: number;
  bytes: number;
  totalHits: number;
  hits: FilterHit[];
}

/** Every match, as items to recycle: whole folders where all of it matches, files elsewhere. */
export interface MatchSelection {
  ids: number[];
  bytes: number;
  files: number;
  paths: string[];
}

export interface FilterResult {
  root: Entry;
  summary: FilterSummary | null;
}

export interface DupFile {
  id: number;
  path: string;
  modified: number;
}

/** Identical files; `files` is sorted oldest first. */
export interface DupGroup {
  size: number;
  files: DupFile[];
}

export interface DupProgress {
  generation: number;
  phase: "edges" | "full";
  done: number;
  total: number;
  bytesDone: number;
  bytesTotal: number;
  elapsedMs: number;
}

export interface DupDone {
  generation: number;
  status: "done" | "cancelled";
  groups: DupGroup[];
  totalGroups: number;
  duplicateFiles: number;
  wasted: number;
  candidates: number;
  skipped: number;
  /** Files whose hashes were remembered from an earlier search. */
  cached: number;
  elapsedMs: number;
}

export interface ScanProgress {
  generation: number;
  files: number;
  dirs: number;
  bytes: number;
  allocated: number;
  errors: number;
  current: string;
  elapsedMs: number;
}

export interface ScanDone {
  generation: number;
  status: "done" | "cancelled";
  root: Entry | null;
  path: string;
  errors: number;
  /** Folders left out by the exclusion list in Settings. */
  excluded: number;
  /** Read from the drive's file table (as administrator) rather than folder by folder. */
  fromMft: boolean;
  elapsedMs: number;
}

/** After refreshing one folder in place. */
export interface RefreshResult {
  root: Entry;
  /** Folders in the whole scan that couldn't be read, after the refresh. */
  errors: number;
}

/** What a saved scan holds, read from its header. */
export interface SnapshotMeta {
  root: string;
  /** Milliseconds since the Unix epoch. */
  scannedAt: number;
  files: number;
  folders: number;
  logical: number;
  allocated: number;
  errors: number;
  fromMft: boolean;
  appVersion: string;
}

export interface SavedSnapshot extends SnapshotMeta {
  path: string;
  /** Size of the snapshot file. */
  bytes: number;
}

export interface OpenedSnapshot {
  root: Entry;
  meta: SnapshotMeta;
  errors: number;
}

export interface CompareSummary {
  meta: SnapshotMeta;
  before: number;
  now: number;
  filesBefore: number;
  filesNow: number;
}

/** One item, then and now; `before` is missing for new items, `now` for gone ones. */
export interface DiffEntry {
  id: number | null;
  name: string;
  path: string;
  kind: Kind;
  before: number | null;
  now: number | null;
  filesBefore: number;
  filesNow: number;
  canOpen: boolean;
}

export interface CompareTop {
  grew: DiffEntry[];
  shrank: DiffEntry[];
  added: DiffEntry[];
  removed: DiffEntry[];
}

export type ExportFormat = "csv" | "json" | "html";

export interface ExportOptions {
  format: ExportFormat;
  /** Levels below the folder; 0 for no limit. */
  maxDepth: number;
  minSize: number;
  includeFiles: boolean;
}

export interface BackgroundConfig {
  enabled: boolean;
  hour: number;
  minFreePercent: number;
  snapshotRoots: string[];
  growAlertGb: number;
}

export interface BackgroundState {
  config: BackgroundConfig;
  scheduled: boolean;
}

export interface Finding {
  title: string;
  body: string;
}
