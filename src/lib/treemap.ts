/*
 * Squarified treemap layout (Bruls, Huizing & van Wijk), nested: each
 * folder gets a small frame and, when there is room, a name strip, and its
 * children are laid out inside.
 */

import type { Kind, MapNode } from "./types";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Cell extends Rect {
  id: number;
  name: string;
  size: number;
  kind: Kind | "rest";
  depth: number;
  /** Folders with a name strip drawn at the top. */
  header: boolean;
  online?: boolean;
  modified: number;
  restCount?: number;
  parent: number;
}

export const HEADER = 18;
const PAD = 2;
const MIN_SIDE = 2;

interface Item {
  size: number;
  node: MapNode | null;
  restCount?: number;
}

function worst(row: Item[], side: number, scale: number): number {
  let min = Infinity;
  let max = 0;
  let sum = 0;
  for (const it of row) {
    const a = it.size * scale;
    sum += a;
    if (a < min) min = a;
    if (a > max) max = a;
  }
  const s2 = side * side;
  const sum2 = sum * sum;
  return Math.max((s2 * max) / sum2, sum2 / (s2 * min));
}

/** Lays `items` (sorted largest first) out in `rect`, calling `place` for each. */
function squarify(items: Item[], rect: Rect, place: (it: Item, r: Rect) => void) {
  const total = items.reduce((s, it) => s + it.size, 0);
  if (total <= 0 || rect.w <= 0 || rect.h <= 0) return;
  const scale = (rect.w * rect.h) / total;
  let { x, y, w, h } = rect;
  let i = 0;
  while (i < items.length) {
    const side = Math.min(w, h);
    const row: Item[] = [items[i]];
    i++;
    while (i < items.length) {
      const next = [...row, items[i]];
      if (worst(next, side, scale) <= worst(row, side, scale)) {
        row.push(items[i]);
        i++;
      } else break;
    }
    const rowArea = row.reduce((s, it) => s + it.size * scale, 0);
    if (w >= h) {
      const rw = h > 0 ? rowArea / h : 0;
      let cy = y;
      for (const it of row) {
        const ih = rw > 0 ? (it.size * scale) / rw : 0;
        place(it, { x, y: cy, w: rw, h: ih });
        cy += ih;
      }
      x += rw;
      w -= rw;
    } else {
      const rh = w > 0 ? rowArea / w : 0;
      let cx = x;
      for (const it of row) {
        const iw = rh > 0 ? (it.size * scale) / rh : 0;
        place(it, { x: cx, y, w: iw, h: rh });
        cx += iw;
      }
      y += rh;
      h -= rh;
    }
  }
}

/** Returns every drawable cell, parents before children. */
export function layout(root: MapNode, bounds: Rect): Cell[] {
  const cells: Cell[] = [];

  function visit(node: MapNode, r: Rect, depth: number, parent: number) {
    if (r.w < MIN_SIDE || r.h < MIN_SIDE) return;
    const isDir = !!node.children?.length || !!node.rest;
    const header = isDir && depth > 0 && r.w > 64 && r.h > HEADER * 2 + 8;
    cells.push({
      ...r,
      id: node.id,
      name: node.name,
      size: node.size,
      kind: node.kind,
      depth,
      header,
      parent,
      online: node.online,
      modified: node.modified,
    });
    if (!isDir) return;

    const inner: Rect =
      depth === 0
        ? r
        : {
            x: r.x + PAD,
            y: r.y + (header ? HEADER : PAD),
            w: r.w - PAD * 2,
            h: r.h - (header ? HEADER + PAD : PAD * 2),
          };
    if (inner.w < MIN_SIDE || inner.h < MIN_SIDE) return;

    const items: Item[] = (node.children ?? []).map((c) => ({ size: c.size, node: c }));
    if (node.rest) items.push({ size: node.rest, node: null, restCount: node.restCount });
    items.sort((a, b) => b.size - a.size);

    squarify(items, inner, (it, cr) => {
      if (it.node) visit(it.node, cr, depth + 1, node.id);
      else if (cr.w >= MIN_SIDE && cr.h >= MIN_SIDE)
        cells.push({
          ...cr,
          id: -node.id - 1,
          name: `${it.restCount?.toLocaleString() ?? ""} smaller items`,
          size: it.size,
          kind: "rest",
          depth: depth + 1,
          header: false,
          modified: 0,
          restCount: it.restCount,
          parent: node.id,
        });
    });
  }

  visit(root, bounds, 0, -1);
  return cells;
}

export type Direction = "left" | "right" | "up" | "down";

/**
 * The sibling of `from` (same parent) nearest in `dir`, judged by centres:
 * mostly along the direction, with a penalty for drifting sideways.
 */
export function neighbour(cells: Cell[], from: Cell, dir: Direction): Cell | null {
  const cx = from.x + from.w / 2;
  const cy = from.y + from.h / 2;
  let best: Cell | null = null;
  let bestScore = Infinity;
  for (const c of cells) {
    if (c === from || c.parent !== from.parent || c.kind === "rest" || c.kind === "free") continue;
    const dx = c.x + c.w / 2 - cx;
    const dy = c.y + c.h / 2 - cy;
    const [along, across] =
      dir === "left" ? [-dx, dy] : dir === "right" ? [dx, dy] : dir === "up" ? [-dy, dx] : [dy, dx];
    if (along <= 0) continue;
    const score = along + 2 * Math.abs(across);
    if (score < bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}

/** The largest drawn child of `parent` (layout draws them largest first). */
export function firstChild(cells: Cell[], parent: number): Cell | null {
  return cells.find((c) => c.parent === parent && c.kind !== "rest" && c.kind !== "free") ?? null;
}

/** The deepest cell under a point. */
export function hitTest(cells: Cell[], x: number, y: number): Cell | null {
  for (let i = cells.length - 1; i >= 0; i--) {
    const c = cells[i];
    if (x >= c.x && x < c.x + c.w && y >= c.y && y < c.y + c.h) return c;
  }
  return null;
}
