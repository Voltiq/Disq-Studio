/*
 * A stand-in backend for working on the UI in a plain browser
 * (`npm run dev`, then open http://localhost:1420). It fakes Tauri's IPC with
 * a generated folder tree. Never loaded inside the real app.
 */

import type { Entry, FilterQuery, MapNode } from "./types";

interface FakeNode {
  id: number;
  name: string;
  /** Size in the current mode; copied from `logical` or `allocated`. */
  size: number;
  logical: number;
  allocated: number;
  online: number;
  /** Bytes of hard links at or under this node, counted under another name. */
  linked: number;
  /** For a hard link: the name its data is counted under. */
  linkTarget?: number;
  files: number;
  dirs: number;
  kind: "file" | "dir" | "hardlink";
  parent: number;
  children: number[];
  modified: number;
}

/** The pretend Recycle Bin on C:, sized like a real one on a 500 GB drive. */
const BIN_MAX = 25.2 * 1024 ** 3;
const BIN_USED = 3 * 1024 ** 3;

const EXTS = ["mp4", "mkv", "jpg", "png", "psd", "mp3", "wav", "zip", "iso", "rs", "js", "json", "pdf", "docx", "exe", "dll", "log", "tmp", "dat", "bin"];
const WORDS = ["Projects", "Photos", "Videos", "Music", "Games", "Steam", "Documents", "Downloads", "Backups", "node_modules", "target", "Cache", "Archive", "Renders", "Assets", "Temp", "Library", "Recordings"];

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

function build(): FakeNode[] {
  const rand = rng(7);
  const nodes: FakeNode[] = [];
  const make = (name: string, parent: number, depth: number): number => {
    const id = nodes.length;
    const node: FakeNode = { id, name, size: 0, logical: 0, allocated: 0, online: 0, linked: 0, files: 0, dirs: 0, kind: "dir", parent, children: [], modified: Date.now() - rand() * 3e10 };
    nodes.push(node);
    const fileCount = Math.floor(rand() * 14) + 2;
    for (let i = 0; i < fileCount; i++) {
      const ext = EXTS[Math.floor(rand() * EXTS.length)];
      const size = Math.floor(Math.exp(rand() * 20 + 4));
      // Mostly whole 4 KB clusters; some compressed, some online-only.
      const roll = rand();
      const allocated = roll < 0.08 ? 0 : roll < 0.16 ? Math.ceil((size * 0.4) / 4096) * 4096 : Math.ceil(size / 4096) * 4096;
      const fid = nodes.length;
      const online = roll < 0.08 ? size : 0;
      nodes.push({ id: fid, name: `file_${fid}.${ext}`, size, logical: size, allocated, online, linked: 0, files: 0, dirs: 0, kind: "file", parent: id, children: [], modified: Date.now() - rand() * 3e10 });
      node.children.push(fid);
    }
    // Now and then, a second name for a file elsewhere: a hard link, counted once.
    const earlier = nodes.filter((n) => n.kind === "file" && !n.online && n.parent !== id);
    if (depth > 0 && earlier.length && rand() < 0.3) {
      const target = earlier[Math.floor(rand() * earlier.length)];
      const lid = nodes.length;
      nodes.push({ id: lid, name: target.name, size: 0, logical: 0, allocated: 0, online: 0, linked: target.logical, linkTarget: target.id, files: 0, dirs: 0, kind: "hardlink", parent: id, children: [], modified: target.modified });
      node.children.push(lid);
    }
    if (depth < 4) {
      const dirCount = Math.floor(rand() * (depth === 0 ? 8 : 5)) + 1;
      for (let i = 0; i < dirCount; i++) {
        node.children.push(make(WORDS[Math.floor(rand() * WORDS.length)], id, depth + 1));
      }
    }
    for (const c of node.children) {
      const child = nodes[c];
      node.size += child.size;
      node.logical += child.logical;
      node.allocated += child.allocated;
      node.online += child.online;
      node.linked += child.linked;
      node.files += child.kind === "dir" ? child.files : 1;
      node.dirs += child.kind === "dir" ? 1 + child.dirs : 0;
    }
    node.children.sort((a, b) => nodes[b].size - nodes[a].size);
    return id;
  };
  make("C:\\", -1, 0);
  return nodes;
}

