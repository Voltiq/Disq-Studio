import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { api, errorText } from "../lib/api";
import { CATEGORY_VAR, categoryOf } from "../lib/fileTypes";
import { formatBytes, formatDate, formatShare } from "../lib/format";
import {
  AGE_BUCKETS,
  ageBucket,
  cushion,
  fileColor,
  readColors,
  withFreeSpace,
  ZoomGhost,
  type ColorBy,
  type Colors,
} from "../lib/mapStyle";
import { firstChild, HEADER, hitTest, layout, neighbour, type Cell, type Direction } from "../lib/treemap";
import type { Kind, MapNode } from "../lib/types";
import { Spinner } from "./ui/Feedback";

interface TreemapProps {
  rootId: number;
  /** Everything selected; the last one is the one keyboard moves start from. */
  selectedIds: number[];
  /** The drive's free space, shown as its own block; 0 for none. */
  freeBytes: number;
  colorBy: ColorBy;
  cushions: boolean;
  /** Files to pick out: everything else is dimmed. */
  highlight: Set<number> | null;
  /** Changes whenever the tree is edited, so the map reloads. */
  version: number;
  theme: string;
  onSelect: (id: number) => void;
  /** Ctrl or Shift click: add to or take out of the selection. */
  onToggle: (id: number) => void;
  onOpen: (id: number) => void;
  onContextMenu: (id: number, x: number, y: number) => void;
  onError: (message: string) => void;
}

/** Anything smaller than this many square pixels is folded into "smaller items". */
const MIN_AREA = 36;
const MAX_DEPTH = 14;

interface Palette {
  bg: string;
  dir: string;
  dirHeader: string;
  text: string;
  textSubtle: string;
  accent: string;
  accentSoft: string;
  rest: string;
  colors: Colors;
  font: string;
  mono: string;
}

function readPalette(el: HTMLElement): Palette {
  const css = getComputedStyle(el);
  const v = (name: string) => css.getPropertyValue(name).trim();
  return {
    bg: v("--bg-2"),
    dir: v("--surface-3"),
    dirHeader: v("--surface-4"),
    text: v("--text-1"),
    textSubtle: v("--text-2"),
    accent: v("--accent"),
    accentSoft: v("--accent-soft"),
    rest: v("--text-3"),
    colors: readColors(css),
    font: v("--font-body"),
    mono: v("--font-code"),
  };
}

function fitText(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (ctx.measureText(text.slice(0, mid) + "…").width <= max) lo = mid;
    else hi = mid - 1;
  }
  return lo > 0 ? text.slice(0, lo) + "…" : "";
}

interface Look {
  colorBy: ColorBy;
  cushions: boolean;
}

