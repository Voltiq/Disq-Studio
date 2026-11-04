import { forwardRef, useState } from "react";
import { Bookmark, BookmarkPlus, Search, Trash2, X } from "lucide-react";
import { CATEGORY_LABEL, CATEGORY_VAR, CATEGORIES, type Category } from "../lib/fileTypes";
import {
  describeFilter,
  EMPTY_FILTER,
  isActive,
  loadSavedSearches,
  sameFilter,
  storeSavedSearches,
  type FilterState,
  type SavedSearch,
} from "../lib/filterState";
import { formatBytes, plural } from "../lib/format";
import type { FilterSummary } from "../lib/types";
import { cx } from "../lib/utils";
import { Button, IconButton } from "./ui/Button";
import { Spinner } from "./ui/Feedback";
import { Menu, type MenuItem, type MenuRequest } from "./ui/Menu";

const SIZES = [
  { label: "Any size", bytes: 0 },
  { label: "1 MB or more", bytes: 1024 ** 2 },
  { label: "100 MB or more", bytes: 100 * 1024 ** 2 },
  { label: "1 GB or more", bytes: 1024 ** 3 },
];

const AGES: { value: FilterState["age"]; label: string }[] = [
  { value: "any", label: "Any time" },
  { value: "recent", label: "Changed in the last 30 days" },
  { value: "1y", label: "Not changed for 1 year" },
  { value: "3y", label: "Not changed for 3 years" },
];

interface FilterBarProps {
  value: FilterState;
  summary: FilterSummary | null;
  busy: boolean;
  onChange: (next: FilterState) => void;
}

export const FilterBar = forwardRef<HTMLInputElement, FilterBarProps>(function FilterBar(
  { value, summary, busy, onChange },
  inputRef,
) {
  const active = isActive(value);
  const [saved, setSaved] = useState<SavedSearch[]>(loadSavedSearches);
  const [menu, setMenu] = useState<MenuRequest | null>(null);
  const isSaved = saved.some((s) => sameFilter(s.filter, value));
  const updateSaved = (next: SavedSearch[]) => {
    setSaved(next);
    storeSavedSearches(next);
  };
  const openSaved = (anchor: HTMLElement) => {
    const items: MenuItem[] = [
      {
        label: isSaved ? "This search is saved" : "Save this search",
        icon: BookmarkPlus,
        disabled: !active || isSaved,
        onSelect: () => updateSaved([...saved, { name: describeFilter(value), filter: value }]),
      },
    ];
    if (saved.length) {
      items.push({ type: "separator" }, { type: "heading", label: "Saved searches" });
      for (const s of saved) {
        items.push({ label: s.name, icon: Bookmark, checked: sameFilter(s.filter, value), onSelect: () => onChange(s.filter) });
      }
      if (isSaved) {
        items.push(
          { type: "separator" },
          {
            label: "Forget this search",
            icon: Trash2,
            danger: true,
            onSelect: () => updateSaved(saved.filter((s) => !sameFilter(s.filter, value))),
          },
        );
      }
    }
    setMenu({ anchor, items });
  };
  const set = (patch: Partial<FilterState>) => onChange({ ...value, ...patch });
  const toggleCategory = (c: Category) =>
    set({
      categories: value.categories.includes(c) ? value.categories.filter((x) => x !== c) : [...value.categories, c],
    });

  return (
    <div className={cx("filter-bar", active && "is-active")} role="search">
      <label className="filter-search">
        <Search size={15} aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          value={value.text}
          placeholder="Search names: node_modules *.js, *.mp4|*.mkv, -*.log, Users\Me\Videos…"
          aria-label="Search file and folder names. Separate terms with spaces; all must match. a|b matches either, -term leaves matches out, a term with a backslash matches the full path."
          data-tooltip="Terms separated by spaces must all match a name or a folder above it. a|b: either. -term: leave out. A term with \ matches the full path. Quotes keep spaces."
          spellCheck={false}
          onChange={(e) => set({ text: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Escape" && value.text) {
              e.stopPropagation();
              set({ text: "" });
            }
          }}
        />
        <kbd className="kbd">Ctrl+F</kbd>
      </label>
      <IconButton
        icon={isSaved ? Bookmark : BookmarkPlus}
        label="Saved searches"
        selected={isSaved}
        onClick={(e) => openSaved(e.currentTarget)}
      />

      <div className="filter-chips" role="group" aria-label="File types">
        {CATEGORIES.map((c) => {
          const on = value.categories.includes(c);
          return (
            <button
              key={c}
              className={cx("chip", on && "is-selected")}
              aria-pressed={on}
              onClick={() => toggleCategory(c)}
            >
              <span className="swatch" style={{ background: `var(${CATEGORY_VAR[c]})` }} />
              {CATEGORY_LABEL[c].split(" ")[0]}
            </button>
          );
        })}
      </div>

      <select
        className="filter-select"
        aria-label="Minimum file size"
        value={value.minSize}
        onChange={(e) => set({ minSize: Number(e.target.value) })}
      >
        {SIZES.map((s) => (
          <option key={s.bytes} value={s.bytes}>
            {s.label}
          </option>
        ))}
      </select>
      <select
        className="filter-select"
        aria-label="Last changed"
        value={value.age}
        onChange={(e) => set({ age: e.target.value as FilterState["age"] })}
      >
        {AGES.map((a) => (
          <option key={a.value} value={a.value}>
            {a.label}
          </option>
        ))}
      </select>

      <div className="filter-status" aria-live="polite">
        {busy && <Spinner size={14} label="Filtering" />}
        {active && summary && (
          <span className="hud-stat">
            {plural(summary.files, "file", "files")} · {formatBytes(summary.bytes)}
          </span>
        )}
        {active && (
          <Button spacing="compact" appearance="subtle" iconBefore={X} onClick={() => onChange(EMPTY_FILTER)}>
            Clear
          </Button>
        )}
      </div>
      {menu && <Menu request={menu} onClose={() => setMenu(null)} />}
    </div>
  );
});
