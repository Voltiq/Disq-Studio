import { CATEGORY_LABEL, extsOf, knownExts, type Category } from "./fileTypes";
import { formatBytes } from "./format";
import type { FilterQuery } from "./types";
import { t } from "./i18n";

/** What the filter bar's controls are set to; turned into a query by `toQuery`. */
export interface FilterState {
  text: string;
  categories: Category[];
  minSize: number;
  age: "any" | "recent" | "1y" | "3y";
}

export const EMPTY_FILTER: FilterState = { text: "", categories: [], minSize: 0, age: "any" };

const DAY = 86_400_000;

export function toQuery(f: FilterState): FilterQuery {
  const now = Date.now();
  return {
    text: f.text.trim(),
    exts: f.categories.flatMap(extsOf),
    // "Other" has no list of its own: it's every extension no other type claims.
    otherThan: f.categories.includes("other") ? knownExts() : undefined,
    minSize: f.minSize || undefined,
    modifiedAfter: f.age === "recent" ? now - 30 * DAY : undefined,
    modifiedBefore: f.age === "1y" ? now - 365 * DAY : f.age === "3y" ? now - 3 * 365 * DAY : undefined,
  };
}

export function isActive(f: FilterState): boolean {
  return !!f.text.trim() || f.categories.length > 0 || f.minSize > 0 || f.age !== "any";
}

export function sameFilter(a: FilterState, b: FilterState): boolean {
  return (
    a.text.trim() === b.text.trim() &&
    a.minSize === b.minSize &&
    a.age === b.age &&
    a.categories.length === b.categories.length &&
    a.categories.every((c) => b.categories.includes(c))
  );
}

const AGE_LABEL: Record<FilterState["age"], string> = {
  any: "",
  recent: t("changed in 30 days"),
  "1y": t("unchanged 1 year"),
  "3y": t("unchanged 3 years"),
};

/** A short name for a saved search, from what it's set to. */
export function describeFilter(f: FilterState): string {
  const parts: string[] = [];
  if (f.text.trim()) parts.push(f.text.trim());
  if (f.categories.length) parts.push(f.categories.map((c) => CATEGORY_LABEL[c].split(" ")[0]).join(", "));
  if (f.minSize) parts.push(`≥ ${formatBytes(f.minSize)}`);
  if (f.age !== "any") parts.push(AGE_LABEL[f.age]);
  return parts.join(" · ");
}

// ----- Saved searches -----

export interface SavedSearch {
  name: string;
  filter: FilterState;
}

const SAVED_KEY = "disk-studio.savedSearches";

export function loadSavedSearches(): SavedSearch[] {
  try {
    const list = JSON.parse(localStorage.getItem(SAVED_KEY) ?? "[]");
    if (!Array.isArray(list)) return [];
    return list.filter(
      (s): s is SavedSearch =>
        typeof s?.name === "string" &&
        typeof s?.filter?.text === "string" &&
        Array.isArray(s.filter.categories) &&
        typeof s.filter.minSize === "number" &&
        typeof s.filter.age === "string",
    );
  } catch {
    return [];
  }
}

export function storeSavedSearches(list: SavedSearch[]) {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(list));
  } catch {
    // Not fatal: the list just won't be remembered.
  }
}