function draw(canvas: HTMLCanvasElement, cells: Cell[], p: Palette, dpr: number, look: Look) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = p.bg;
  ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
  ctx.textBaseline = "middle";

  for (const c of cells) {
    if (c.depth === 0) continue;
    const isDir = c.kind === "dir" || c.kind === "denied";
    if (c.kind === "free") {
      drawFree(ctx, c, p);
      continue;
    }
    if (c.kind === "rest") {
      ctx.fillStyle = p.dir;
      ctx.fillRect(c.x + 0.5, c.y + 0.5, c.w - 1, c.h - 1);
      // Diagonal hatching: "lots of tiny things here".
      ctx.save();
      ctx.beginPath();
      ctx.rect(c.x + 0.5, c.y + 0.5, c.w - 1, c.h - 1);
      ctx.clip();
      ctx.strokeStyle = p.rest;
      ctx.globalAlpha = 0.28;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let d = -c.h; d < c.w; d += 6) {
        ctx.moveTo(c.x + d, c.y + c.h);
        ctx.lineTo(c.x + d + c.h, c.y);
      }
      ctx.stroke();
      ctx.restore();
      continue;
    }
    if (isDir) {
      ctx.fillStyle = p.dir;
      ctx.globalAlpha = Math.max(0.35, 1 - c.depth * 0.08);
      ctx.fillRect(c.x + 0.5, c.y + 0.5, c.w - 1, c.h - 1);
      ctx.globalAlpha = 1;
      if (c.header) {
        ctx.fillStyle = p.dirHeader;
        ctx.fillRect(c.x + 0.5, c.y + 0.5, c.w - 1, HEADER - 1);
        ctx.font = `600 11px ${p.font}`;
        ctx.fillStyle = p.textSubtle;
        const size = formatBytes(c.size);
        ctx.font = `500 10.5px ${p.mono}`;
        const sizeW = ctx.measureText(size).width;
        const showSize = c.w > sizeW + 90;
        if (showSize) ctx.fillText(size, c.x + c.w - sizeW - 6, c.y + HEADER / 2);
        ctx.font = `600 11px ${p.font}`;
        ctx.fillStyle = p.text;
        const label = fitText(ctx, c.name, c.w - 12 - (showSize ? sizeW + 10 : 0));
        ctx.fillText(label, c.x + 6, c.y + HEADER / 2);
      }
      continue;
    }

    // A file: its type's (or age's) colour, lit from above.
    const color = c.kind === "file" ? fileColor(p.colors, look.colorBy, c.name, c.modified) : p.rest;
    if (c.online) {
      // Online-only: a ghost of the file, since its data isn't on this drive.
      drawOnline(ctx, c, color, p);
      continue;
    }
    ctx.fillStyle = color;
    ctx.fillRect(c.x + 0.5, c.y + 0.5, c.w - 1, c.h - 1);
    if (look.cushions) {
      cushion(ctx, c.x + 0.5, c.y + 0.5, c.w - 1, c.h - 1);
    } else if (c.w > 4 && c.h > 4) {
      ctx.fillStyle = "rgba(255,255,255,0.13)";
      ctx.fillRect(c.x + 0.5, c.y + 0.5, c.w - 1, Math.min(c.h * 0.42, 40));
      ctx.fillStyle = "rgba(255,255,255,0.28)";
      ctx.fillRect(c.x + 0.5, c.y + 0.5, c.w - 1, 1);
      ctx.fillStyle = "rgba(0,0,0,0.16)";
      ctx.fillRect(c.x + 0.5, c.y + c.h - 1.5, c.w - 1, 1);
    }
    if (c.w > 64 && c.h > 26) {
      ctx.font = `600 11px ${p.font}`;
      ctx.fillStyle = "rgba(10,11,14,0.86)";
      const label = fitText(ctx, c.name, c.w - 12);
      ctx.fillText(label, c.x + 6, c.y + 12);
      if (c.h > 42) {
        ctx.font = `500 10.5px ${p.mono}`;
        ctx.fillStyle = "rgba(10,11,14,0.62)";
        ctx.fillText(formatBytes(c.size), c.x + 6, c.y + 27);
      }
    }
  }
}

function drawFree(ctx: CanvasRenderingContext2D, c: Cell, p: Palette) {
  const x = c.x + 1.5;
  const y = c.y + 1.5;
  const w = c.w - 3;
  const h = c.h - 3;
  if (w < 2 || h < 2) return;
  ctx.strokeStyle = p.rest;
  ctx.globalAlpha = 0.7;
  ctx.setLineDash([5, 4]);
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  if (w > 80 && h > 34) {
    ctx.font = `600 12px ${p.font}`;
    ctx.fillStyle = p.textSubtle;
    ctx.fillText(fitText(ctx, "Free space", w - 16), x + 8, y + 14);
    ctx.font = `500 10.5px ${p.mono}`;
    ctx.fillText(formatBytes(c.size), x + 8, y + 30);
  }
}

function drawOnline(ctx: CanvasRenderingContext2D, c: Cell, color: string, p: Palette) {
  const x = c.x + 0.5;
  const y = c.y + 0.5;
  const w = c.w - 1;
  const h = c.h - 1;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  ctx.globalAlpha = 0.45;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let d = -h; d < w; d += 7) {
    ctx.moveTo(x + d, y + h);
    ctx.lineTo(x + d + h, y);
  }
  ctx.stroke();
  ctx.restore();
  if (w > 4 && h > 4) {
    ctx.strokeStyle = color;
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.setLineDash([]);
  }
  if (w > 64 && h > 26) {
    ctx.font = `600 11px ${p.font}`;
    ctx.fillStyle = p.text;
    ctx.fillText(fitText(ctx, c.name, w - 12), x + 6, y + 12);
    if (h > 42) {
      ctx.font = `500 10.5px ${p.mono}`;
      ctx.fillStyle = p.textSubtle;
      ctx.fillText(`${formatBytes(c.size)} · online only`, x + 6, y + 27);
    }
  }
}

