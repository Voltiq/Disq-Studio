import { SearchX } from "lucide-react";
import type { ColumnLayout } from "../lib/columns";
import { plural } from "../lib/format";
import { EntryIcon, OnlineBadge } from "../lib/icons";
import type { FilterHit, FilterSummary } from "../lib/types";
import { cx } from "../lib/utils";
import { RowCells } from "./ListColumns";
import { EmptyState } from "./ui/Feedback";

interface MatchesListProps {
  summary: FilterSummary;
  layout: ColumnLayout;
  selectedIds: number[];
  onPick: (hit: FilterHit) => void;
  onContextMenu: (id: number, x: number, y: number) => void;
}

/** The outermost matches of the filter, largest first. */
export function MatchesList({ summary, layout, selectedIds, onPick, onContextMenu }: MatchesListProps) {
  const largest = summary.hits[0]?.size ?? 0;
  return (
    <div className="list" role="listbox" aria-label="Matches">
      {summary.hits.length === 0 && (
        <EmptyState icon={SearchX} title="Nothing matches" compact>
          Try fewer terms or conditions, or part of a name instead of all of it.
        </EmptyState>
      )}
      {summary.hits.map((hit) => {
        const isDir = hit.kind === "dir" || hit.kind === "denied";
        const dir = hit.path.slice(0, Math.max(0, hit.path.length - hit.name.length - 1));
        const isSelected = selectedIds.includes(hit.id);
        return (
          <button
            key={hit.id}
            role="option"
            aria-selected={isSelected}
            className={cx("row match-row", isSelected && "is-selected")}
            onClick={() => onPick(hit)}
            onContextMenu={(e) => {
              e.preventDefault();
              onContextMenu(hit.id, e.clientX, e.clientY);
            }}
            data-tooltip={hit.path}
          >
            <span className="row-icon">
              <EntryIcon name={hit.name} kind={hit.kind} />
            </span>
            <span className="match-text">
              <span className="row-name-wrap">
                <span className="row-name">{hit.name}</span>
                {hit.online && <OnlineBadge />}
              </span>
              <span className="file-hit-dir">
                {"‎" + dir}
                {isDir && ` · ${plural(hit.files, "file", "files")}`}
              </span>
            </span>
            <RowCells
              layout={layout}
              size={hit.size}
              whole={summary.bytes}
              files={isDir ? hit.files : null}
              modified={hit.modified}
            />
            <span className="row-bar" aria-hidden="true">
              <span
                className="row-bar-fill"
                style={{ display: "block", width: `${largest > 0 ? (hit.size / largest) * 100 : 0}%` }}
              />
            </span>
          </button>
        );
      })}
      {summary.totalHits > summary.hits.length && (
        <p className="hud-stat" style={{ padding: "var(--space-150)", textAlign: "center" }}>
          Showing the largest {summary.hits.length.toLocaleString()} of {summary.totalHits.toLocaleString()} matches
        </p>
      )}
    </div>
  );
}
