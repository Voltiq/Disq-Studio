import { useRef } from "react";
import { ArrowDown, ArrowUp, Check } from "lucide-react";
import {
  COLUMN_LABEL,
  DEFAULT_COLUMNS,
  FIRST_DIR,
  MIN_WIDTH,
  OPTIONAL_COLUMNS,
  visibleColumns,
  type ColumnKey,
  type ColumnLayout,
} from "../lib/columns";
import { formatBytes, formatShortDate, formatShare } from "../lib/format";
import { cx } from "../lib/utils";
import type { MenuRequest } from "./ui/Menu";
import { t, locale } from "../lib/i18n";

interface ListHeadProps {
  /** The layout as chosen. */
  layout: ColumnLayout;
  /** The layout as it fits the panel right now (`fitLayout`). */
  fitted: ColumnLayout;
  /** Label for the size column: "Size" or "On disk". */
  sizeLabel: string;
  /** False where the order is fixed (the matches list). */
  sortable: boolean;
  onLayout: (next: ColumnLayout) => void;
  onMenu: (request: MenuRequest) => void;
}

/** Column headings: click to sort, drag an edge to resize, right-click to pick columns. */
export function ListHead({ layout, fitted, sizeLabel, sortable, onLayout, onMenu }: ListHeadProps) {
  const drag = useRef<{ key: Exclude<ColumnKey, "name">; x: number; width: number } | null>(null);
  const columns = visibleColumns(fitted);

  const sortBy = (key: ColumnKey) => {
    if (!sortable) return;
    const dir = layout.sort.key === key ? (layout.sort.dir === "asc" ? "desc" : "asc") : FIRST_DIR[key];
    onLayout({ ...layout, sort: { key, dir } });
  };

  const openMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    onMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        { type: "heading", label: t("Columns") },
        ...OPTIONAL_COLUMNS.map((k) => {
          const shown = !layout.hidden.includes(k);
          const squeezed = shown && fitted.hidden.includes(k);
          return {
            label: `${k === "size" ? sizeLabel : COLUMN_LABEL[k]}${squeezed ? t(" (needs a wider list)") : ""}`,
            icon: shown ? Check : undefined,
            checked: shown,
            onSelect: () =>
              onLayout({ ...layout, hidden: shown ? [...layout.hidden, k] : layout.hidden.filter((h) => h !== k) }),
          };
        }),
      ],
    });
  };

  const heading = (key: ColumnKey, label: string) => {
    const active = sortable && layout.sort.key === key;
    const Arrow = layout.sort.dir === "asc" ? ArrowUp : ArrowDown;
    return (
      <button
        className={cx("list-head-cell", key !== "name" && "is-numeric", active && "is-sorted")}
        aria-sort={active ? (layout.sort.dir === "asc" ? "ascending" : "descending") : undefined}
        disabled={!sortable}
        onClick={() => sortBy(key)}
        data-tooltip={sortable ? t("Sort by {0}", label.toLowerCase()) : undefined}
      >
        <span>{label}</span>
        {active && <Arrow size={11} aria-hidden="true" />}
      </button>
    );
  };

  return (
    <div className="list-head eyebrow" role="row" onContextMenu={openMenu}>
      <span />
      {heading("name", COLUMN_LABEL.name)}
      {columns.map((key) => (
        <span key={key} className="list-head-slot">
          <span
            className="col-resize"
            role="separator"
            aria-orientation="vertical"
            aria-label={t("Resize {0}", COLUMN_LABEL[key])}
            onPointerDown={(e) => {
              e.preventDefault();
              e.currentTarget.setPointerCapture(e.pointerId);
              drag.current = { key, x: e.clientX, width: layout.widths[key] };
            }}
            onPointerMove={(e) => {
              const d = drag.current;
              if (!d) return;
              // The handle sits on the column's left edge: dragging left widens it.
              const width = Math.max(MIN_WIDTH, Math.min(400, d.width + d.x - e.clientX));
              if (width !== layout.widths[key]) onLayout({ ...layout, widths: { ...layout.widths, [key]: width } });
            }}
            onPointerUp={() => (drag.current = null)}
            onDoubleClick={() =>
              onLayout({ ...layout, widths: { ...layout.widths, [key]: DEFAULT_COLUMNS.widths[key] } })
            }
          />
          {heading(key, key === "size" ? sizeLabel : COLUMN_LABEL[key])}
        </span>
      ))}
    </div>
  );
}

interface CellsProps {
  layout: ColumnLayout;
  size: number;
  whole: number;
  /** Null for a single file, where a count says nothing. */
  files: number | null;
  modified: number;
}

/** The numeric cells of a row, in the shown columns' order. */
export function RowCells({ layout, size, whole, files, modified }: CellsProps) {
  return (
    <>
      {visibleColumns(layout).map((key) =>
        key === "size" ? (
          <span key={key} className="row-size">
            {formatBytes(size)}
          </span>
        ) : key === "share" ? (
          <span key={key} className="row-share">
            {formatShare(size, whole)}
          </span>
        ) : key === "files" ? (
          <span key={key} className="row-share">
            {files == null ? "" : files.toLocaleString(locale())}
          </span>
        ) : (
          <span key={key} className="row-share">
            {formatShortDate(modified)}
          </span>
        ),
      )}
    </>
  );
}