function drawOverlay(
  canvas: HTMLCanvasElement,
  hover: Cell | null,
  selected: Cell[],
  highlighted: Cell[] | null,
  p: Palette,
  dpr: number,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (highlighted) {
    // Dim everything, then cut the highlighted blocks back out.
    ctx.fillStyle = "rgba(8,9,12,0.72)";
    ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    for (const c of highlighted) ctx.clearRect(c.x, c.y, c.w, c.h);
    ctx.strokeStyle = p.accent;
    ctx.lineWidth = 1.5;
    for (const c of highlighted) if (c.w > 3 && c.h > 3) ctx.strokeRect(c.x + 0.75, c.y + 0.75, c.w - 1.5, c.h - 1.5);
  }
  for (const s of selected) {
    if (s.depth === 0) continue;
    ctx.fillStyle = p.accentSoft;
    ctx.fillRect(s.x, s.y, s.w, s.h);
    ctx.strokeStyle = p.accent;
    ctx.lineWidth = 2;
    ctx.strokeRect(s.x + 1, s.y + 1, s.w - 2, s.h - 2);
  }
  if (hover && hover.depth > 0 && !selected.includes(hover)) {
    ctx.strokeStyle = p.text;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(hover.x + 0.75, hover.y + 0.75, hover.w - 1.5, hover.h - 1.5);
    ctx.globalAlpha = 1;
  }
}

