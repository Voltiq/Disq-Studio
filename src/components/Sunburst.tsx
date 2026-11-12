import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { api, errorText } from "../lib/api";
import { formatBytes, formatShare } from "../lib/format";
import { fileColor, readColors, withFreeSpace, ZoomGhost, type ColorBy, type Colors } from "../lib/mapStyle";
import type { Kind, MapNode } from "../lib/types";
import { Spinner } from "./ui/Feedback";
import { MapTip } from "./Treemap";
import { t, locale } from "../lib/i18n";

interface SunburstProps {
  rootId: number;
  selectedIds: number[];
  freeBytes: number;
  colorBy: ColorBy;
  /** Files to pick out: everything else is dimmed. */
  highlight: Set<number> | null;
  /** Changes whenever the tree is edited, so the chart reloads. */
  version: number;
  theme: string;
  onSelect: (id: number) => void;
  onToggle: (id: number) => void;
  onOpen: (id: number) => void;
  /** The centre was clicked: go up a level. */
  onUp: () => void;
  onContextMenu: (id: number, x: number, y: number) => void;
  onError: (message: string) => void;
}

const RINGS = 6;
/** Segments narrower than this (radians) are folded into "smaller items". */
const MIN_ANGLE = 0.006;
const TAU = Math.PI * 2;

interface Arc {
  id: number;
  name: string;
  size: number;
  kind: Kind | "rest";
  online?: boolean;
  modified: number;
  depth: number;
  parent: number;
  a0: number;
  a1: number;
}

interface Geometry {
  cx: number;
  cy: number;
  /** Radius of the centre disc. */
  hole: number;
  ring: number;
}

function geometry(w: number, h: number): Geometry {
  const radius = Math.max(40, Math.min(w, h) / 2 - 10);
  const hole = radius * 0.2;
  return { cx: w / 2, cy: h / 2, hole, ring: (radius - hole) / RINGS };
}

/** Every segment, parents before children, each ring starting at the top and going clockwise. */
function layoutArcs(root: MapNode): Arc[] {
  const arcs: Arc[] = [];
  function visit(node: MapNode, a0: number, a1: number, depth: number) {
    const items: { size: number; node: MapNode | null; count?: number }[] = (node.children ?? []).map((c) => ({
      size: c.size,
      node: c,
    }));
    if (node.rest) items.push({ size: node.rest, node: null, count: node.restCount });
    const total = items.reduce((s, x) => s + x.size, 0);
    if (total <= 0 || depth > RINGS) return;
    // Children fill the parent's span in proportion to its own size, so a folder's
    // own unlisted bytes (none, normally) show as a gap.
    const scale = (a1 - a0) / Math.max(total, node.size);
    let a = a0;
    for (const it of items) {
      const span = it.size * scale;
      if (it.node) {
        const c = it.node;
        arcs.push({ id: c.id, name: c.name, size: c.size, kind: c.kind, online: c.online, modified: c.modified, depth, parent: node.id, a0: a, a1: a + span });
        if (c.children?.length || c.rest) visit(c, a, a + span, depth + 1);
      } else {
        arcs.push({
          id: -node.id - 1,
          name: `${it.count?.toLocaleString(locale()) ?? ""} smaller items`,
          size: it.size,
          kind: "rest",
          modified: 0,
          depth,
          parent: node.id,
          a0: a,
          a1: a + span,
        });
      }
      a += span;
    }
  }
  visit(root, 0, TAU, 1);
  return arcs;
}