export function installMockBackend() {
  const nodes = build();
  const callbacks = new Map<number, (e: unknown) => void>();
  const listeners = new Map<string, number[]>();
  let nextCb = 1;
  let scanned = false;
  let mode: "logical" | "allocated" = "logical";
  let filter: { query: FilterQuery; counts: number[]; hits: number[] } | null = null;
  const snap = (at: number, i: number) => ({
    path: `C:\\Users\\Example\\AppData\\Local\\com.volti.disk-studio\\snapshots\\C_ ${i}.dss`,
    bytes: 31.8e6 - i * 4e5,
    root: "C:\\",
    scannedAt: at,
    files: 1_037 - i * 40,
    folders: 123,
    logical: 1.1e12,
    allocated: 9.6e11 - i * 2.5e10,
    errors: 3,
    fromMft: false,
    appVersion: "0.9.0",
    shrink: 1 - (i + 1) * 0.04,
  });
  let history = [snap(Date.now() - 864e5, 1), snap(Date.now() - 8 * 864e5, 2)];
  let background = { enabled: false, hour: 12, minFreePercent: 10, snapshotRoots: [] as string[], growAlertGb: 10 };

  // Same rules as filter.rs: every term matches a name (or the full path, with a
  // backslash) at or above the file; a|b is either; -term leaves things out.
  const recompute = () => {
    for (const n of nodes) n.size = mode === "allocated" ? n.allocated : n.logical;
    if (!filter) return;
    const q = filter.query;
    const toTest = (alt: string) =>
      /[*?]/.test(alt)
        ? ((re) => (s: string) => re.test(s))(
            new RegExp("^" + alt.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".") + "$"),
          )
        : (s: string) => s.includes(alt);
    const terms = (q.text.toLowerCase().match(/"[^"]*"|\S+/g) ?? []).map((raw) => {
      const negated = raw.length > 1 && raw.startsWith("-");
      const body = (negated ? raw.slice(1) : raw).replace(/"/g, "").replace(/\//g, "\\");
      const alts = body
        .split("|")
        .filter(Boolean)
        .map((alt) => {
          if (!alt.includes("\\")) return { test: toTest(alt), byPath: false };
          // A path pattern matches from any folder down unless it starts with * or a drive.
          const anchored = alt.startsWith("*") || alt[1] === ":";
          const text = /[*?]/.test(alt) && !anchored ? (alt.startsWith("\\") ? "*" : "*\\") + alt : alt;
          return { test: toTest(text), byPath: true };
        });
      return { negated, test: (name: string, p: string) => alts.some((a) => a.test(a.byPath ? p : name)) };
    });
    const include = terms.filter((t) => !t.negated);
    const exclude = terms.filter((t) => t.negated);
    const all = (1 << include.length) - 1;
    const exts = new Set(q.exts);
    const others = new Set(q.otherThan ?? []);
    const sizes = new Array(nodes.length).fill(0);
    const counts = new Array(nodes.length).fill(0);
    const matched = new Array(nodes.length).fill(0);
    const dead = new Array(nodes.length).fill(false);
    const hits: number[] = [];
    for (let i = 1; i < nodes.length; i++) {
      const n = nodes[i];
      dead[i] = dead[n.parent];
      if (dead[i] || n.kind === "hardlink") continue;
      const name = n.name.toLowerCase();
      const p = path(i).toLowerCase();
      if (exclude.some((t) => t.test(name, p))) {
        dead[i] = true;
        continue;
      }
      const above = matched[n.parent];
      const parentDone = include.length > 0 && above === all;
      const mask = include.reduce((m, t, b) => (t.test(name, p) ? m | (1 << b) : m), above);
      if (n.kind === "dir") {
        matched[i] = mask;
        if (include.length && mask === all && !parentDone) hits.push(i);
        continue;
      }
      if (mask !== all) continue;
      if (q.minSize && n.logical < q.minSize) continue;
      if (q.modifiedAfter && n.modified < q.modifiedAfter) continue;
      if (q.modifiedBefore && n.modified > q.modifiedBefore) continue;
      const ext = n.name.split(".").pop()!;
      if ((exts.size || others.size) && !exts.has(ext) && (!others.size || others.has(ext))) continue;
      sizes[i] = n.size;
      counts[i] = 1;
      if (!parentDone) hits.push(i);
    }
    for (let i = nodes.length - 1; i > 0; i--) {
      sizes[nodes[i].parent] += sizes[i];
      counts[nodes[i].parent] += counts[i];
    }
    nodes.forEach((n, i) => (n.size = sizes[i]));
    filter.counts = counts;
    filter.hits = hits.filter((h) => counts[h] > 0).sort((a, b) => sizes[b] - sizes[a]);
  };
  const visible = (id: number) => !filter || filter.counts[id] > 0;
  const filterResult = () => ({
    root: entry(0),
    summary: filter && {
      files: filter.counts[0],
      bytes: nodes[0].size,
      totalHits: filter.hits.length,
      hits: filter.hits.slice(0, 500).map((id) => {
        const n = nodes[id];
        return { id, parent: n.parent, name: n.name, path: path(id), kind: n.kind, size: n.size, files: filter!.counts[id], modified: n.modified, online: n.kind === "file" && n.online > 0 };
      }),
    },
  });

  const emit = (event: string, payload: unknown) =>
    (listeners.get(event) ?? []).forEach((id) => callbacks.get(id)?.({ event, id: 0, payload }));

  const entry = (id: number): Entry => {
    const n = nodes[id];
    return { id, name: n.name, size: n.size, logical: n.logical, allocated: n.allocated, online: n.online, linked: n.linked, files: n.files, dirs: n.dirs, modified: n.modified, kind: n.kind, hasChildren: n.children.length > 0 };
  };
  const path = (id: number): string => {
    const parts: string[] = [];
    for (let c = id; c > 0; c = nodes[c].parent) parts.unshift(nodes[c].name);
    return "C:\\" + parts.join("\\");
  };
  const map = (id: number, depth: number, min: number): MapNode => {
    const n = nodes[id];
    const out: MapNode = { id, name: n.name, size: n.size, kind: n.kind, online: n.kind === "file" && n.online > 0, modified: n.modified, children: [], rest: 0, restCount: 0 };
    if (depth === 0) return out;
    for (const c of n.children.filter(visible)) {
      if (nodes[c].size < min) {
        out.rest! += nodes[c].size;
        out.restCount! += 1;
      } else out.children!.push(map(c, depth - 1, min));
    }
    return out;
  };
  const filesUnder = (id: number): FakeNode[] => {
    const n = nodes[id];
    if (n.kind !== "dir") return n.kind === "file" ? [n] : [];
    return n.children.filter(visible).flatMap(filesUnder);
  };

  const handlers: Record<string, (a: any) => unknown> = {
    list_volumes: () => [
      { path: "C:\\", label: "Windows", fileSystem: "NTFS", kind: "fixed", total: 500e9, free: 180e9 },
      { path: "D:\\", label: "Data", fileSystem: "NTFS", kind: "fixed", total: 2e12, free: 1.1e12 },
    ],
    start_scan: () => {
      let t = 0;
      const timer = setInterval(() => {
        t += 100;
        emit("scan-progress", { generation: 1, files: t * 37, dirs: t, bytes: t * 4e6, allocated: t * 3.9e6, errors: 0, current: "C:\\Users\\Example\\AppData", elapsedMs: t });
        if (t >= 1200) {
          clearInterval(timer);
          scanned = true;
          emit("scan-done", { generation: 1, status: "done", root: entry(0), path: "C:\\", errors: 3, excluded: 0, fromMft: false, elapsedMs: t });
        }
      }, 100);
      return 1;
    },
    cancel_scan: () => null,
    find_duplicates: ({ id }) => {
      // Pretend real files of the same type are copies of each other, two or three at a time,
      // so selecting, recycling and linking them act on real nodes.
      const files = filesUnder(id)
        .filter((f) => f.kind === "file" && f.online === 0 && f.size > 1e6)
        .slice(0, 150);
      const groups: { size: number; files: { id: number; path: string; modified: number }[] }[] = [];
      for (let i = 0; i + 1 < files.length; ) {
        const n = 2 + (groups.length % 2);
        const set = files.slice(i, i + n).sort((a, b) => a.modified - b.modified);
        i += n;
        groups.push({ size: set[0].size, files: set.map((f) => ({ id: f.id, path: path(f.id), modified: f.modified })) });
      }
      groups.sort((a, b) => b.size * (b.files.length - 1) - a.size * (a.files.length - 1));
      let t = 0;
      const timer = setInterval(() => {
        t += 150;
        const phase = t < 600 ? "edges" : "full";
        emit("dup-progress", { generation: 1, phase, done: t, total: 1500, bytesDone: t * 2e6, bytesTotal: 1500 * 2e6, elapsedMs: t });
        if (t >= 1500) {
          clearInterval(timer);
          emit("dup-done", {
            generation: 1,
            status: "done",
            groups,
            totalGroups: groups.length,
            duplicateFiles: groups.reduce((s, g) => s + g.files.length - 1, 0),
            wasted: groups.reduce((s, g) => s + g.size * (g.files.length - 1), 0),
            candidates: 412,
            skipped: 2,
            cached: 187,
            elapsedMs: t,
          });
        }
      }, 150);
      return 1;
    },
    cancel_duplicates: () => null,
    set_size_mode: (args) => {
      mode = args.mode;
      recompute();
      return scanned ? entry(0) : null;
    },
    set_filter: ({ query }) => {
      const q = query as FilterQuery;
      const empty = !q.text.trim() && !q.exts.length && !q.otherThan?.length && !q.minSize && !q.modifiedAfter && !q.modifiedBefore;
      filter = empty ? null : { query: q, counts: [], hits: [] };
      recompute();
      return filterResult();
    },
    filter_results: () => filterResult(),
    // As in tree.rs: folders go whole only when every file in them matches.
    filter_selection: () => {
      const ids: number[] = [];
      const stack = [...(filter?.hits ?? [])];
      while (stack.length) {
        const id = stack.pop()!;
        const n = nodes[id];
        if (!filter || filter.counts[id] === 0) continue;
        if (n.kind === "file" || filter.counts[id] === n.files) ids.push(id);
        else stack.push(...n.children);
      }
      const bytes = ids.reduce((s, id) => s + nodes[id].allocated, 0);
      const files = ids.reduce((s, id) => s + (nodes[id].kind === "file" ? 1 : nodes[id].files), 0);
      const paths = [...ids].sort((a, b) => nodes[b].allocated - nodes[a].allocated).slice(0, 6).map(path);
      return { ids, bytes, files, paths };
    },
    find_junk: () => {
      // A rough stand-in for junk.rs: folder names only, on-disk sizes.
      const rules: [string, string, string, "safe" | "review", (n: FakeNode) => boolean][] = [
        ["temp", "Temporary files", "Files programs leave behind in the temp folders. Anything still in use is skipped.", "safe", (n) => n.kind === "dir" && n.name === "Temp"],
        ["browser", "Browser and app caches", "Copies of web pages, images and scripts kept to load faster. They refill as you browse.", "safe", (n) => n.kind === "dir" && n.name === "Cache"],
        ["build", "Developer build output", "node_modules, Rust target folders and Python caches. Rebuilt by npm install, cargo build and so on.", "review", (n) => n.kind === "dir" && (n.name === "node_modules" || n.name === "target")],
        ["logs", "Large log files", "Log files of 1 MB or more. Usually safe, but check none is a log you need.", "review", (n) => n.kind === "file" && n.name.endsWith(".log") && n.logical > 1e6],
      ];
      const claimed = new Set<number>();
      const found = new Map<string, number[]>();
      nodes.forEach((n, i) => {
        if (i === 0 || claimed.has(n.parent)) {
          if (i) claimed.add(i);
          return;
        }
        const rule = rules.find((r) => r[4](n));
        if (!rule || n.allocated < 1e6) return;
        if (n.kind === "dir") claimed.add(i);
        found.set(rule[0], [...(found.get(rule[0]) ?? []), i]);
      });
      return rules
        .filter((r) => found.has(r[0]))
        .map(([key, label, description, safety]) => {
          const ids = found.get(key)!.sort((a, b) => nodes[b].allocated - nodes[a].allocated);
          return {
            key,
            label,
            description,
            safety,
            total: ids.reduce((s, id) => s + nodes[id].allocated, 0),
            totalItems: ids.length,
            items: ids.map((id) => ({
              id,
              path: path(id),
              kind: nodes[id].kind,
              size: nodes[id].allocated,
              files: nodes[id].kind === "file" ? 1 : nodes[id].files,
              modified: nodes[id].modified,
            })),
          };
        });
    },
    recycle_check: ({ ids }) => {
      const blocked = (ids as number[])
        .filter((id) => nodes[id].allocated > BIN_MAX)
        .map((id) => ({ id, path: path(id), size: nodes[id].allocated, reason: "bigger than the Recycle Bin on C:\\, which holds 25.2 GB" }));
      const recyclable = (ids as number[])
        .filter((id) => nodes[id].allocated <= BIN_MAX)
        .reduce((s, id) => s + nodes[id].allocated, 0);
      return {
        root: "C:\\",
        hasBin: true,
        nukeOnDelete: false,
        maxBytes: BIN_MAX,
        maxIsEstimate: false,
        usedBytes: BIN_USED,
        selectedBytes: (ids as number[]).reduce((s, id) => s + nodes[id].allocated, 0),
        overflowBytes: Math.max(0, BIN_USED + recyclable - BIN_MAX),
        blocked,
        onlineItems: (ids as number[]).filter((id) => nodes[id].online > 0).length,
        onlineBytes: (ids as number[]).reduce((s, id) => s + nodes[id].online, 0),
      };
    },
    // As if every copy linked fine: each becomes a zero-size name, counted once.
    link_duplicates: ({ pairs }) => {
      const done: number[] = [];
      let freed = 0;
      for (const { copy } of pairs as { keep: number; copy: number }[]) {
        const n = nodes[copy];
        freed += n.allocated;
        for (let p = n.parent; p >= 0; p = nodes[p].parent) {
          nodes[p].logical -= n.logical;
          nodes[p].allocated -= n.allocated;
          nodes[p].linked += n.logical;
        }
        n.linked = n.logical;
        n.logical = n.allocated = 0;
        n.kind = "hardlink";
        done.push(copy);
      }
      recompute();
      return { root: entry(0), done, freed, failed: [] };
    },
    delete_each: ({ ids }) => ({
      root: entry(0),
      done: ids,
      freed: (ids as number[]).reduce((s, id) => s + nodes[id].allocated, 0),
      failed: [],
      kept: [],
      permanent: (ids as number[]).length,
    }),
    // Nothing is really removed here, so there's nothing to put back either.
    can_undo_recycle: () => true,
    undo_recycle: () => new Promise((resolve) => setTimeout(() => resolve({ root: entry(0), restored: 3, missing: 0, errors: 3 }), 400)),
    recycle_each: ({ ids, allowPermanent }) => {
      // Pretend the first item under a Temp folder is in use, to show the partial-failure path.
      const all = ids as number[];
      const locked = all.find((id) => path(id).includes("\\Temp"));
      const tooBig = (id: number) => nodes[id].allocated > BIN_MAX;
      const kept = allowPermanent ? [] : all.filter(tooBig);
      const done = all.filter((id) => id !== locked && !kept.includes(id));
      const issue = (id: number, error: string) => ({ id, path: path(id), error });
      return {
        root: entry(0),
        done,
        freed: done.reduce((s, id) => s + nodes[id].allocated, 0),
        failed: locked == null || kept.includes(locked) ? [] : [issue(locked, "The process cannot access the file because it is being used by another process.")],
        kept: kept.map((id) => issue(id, "bigger than the Recycle Bin")),
        permanent: done.filter(tooBig).length,
      };
    },
    startup_path: () => null,
    // Nothing changes on disk here, so a refresh finds the same folder again.
    refresh_folder: () => new Promise((resolve) => setTimeout(() => resolve({ root: entry(0), errors: 3 }), 700)),
    is_elevated: () => false,
    set_language: () => null,
    // As if the user said no to Windows' prompt.
    relaunch_as_admin: () => false,
    // The mock always reports through events, a little later.
    scan_result: () => null,
    find_path: ({ path: wanted }) => {
      const i = nodes.findIndex((_, id) => path(id).toLowerCase() === String(wanted).toLowerCase());
      return i < 0 ? null : i;
    },
    list_children: ({ id }) =>
      nodes[id].children
        .filter(visible)
        .map(entry)
        .sort((a, b) => b.size - a.size),
    node_info: ({ id }) => {
      const ancestors = [];
      for (let c = id; c >= 0; c = nodes[c].parent) ancestors.unshift({ id: c, name: nodes[c].name });
      const p = nodes[id].parent;
      const t = nodes[id].linkTarget;
      const linkTarget = t == null ? undefined : { id: t, path: path(t), logical: nodes[t].logical, allocated: nodes[t].allocated };
      return { ...entry(id), path: path(id), ancestors, parentSize: p >= 0 ? nodes[p].size : 0, rootSize: nodes[0].size, linkTarget };
    },
    treemap: ({ id, maxDepth, minSize }) => map(id, maxDepth, minSize),
    extensions: ({ id }) => {
      const by = new Map<string, { bytes: number; count: number }>();
      for (const f of filesUnder(id)) {
        const ext = f.name.split(".").pop()!;
        const s = by.get(ext) ?? { bytes: 0, count: 0 };
        s.bytes += f.size;
        s.count++;
        by.set(ext, s);
      }
      return [...by].map(([ext, s]) => ({ ext, ...s })).sort((a, b) => b.bytes - a.bytes);
    },
    largest_files: ({ id, limit }) =>
      filesUnder(id)
        .sort((a, b) => b.size - a.size)
        .slice(0, limit)
        .map((f) => ({ id: f.id, name: f.name, path: path(f.id), size: f.size, modified: f.modified, online: f.online > 0 })),
    "plugin:event|listen": ({ event, handler }) => {
      listeners.set(event, [...(listeners.get(event) ?? []), handler]);
      return handler;
    },
    "plugin:event|unlisten": () => null,
    // File dialogs: as if a file was picked.
    "plugin:dialog|save": ({ options }) => `C:\\Users\\Example\\Documents\\${options?.defaultPath ?? "export.html"}`,
    "plugin:dialog|open": () => "C:\\Users\\Example\\Documents\\older.dss",
    // History: two earlier scans of C:, a little smaller than now.
    save_snapshot: () => {
      history.unshift(snap(Date.now(), 0));
      return { path: history[0].path, bytes: history[0].bytes };
    },
    list_snapshots: ({ root }) => history.filter((s) => !root || s.root.toLowerCase() === String(root).toLowerCase()),
    snapshots_folder: () => "C:\\Users\\Example\\AppData\\Local\\com.volti.disk-studio\\snapshots",
    delete_snapshot: ({ path: p }) => {
      history = history.filter((s) => s.path !== p);
      return null;
    },
    open_snapshot: ({ path: p }) => {
      const s = history.find((x) => x.path === p) ?? history[0];
      return { root: entry(0), meta: s, errors: 3 };
    },
    compare_with: ({ path: p }) => {
      const s = history.find((x) => x.path === p) ?? history[0];
      const now = nodes[0].size;
      return { meta: s, before: Math.round(now * s.shrink), now, filesBefore: s.files, filesNow: nodes[0].files };
    },
    compare_close: () => null,
    // Pretend every other folder grew by a fifth since, and a few files are new or gone.
    compare_children: ({ id }) =>
      nodes[id].children.map((c, i) => {
        const n = nodes[c];
        const isNew = n.kind === "file" && i % 7 === 3;
        const before = isNew ? null : i % 2 ? Math.round(n.size * 0.8) : n.size;
        return {
          id: c,
          name: n.name,
          path: path(c),
          kind: n.kind,
          before,
          now: n.size,
          filesBefore: n.files,
          filesNow: n.files,
          canOpen: n.kind === "dir" && !isNew,
        };
      }).concat([{ id: null, name: "removed-cache", path: path(id) + "\\removed-cache", kind: "dir", before: 3.2e9, now: null, filesBefore: 812, filesNow: 0, canOpen: false }] as never[])
        .sort((a, b) => Math.abs((b.now ?? 0) - (b.before ?? 0)) - Math.abs((a.now ?? 0) - (a.before ?? 0))),
    compare_top: () => {
      const files = nodes.filter((n) => n.kind === "file" && n.size > 1e8).slice(0, 40);
      const d = (n: FakeNode, before: number | null, now: number | null) => ({
        id: now == null ? null : n.id, name: n.name, path: path(n.id), kind: n.kind, before, now, filesBefore: 1, filesNow: 1, canOpen: false,
      });
      return {
        grew: files.slice(0, 15).map((n) => d(n, Math.round(n.size * 0.6), n.size)),
        shrank: files.slice(15, 25).map((n) => d(n, Math.round(n.size * 1.5), n.size)),
        added: files.slice(25, 35).map((n) => d(n, null, n.size)),
        removed: files.slice(35, 40).map((n) => d(n, n.size, null)),
      };
    },
    export_report: () => 1037,
    background_state: () => ({ config: background, scheduled: background.enabled }),
    set_background: ({ config }) => {
      background = config;
      return { config, scheduled: config.enabled };
    },
    check_now: () => new Promise((resolve) => setTimeout(() => resolve([{ title: "C: is getting full", body: "18.2 GB free of 465 GB (4%)." }]), 600)),
  };

  (window as any).__TAURI_INTERNALS__ = {
    transformCallback: (cb: (e: unknown) => void) => {
      const id = nextCb++;
      callbacks.set(id, cb);
      return id;
    },
    unregisterCallback: (id: number) => callbacks.delete(id),
    invoke: async (cmd: string, args: any) => {
      const handler = handlers[cmd];
      if (!handler) throw new Error(`Not available in the browser preview: ${cmd}`);
      return handler(args ?? {});
    },
    metadata: { currentWindow: { label: "main" }, currentWebview: { windowLabel: "main", label: "main" } },
  };
  (window as any).__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} };
}
