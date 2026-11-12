/*
 * Columns of the folder list: which are shown, how wide, and the sort.
 * Name always shows and takes what's left; the others have a width in pixels.
 */

import { t } from "./i18n";

export type ColumnKey = "name" | "size" | "share" | "files" | "modified";
export type SortDir = "asc" | "desc";

export interface ColumnLayout {
  /** Widths in pixels; Name has none, it fills the rest. */
  widths: Record<Exclude<ColumnKey, "name">, number>;
  hidden: ColumnKey[];
  sort: { key: ColumnKey; dir: SortDir };
  /** Width of the whole list panel, in pixels. */
  panel: number;
}

export const COLUMN_LABEL: Record<ColumnKey, string> = {
  name: t("Name"),
  size: t("Size"),
  share: t("Share"),
  files: t("Files"),
  modified: t("Modified"),
};

export const OPTIONAL_COLUMNS: Exclude<ColumnKey, "name">[] = ["size", "share", "files", "modified"];

export const MIN_WIDTH = 40;
export const MIN_PANEL = 300;
export const MAX_PANEL = 720;

export const DEFAULT_COLUMNS: ColumnLayout = {
  widths: { size: 72, share: 48, files: 56, modified: 80 },
  hidden: [],
  sort: { key: "size", dir: "desc" },
  panel: 480,
};

/** Which way a column sorts first: names A to Z, numbers largest or newest first. */
export const FIRST_DIR: Record<ColumnKey, SortDir> = {
  name: "asc",
  size: "desc",
  share: "desc",
  files: "desc",
  modified: "desc",
};

const KEY = "disk-studio.listColumns";

export function loadColumns(): ColumnLayout {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    const widths = { ...DEFAULT_COLUMNS.widths };
    for (const k of OPTIONAL_COLUMNS) {
      const w = saved.widths?.[k];
      if (typeof w === "number" && w >= MIN_WIDTH && w < 600) widths[k] = w;
    }
    const keys = Object.keys(COLUMN_LABEL) as ColumnKey[];
    const hidden = Array.isArray(saved.hidden) ? saved.hidden.filter((k: ColumnKey) => OPTIONAL_COLUMNS.includes(k as never)) : [];
    const sort =
      keys.includes(saved.sort?.key) && (saved.sort?.dir === "asc" || saved.sort?.dir === "desc")
        ? saved.sort
        : DEFAULT_COLUMNS.sort;
    const panel =
      typeof saved.panel === "number" ? Math.min(MAX_PANEL, Math.max(MIN_PANEL, saved.panel)) : DEFAULT_COLUMNS.panel;
    return { widths, hidden, sort, panel };
  } catch {
    return DEFAULT_COLUMNS;
  }
}

export function saveColumns(layout: ColumnLayout) {
  try {
    localStorage.setItem(KEY, JSON.stringify(layout));
  } catch {
    // Not fatal: the layout just won't be remembered.
  }
}

/** The CSS grid columns for a row: icon, name, then each shown column. */
export function gridTemplate(layout: ColumnLayout): string {
  const rest = OPTIONAL_COLUMNS.filter((k) => !layout.hidden.includes(k)).map((k) => `${layout.widths[k]}px`);
  return ["1rem", "minmax(0, 1fr)", ...rest].join(" ");
}

export function visibleColumns(layout: ColumnLayout): Exclude<ColumnKey, "name">[] {
  return OPTIONAL_COLUMNS.filter((k) => !layout.hidden.includes(k));
}

/** Narrowest the name column may get before columns on the right make way. */
const MIN_NAME = 130;

/**
 * The layout as it fits `width` pixels of list: columns are dropped from the
 * right (Modified first) until the name has room. Size always stays.
 */
export function fitLayout(layout: ColumnLayout, width: number): ColumnLayout {
  if (width <= 0) return layout;
  const hidden = [...layout.hidden];
  // Row padding and the list's, the icon, and a gap before each column.
  const nameWidth = () => {
    const cols = OPTIONAL_COLUMNS.filter((k) => !hidden.includes(k));
    return width - 32 - 16 - 8 * (cols.length + 1) - cols.reduce((s, k) => s + layout.widths[k], 0);
  };
  for (const k of ["modified", "files", "share"] as const) {
    if (nameWidth() >= MIN_NAME) break;
    if (!hidden.includes(k)) hidden.push(k);
  }
  return hidden.length === layout.hidden.length ? layout : { ...layout, hidden };
}