interface Palette {
  bg: string;
  dir: string;
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
    dir: v("--surface-4"),
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

function arcPath(ctx: CanvasRenderingContext2D, g: Geometry, a: Arc, inset = 0) {
  const r0 = g.hole + (a.depth - 1) * g.ring + inset;
  const r1 = g.hole + a.depth * g.ring - 1 - inset;
  // Angles start at the top (12 o'clock).
  const s = a.a0 - Math.PI / 2;
  const e = a.a1 - Math.PI / 2;
  ctx.beginPath();
  ctx.arc(g.cx, g.cy, r1, s, e);
  ctx.arc(g.cx, g.cy, r0, e, s, true);
  ctx.closePath();
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

function draw(
  canvas: HTMLCanvasElement,
  arcs: Arc[],
  root: MapNode,
  g: Geometry,
  p: Palette,
  dpr: number,
  colorBy: ColorBy,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = p.bg;
  ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);

  for (const a of arcs) {
    if (a.a1 - a.a0 < 0.0015) continue;
    arcPath(ctx, g, a);
    if (a.kind === "free") {
      ctx.save();
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = p.rest;
      ctx.globalAlpha = 0.7;
      ctx.stroke();
      ctx.restore();
      continue;
    }
    if (a.kind === "file") {
      ctx.fillStyle = fileColor(p.colors, colorBy, a.name, a.modified);
      ctx.globalAlpha = a.online ? 0.3 : 1;
    } else if (a.kind === "rest") {
      ctx.fillStyle = p.rest;
      ctx.globalAlpha = 0.25;
    } else {
      ctx.fillStyle = p.dir;
      ctx.globalAlpha = Math.max(0.4, 1 - (a.depth - 1) * 0.12);
    }
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = p.bg;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Names along the segments that have room.
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const a of arcs) {
    if (a.kind === "rest") continue;
    const mid = (a.a0 + a.a1) / 2;
    const r = g.hole + (a.depth - 0.5) * g.ring;
    const room = (a.a1 - a.a0) * r - 8;
    if (room < 44 || g.ring < 18) continue;
    const label = a.kind === "free" ? t("Free space") : a.name;
    ctx.font = `600 11px ${p.font}`;
    const text = fitText(ctx, label, Math.min(room, 200));
    if (!text) continue;
    ctx.save();
    ctx.translate(g.cx + Math.sin(mid) * r, g.cy - Math.cos(mid) * r);
    // Along the ring, never upside down.
    let rot = mid;
    if (mid > Math.PI / 2 && mid < (3 * Math.PI) / 2) rot += Math.PI;
    ctx.rotate(rot);
    ctx.fillStyle = a.kind === "file" && !a.online ? "rgba(10,11,14,0.86)" : p.text;
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  // The folder itself, in the middle.
  ctx.fillStyle = p.dir;
  ctx.beginPath();
  ctx.arc(g.cx, g.cy, g.hole - 2, 0, TAU);
  ctx.fill();
  ctx.fillStyle = p.text;
  ctx.font = `600 12px ${p.font}`;
  ctx.fillText(fitText(ctx, root.name, g.hole * 1.7), g.cx, g.cy - 8);
  ctx.font = `500 11px ${p.mono}`;
  ctx.fillStyle = p.textSubtle;
  ctx.fillText(formatBytes(root.size), g.cx, g.cy + 9);
  ctx.textAlign = "start";
}

function drawOverlay(
  canvas: HTMLCanvasElement,
  g: Geometry,
  hover: Arc | null,
  selected: Arc[],
  highlighted: Arc[] | null,
  p: Palette,
  dpr: number,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (highlighted) {
    // Dim everything, then cut the highlighted segments back out.
    ctx.fillStyle = "rgba(8,9,12,0.72)";
    ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    for (const a of highlighted) {
      arcPath(ctx, g, a);
      ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle = p.accent;
    ctx.lineWidth = 1.5;
    for (const a of highlighted) {
      arcPath(ctx, g, a, 0.75);
      ctx.stroke();
    }
  }
  for (const a of selected) {
    arcPath(ctx, g, a, 1);
    ctx.fillStyle = p.accentSoft;
    ctx.fill();
    ctx.strokeStyle = p.accent;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  if (hover && !selected.includes(hover)) {
    arcPath(ctx, g, hover, 0.75);
    ctx.strokeStyle = p.text;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

/** The segment under a point, "centre" for the middle disc, or null. */
function hitTest(arcs: Arc[], g: Geometry, x: number, y: number): Arc | "centre" | null {
  const dx = x - g.cx;
  const dy = y - g.cy;
  const r = Math.hypot(dx, dy);
  if (r < g.hole) return "centre";
  const depth = Math.floor((r - g.hole) / g.ring) + 1;
  if (depth > RINGS) return null;
  let angle = Math.atan2(dx, -dy);
  if (angle < 0) angle += TAU;
  return arcs.find((a) => a.depth === depth && angle >= a.a0 && angle < a.a1) ?? null;
}

/** A small box at a segment's middle, for the zoom to grow into or out of. */
function arcBox(g: Geometry, a: Arc) {
  const mid = (a.a0 + a.a1) / 2;
  const r = g.hole + (a.depth - 0.5) * g.ring;
  const side = g.ring * 2;
  return { x: g.cx + Math.sin(mid) * r - side / 2, y: g.cy - Math.cos(mid) * r - side / 2, w: side, h: side };
}

/** Rings out from the folder in view: each ring one level deeper, each segment's angle its share. */
export function Sunburst({
  rootId,
  selectedIds,
  freeBytes,
  colorBy,
  highlight,
  version,
  theme,
  onSelect,
  onToggle,
  onOpen,
  onUp,
  onContextMenu,
  onError,
}: SunburstProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const ghostRef = useRef<HTMLCanvasElement>(null);
  const zoom = useRef(new ZoomGhost(() => ghostRef.current));
  const shownRoot = useRef(rootId);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [data, setData] = useState<MapNode | null>(null);
  const [loading, setLoading] = useState(false);
  const [hover, setHover] = useState<{ arc: Arc; x: number; y: number } | null>(null);
  const arcsRef = useRef<Arc[]>([]);
  const geoRef = useRef<Geometry>(geometry(0, 0));
  const paletteRef = useRef<Palette | null>(null);
  const [layoutCount, setLayoutCount] = useState(0);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const selectedId = selectedIds.length ? selectedIds[selectedIds.length - 1] : null;

  useLayoutEffect(() => {
    const from = shownRoot.current;
    if (from === rootId || !baseRef.current) return;
    shownRoot.current = rootId;
    if (!arcsRef.current.length) return; // Nothing drawn yet to zoom from.
    const into = arcsRef.current.find((a) => a.id === rootId);
    zoom.current.start(baseRef.current, from, into ? "in" : "out", into ? arcBox(geoRef.current, into) : undefined);
  }, [rootId]);
  useEffect(() => () => zoom.current.cancel(), []);

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    let timer: number | undefined;
    const ro = new ResizeObserver(([entry]) => {
      window.clearTimeout(timer);
      const { width, height } = entry.contentRect;
      timer = window.setTimeout(() => setSize({ w: Math.floor(width), h: Math.floor(height) }), 60);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (size.w === 0 || size.h === 0) return;
    let stale = false;
    setLoading(true);
    (async () => {
      try {
        const info = await api.nodeInfo(rootId);
        const minSize = ((info.size + freeBytes) * MIN_ANGLE) / TAU;
        const map = await api.treemap(rootId, RINGS, minSize);
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
  }, [rootId, size.w, size.h, version, freeBytes]);

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
    geoRef.current = geometry(size.w, size.h);
    const shown = freeBytes > 0 ? withFreeSpace(data, freeBytes) : data;
    arcsRef.current = layoutArcs(shown);
    draw(base, arcsRef.current, data, geoRef.current, paletteRef.current, dpr, colorBy);
    setHover(null);
    setLayoutCount((n) => n + 1);
    if (data.id === rootId) {
      zoom.current.finish((id) => {
        const a = arcsRef.current.find((x) => x.id === id);
        return a ? arcBox(geoRef.current, a) : null;
      });
    }
    // rootId is read only to tell the new folder's chart from the old one's.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, size, theme, freeBytes, colorBy]);

  const selectedKey = selectedIds.join(",");
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay || !paletteRef.current) return;
    const ids = new Set(selectedIds);
    const selected = arcsRef.current.filter((a) => ids.has(a.id));
    const lit = highlight ? arcsRef.current.filter((a) => highlight.has(a.id)) : null;
    drawOverlay(overlay, geoRef.current, hover?.arc ?? null, selected, lit, paletteRef.current, window.devicePixelRatio || 1);
    // selectedKey stands for selectedIds.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hover, selectedKey, layoutCount, highlight]);

  function at(e: React.MouseEvent) {
    const r = baseRef.current!.getBoundingClientRect();
    return hitTest(arcsRef.current, geoRef.current, e.clientX - r.left, e.clientY - r.top);
  }

  /** What a click acts on: a real item, never "smaller items" or free space. */
  function target(hit: Arc | "centre" | null): number | null {
    if (!hit || hit === "centre" || hit.kind === "free") return null;
    return hit.kind === "rest" ? (hit.parent === rootId ? null : hit.parent) : hit.id;
  }

  const total = data?.size ?? 0;
  const selectedArc = selectedId == null ? null : arcsRef.current.find((a) => a.id === selectedId) ?? null;

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const arcs = arcsRef.current.filter((a) => a.kind !== "rest" && a.kind !== "free");
    const cur = selectedArc;
    let next: Arc | null | undefined = null;
    if (!cur) {
      if (!e.key.startsWith("Arrow") && e.key !== "Home") return;
      next = arcs.find((a) => a.depth === 1);
    } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      const siblings = arcs.filter((a) => a.parent === cur.parent);
      const i = siblings.indexOf(cur);
      next = siblings[(i + (e.key === "ArrowRight" ? 1 : siblings.length - 1)) % siblings.length];
    } else if (e.key === "ArrowDown" || e.key === "]") {
      next = arcs.find((a) => a.parent === cur.id);
    } else if (e.key === "ArrowUp" || e.key === "[") {
      next = arcs.find((a) => a.id === cur.parent);
    } else if (e.key === "Home") {
      next = arcs.find((a) => a.depth === 1);
    } else if (e.key === "Enter" && cur.kind === "dir") {
      e.preventDefault();
      onOpen(cur.id);
      return;
    } else {
      return;
    }
    e.preventDefault();
    if (next) onSelect(next.id);
  }

  const announce = selectedArc
    ? t("{0}, {1}, {2} of view{3}", selectedArc.name, formatBytes(selectedArc.size), formatShare(selectedArc.size, total), selectedArc.kind === "dir" ? t(", folder") : "")
    : "";

  return (
    <div className="map-stage" ref={stageRef}>
      <canvas
        ref={baseRef}
        tabIndex={0}
        aria-label={t("Sunburst of the current folder. Left and Right move along a ring, Down goes out a ring, Up comes back, Enter zooms in.")}
        aria-describedby="map-selection"
        role="application"
        onKeyDown={onKeyDown}
        onMouseMove={(e) => {
          const hit = at(e);
          setHover(hit && hit !== "centre" ? { arc: hit, x: e.clientX, y: e.clientY } : null);
          e.currentTarget.style.cursor = hit === "centre" ? "zoom-out" : "";
        }}
        onMouseLeave={() => setHover(null)}
        onClick={(e) => {
          const hit = at(e);
          if (hit === "centre") {
            onUp();
            return;
          }
          const id = target(hit);
          if (id == null) return;
          if (e.ctrlKey || e.metaKey || e.shiftKey) onToggle(id);
          else onSelect(id);
        }}
        onDoubleClick={(e) => {
          const hit = at(e);
          if (hit && hit !== "centre" && hit.kind === "dir") onOpen(hit.id);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          const id = target(at(e));
          if (id != null) {
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
          <Spinner size={24} label={t("Drawing the chart")} />
        </div>
      )}
      {hover && <MapTip cell={hover.arc} x={hover.x} y={hover.y} total={total} colorBy={colorBy} />}
    </div>
  );
}