export function Treemap({
  rootId,
  selectedIds,
  freeBytes,
  colorBy,
  cushions,
  highlight,
  version,
  theme,
  onSelect,
  onToggle,
  onOpen,
  onContextMenu,
  onError,
}: TreemapProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const ghostRef = useRef<HTMLCanvasElement>(null);
  const zoom = useRef(new ZoomGhost(() => ghostRef.current));
  const shownRoot = useRef(rootId);
  const selectedId = selectedIds.length ? selectedIds[selectedIds.length - 1] : null;
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [data, setData] = useState<MapNode | null>(null);
  const [loading, setLoading] = useState(false);
  const [hover, setHover] = useState<{ cell: Cell; x: number; y: number } | null>(null);
  const cellsRef = useRef<Cell[]>([]);
  // Bumped after each layout, so anything read from cellsRef (the selection) renders again.
  const [layoutCount, setLayoutCount] = useState(0);
  const paletteRef = useRef<Palette | null>(null);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  // A new folder: zoom from the old view while the new one loads.
  useLayoutEffect(() => {
    const from = shownRoot.current;
    if (from === rootId || !baseRef.current) return;
    shownRoot.current = rootId;
    if (!cellsRef.current.length) return; // Nothing drawn yet to zoom from.
    const into = cellsRef.current.find((c) => c.id === rootId && c.depth > 0);
    zoom.current.start(baseRef.current, from, into ? "in" : "out", into);
  }, [rootId]);
  useEffect(() => () => zoom.current.cancel(), []);

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    let timer: number | undefined;
    const ro = new ResizeObserver(([entry]) => {
      window.clearTimeout(timer);
      const { width, height } = entry.contentRect;
      // Redraw at once, but only refetch once resizing settles.
      timer = window.setTimeout(() => setSize({ w: Math.floor(width), h: Math.floor(height) }), 60);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      window.clearTimeout(timer);
    };
  }, []);

  // Fetch a subtree trimmed to what is big enough to see at this size.
  useEffect(() => {
    if (size.w === 0 || size.h === 0) return;
    let stale = false;
    setLoading(true);
    (async () => {
      try {
        const info = await api.nodeInfo(rootId);
        const minSize = (info.size * MIN_AREA) / (size.w * size.h);
        const map = await api.treemap(rootId, MAX_DEPTH, minSize);
        if (!stale) setData(map);
      } catch (err) {
        if (!stale) {
          onErrorRef.current(errorText(err));
          zoom.current.cancel();
        }
      } finally {
        if (!stale) setLoading(false);
      }
    })();
    return () => {
      stale = true;
    };
  }, [rootId, size.w, size.h, version]);

  // Lay out and paint.
  useEffect(() => {
    const stage = stageRef.current;
    const base = baseRef.current;
    const overlay = overlayRef.current;
    if (!stage || !base || !overlay || !data || size.w === 0) return;
    const dpr = window.devicePixelRatio || 1;
    for (const c of [base, overlay]) {
      c.width = Math.round(size.w * dpr);
      c.height = Math.round(size.h * dpr);
    }
    paletteRef.current = readPalette(stage);
    const shown = freeBytes > 0 ? withFreeSpace(data, freeBytes) : data;
    cellsRef.current = layout(shown, { x: 0, y: 0, w: size.w, h: size.h });
    draw(base, cellsRef.current, paletteRef.current, dpr, { colorBy, cushions });
    setHover(null);
    setLayoutCount((n) => n + 1);
    if (data.id === rootId) {
      zoom.current.finish((id) => cellsRef.current.find((c) => c.id === id && c.depth > 0) ?? null);
    }
    // rootId is read only to tell the new folder's map from the old one's.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, size, theme, freeBytes, colorBy, cushions]);

  const selectedCell =
    selectedId == null ? null : cellsRef.current.find((c) => c.id === selectedId) ?? null;
  const selectedKey = selectedIds.join(",");

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay || !paletteRef.current) return;
    const ids = new Set(selectedIds);
    const cells = cellsRef.current.filter((c) => ids.has(c.id));
    const lit = highlight ? cellsRef.current.filter((c) => highlight.has(c.id)) : null;
    drawOverlay(overlay, hover?.cell ?? null, cells, lit, paletteRef.current, window.devicePixelRatio || 1);
    // selectedKey stands for selectedIds.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hover, selectedKey, layoutCount, highlight]);

  function cellAt(e: React.MouseEvent): Cell | null {
    const r = baseRef.current!.getBoundingClientRect();
    return hitTest(cellsRef.current, e.clientX - r.left, e.clientY - r.top);
  }

  /** The thing a click acts on: a real item, never the "smaller items" block. */
  function target(cell: Cell | null): number | null {
    if (!cell || cell.kind === "free") return null;
    if (cell.kind === "rest") return cell.parent;
    return cell.depth === 0 ? null : cell.id;
  }

  // Shares are of what's in view, not counting free space.
  const total = data?.size ?? 0;

  const ARROWS: Record<string, Direction> = {
    ArrowLeft: "left",
    ArrowRight: "right",
    ArrowUp: "up",
    ArrowDown: "down",
  };

  function onKeyDown(e: React.KeyboardEvent) {
    // Alt+arrows belong to Back and Up.
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const cells = cellsRef.current;
    const current = selectedCell && selectedCell.depth > 0 ? selectedCell : null;
    let next: Cell | null = null;
    if (e.key in ARROWS) {
      next = current ? neighbour(cells, current, ARROWS[e.key]) : firstChild(cells, rootId);
    } else if (e.key === "Home") {
      next = firstChild(cells, rootId);
    } else if (e.key === "]" && current) {
      // Into the selected folder's contents, without zooming.
      next = firstChild(cells, current.id);
    } else if (e.key === "[" && current && current.parent !== rootId) {
      next = cells.find((c) => c.id === current.parent) ?? null;
    } else if (e.key === "Enter" && current?.kind === "dir") {
      e.preventDefault();
      onOpen(current.id);
      return;
    } else {
      return;
    }
    e.preventDefault();
    if (next) onSelect(next.id);
  }

  const announce = selectedCell
    ? `${selectedCell.name}, ${formatBytes(selectedCell.size)}, ${formatShare(selectedCell.size, total)} of view${
        selectedCell.kind === "dir" ? ", folder" : ""
      }`
    : "";

  return (
    <div className="map-stage" ref={stageRef}>
      <canvas
        ref={baseRef}
        tabIndex={0}
        aria-label="Treemap of the current folder. Arrow keys move between blocks, ] goes into a folder, [ goes back out, Enter zooms in."
        aria-describedby="map-selection"
        role="application"
        onKeyDown={onKeyDown}
        onFocus={() => {
          // Give keyboard users something to start from.
          if (!selectedCell || selectedCell.depth === 0) {
            const first = firstChild(cellsRef.current, rootId);
            if (first) onSelect(first.id);
          }
        }}
        onMouseMove={(e) => {
          const cell = cellAt(e);
          setHover(cell && cell.depth > 0 ? { cell, x: e.clientX, y: e.clientY } : null);
        }}
        onMouseLeave={() => setHover(null)}
        onClick={(e) => {
          const id = target(cellAt(e));
          if (id == null) return;
          if (e.ctrlKey || e.metaKey || e.shiftKey) onToggle(id);
          else onSelect(id);
        }}
        onDoubleClick={(e) => {
          // Zoom one level: into the top-level folder under the pointer.
          let cell = cellAt(e);
          const byId = new Map(cellsRef.current.map((c) => [c.id, c]));
          while (cell && cell.parent !== rootId) cell = byId.get(cell.parent) ?? null;
          if (cell && cell.kind === "dir") onOpen(cell.id);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          const id = target(cellAt(e));
          if (id != null) {
            // Keep a multi-selection when right-clicking inside it.
            if (!selectedIds.includes(id)) onSelect(id);
            onContextMenu(id, e.clientX, e.clientY);
          }
        }}
      />
      <canvas ref={overlayRef} className="map-overlay" aria-hidden="true" />
      <canvas ref={ghostRef} className="map-overlay map-ghost" aria-hidden="true" hidden />
      <p id="map-selection" className="visually-hidden" aria-live="polite">
        {announce}
      </p>
      {loading && !data && (
        <div className="map-loading">
          <Spinner size={24} label="Drawing the map" />
        </div>
      )}
      {hover && <MapTip cell={hover.cell} x={hover.x} y={hover.y} total={total} colorBy={colorBy} />}
    </div>
  );
}

