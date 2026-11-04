/*
 * Preferences kept between runs. Theme and size mode have their own keys
 * (theme.ts, api.ts); everything newer lives here under one key.
 */

export type Units = "binary" | "decimal";

export interface Prefs {
  /** One accent colour; tokens.css derives every other accent shade from it. */
  accent: string;
  /** "binary": 1 KB = 1,024 bytes, as Windows shows. "decimal": 1 kB = 1,000 bytes, as drives are sold. */
  units: Units;
  /** Folders never to scan, as full paths. */
  excludes: string[];
  /** How the folder in view is drawn. */
  mapView: "treemap" | "sunburst";
  /** What a file's colour stands for. */
  colorBy: "type" | "age";
  /** Shade treemap blocks as cushions, so nesting shows. */
  cushions: boolean;
  /** Extra cleanup rules, written like search terms. */
  cleanupRules: string[];
  /** Offer "Delete permanently" in delete confirmations. Off unless turned on in Settings. */
  allowPermanentDelete: boolean;
  /** Keep a snapshot of every finished scan, for History and comparisons. */
  keepHistory: boolean;
}

/** The Graphiq accent choices. */
export const ACCENTS = [
  { name: "Violet", value: "#6457F0" },
  { name: "Blue", value: "#2563EB" },
  { name: "Raspberry", value: "#C2336A" },
  { name: "Teal", value: "#0E7C64" },
];

export const DEFAULT_PREFS: Prefs = {
  accent: ACCENTS[0].value,
  units: "binary",
  excludes: [],
  mapView: "treemap",
  colorBy: "type",
  cushions: false,
  cleanupRules: [],
  allowPermanentDelete: false,
  keepHistory: true,
};

const KEY = "disk-studio.prefs";

export function loadPrefs(): Prefs {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return {
      accent: ACCENTS.some((a) => a.value === saved.accent) ? saved.accent : DEFAULT_PREFS.accent,
      units: saved.units === "decimal" ? "decimal" : "binary",
      excludes: Array.isArray(saved.excludes) ? saved.excludes.filter((p: unknown) => typeof p === "string") : [],
      mapView: saved.mapView === "sunburst" ? "sunburst" : "treemap",
      colorBy: saved.colorBy === "age" ? "age" : "type",
      cushions: saved.cushions === true,
      cleanupRules: Array.isArray(saved.cleanupRules) ? saved.cleanupRules.filter((r: unknown) => typeof r === "string") : [],
      allowPermanentDelete: saved.allowPermanentDelete === true,
      keepHistory: saved.keepHistory !== false,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(prefs: Prefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // Not fatal: the settings just won't be remembered.
  }
}

export function applyAccent(accent: string) {
  document.documentElement.style.setProperty("--accent", accent);
}
