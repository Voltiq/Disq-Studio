/*
 * Shared by the treemap and the sunburst: how blocks are coloured, the
 * free-space block, and the zoom animation between levels.
 */

import { CATEGORY_VAR, categoryOf } from "./fileTypes";
import type { MapNode } from "./types";

export type ColorBy = "type" | "age";

const DAY = 86_400_000;

/** "Colour by age": recent is warm, old is cool. Upper bounds in days. */
export const AGE_BUCKETS = [
  { days: 7, label: "This week", var: "--accent-magenta" },
  { days: 30, label: "This month", var: "--accent-orange" },
  { days: 365, label: "This year", var: "--accent-yellow" },
  { days: 3 * 365, label: "1–3 years", var: "--accent-teal" },
  { days: Infinity, label: "Older", var: "--accent-blue" },
] as const;

export function ageBucket(modified: number, now = Date.now()): number {
  const days = (now - modified) / DAY;
  const i = AGE_BUCKETS.findIndex((b) => days < b.days);
  return i < 0 ? AGE_BUCKETS.length - 1 : i;
}

export interface Colors {
  categories: Record<string, string>;
  ages: string[];
}

export function readColors(css: CSSStyleDeclaration): Colors {
  const v = (name: string) => css.getPropertyValue(name).trim();
  const categories: Record<string, string> = {};
  for (const [cat, varName] of Object.entries(CATEGORY_VAR)) categories[cat] = v(varName);
  return { categories, ages: AGE_BUCKETS.map((b) => v(b.var)) };
}

export function fileColor(colors: Colors, colorBy: ColorBy, name: string, modified: number): string {
  return colorBy === "age" ? colors.ages[ageBucket(modified)] : colors.categories[categoryOf(name)];
}

/** Id given to the free-space block; never a real node. */
export const FREE_ID = -1_000_000;

/** Adds the drive's free space as a block next to what's used. */
export function withFreeSpace(map: MapNode, free: number): MapNode {
  if (free <= 0) return map;
  const block: MapNode = { id: FREE_ID, name: "Free space", size: free, kind: "free", modified: 0 };
  return { ...map, size: map.size + free, children: [...(map.children ?? []), block] };
}

/** Paints a soft pillow over a block: light from the top left, darker towards the edges. */
export function cushion(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  if (w < 3 || h < 3) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.scale(w / 2, h / 2);
  const g = ctx.createRadialGradient(-0.35, -0.4, 0, -0.1, -0.1, 1.45);
  g.addColorStop(0, "rgba(255,255,255,0.42)");
  g.addColorStop(0.35, "rgba(255,255,255,0.08)");
  g.addColorStop(0.75, "rgba(0,0,0,0.12)");
  g.addColorStop(1, "rgba(0,0,0,0.38)");
  ctx.fillStyle = g;
  ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
}

export function reducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Zooming between levels: a snapshot of the old view, drawn on its own
 * canvas above the new one, grows into (or shrinks out of) the block that
 * was opened, then fades as the new view shows underneath.
 */
export class ZoomGhost {
  private pending: { dir: "in" | "out" | "fade"; fromId: number; grow?: Animation } | null = null;
  /** Bumped by each zoom, so an older one finishing late leaves the newer alone. */
  private generation = 0;
  private safety: number | undefined;

  constructor(private ghost: () => HTMLCanvasElement | null) {}

  /**
   * Call when the view's folder changes, before the new view is drawn:
   * "in" grows `into` (the opened block, in the old view) to fill the stage;
   * "out" shrinks the old view into its block in the new one.
   */
  start(base: HTMLCanvasElement, fromId: number, dir: "in" | "out" | "fade", into?: Box) {
    const ghost = this.ghost();
    if (!ghost || reducedMotion() || base.width === 0) return;
    this.cancel();
    const gen = ++this.generation;
    ghost.width = base.width;
    ghost.height = base.height;
    ghost.getContext("2d")?.drawImage(base, 0, 0);
    ghost.hidden = false;
    ghost.style.transformOrigin = "0 0";
    // Never cover the map for long, whatever happens to the new view.
    this.safety = window.setTimeout(() => gen === this.generation && this.cancel(), 2500);
    const stage = ghost.getBoundingClientRect();
    if (dir === "in" && into && into.w > 0 && into.h > 0) {
      const sx = stage.width / into.w;
      const sy = stage.height / into.h;
      const grow = ghost.animate(
        [{ transform: "none" }, { transform: `translate(${-into.x * sx}px, ${-into.y * sy}px) scale(${sx}, ${sy})` }],
        { duration: 260, easing: "cubic-bezier(0.2, 0, 0, 1)", fill: "forwards" },
      );
      this.pending = { dir: "in", fromId, grow };
    } else {
      this.pending = { dir: dir === "out" ? "out" : "fade", fromId };
    }
  }

  /** Call once the new view is drawn; `find` gives where the old folder sits in it, if anywhere. */
  async finish(find: (id: number) => Box | null) {
    const ghost = this.ghost();
    const p = this.pending;
    this.pending = null;
    if (!ghost || !p) return;
    const gen = this.generation;
    let anim: Animation;
    const target = p.dir === "out" ? find(p.fromId) : null;
    if (target) {
      const { width, height } = ghost.getBoundingClientRect();
      const sx = target.w / width;
      const sy = target.h / height;
      anim = ghost.animate(
        [
          { transform: "none", opacity: 1 },
          { transform: `translate(${target.x}px, ${target.y}px) scale(${sx}, ${sy})`, opacity: 0 },
        ],
        { duration: 280, easing: "cubic-bezier(0.2, 0, 0, 1)", fill: "forwards" },
      );
    } else {
      if (p.grow) await settle(p.grow, 400);
      if (gen !== this.generation) return; // A newer zoom took over.
      anim = ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140, fill: "forwards" });
    }
    await settle(anim, 500);
    if (gen === this.generation) this.cancel();
  }

  cancel() {
    window.clearTimeout(this.safety);
    const ghost = this.ghost();
    if (!ghost) return;
    ghost.getAnimations().forEach((a) => a.cancel());
    ghost.hidden = true;
    this.pending = null;
  }
}

/** An animation's end, or `ms` later at most: animations stall while the window isn't drawn. */
function settle(anim: Animation, ms: number): Promise<void> {
  return Promise.race([
    anim.finished.then(
      () => {},
      () => {},
    ),
    new Promise<void>((resolve) => window.setTimeout(resolve, ms)),
  ]);
}