/** What the hover tip needs to know about a block or ring segment. */
export interface TipItem {
  name: string;
  size: number;
  kind: Kind | "rest";
  online?: boolean;
  modified: number;
}

export function MapTip({
  cell,
  x,
  y,
  total,
  colorBy,
}: {
  cell: TipItem;
  x: number;
  y: number;
  total: number;
  colorBy: ColorBy;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x + 16, top: y + 18 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    let left = x + 16;
    let top = y + 18;
    if (left + width > window.innerWidth - 8) left = x - width - 12;
    if (top + height > window.innerHeight - 8) top = y - height - 12;
    setPos({ left, top });
  }, [x, y, cell]);

  const kind =
    cell.kind === "rest"
      ? "Many small items"
      : cell.kind === "dir"
        ? "Folder"
        : cell.kind === "denied"
          ? "Folder · access denied"
          : cell.online
            ? "Online only, not on this drive"
            : "File";
  const color =
    cell.kind !== "file"
      ? "var(--surface-4)"
      : colorBy === "age"
        ? `var(${AGE_BUCKETS[ageBucket(cell.modified)].var})`
        : `var(${CATEGORY_VAR[categoryOf(cell.name)]})`;
  return (
    <div ref={ref} className="map-tip" style={pos} role="tooltip">
      <span className="map-tip-name">
        <span className="swatch" style={{ background: color }} />
        {cell.name}
      </span>
      <span className="map-tip-meta">
        {cell.kind === "free"
          ? `${formatBytes(cell.size)} free on this drive`
          : `${formatBytes(cell.size)} · ${formatShare(cell.size, total)} of view · ${kind}`}
      </span>
      {cell.kind === "file" && <span className="map-tip-meta">Changed {formatDate(cell.modified)}</span>}
    </div>
  );
}
