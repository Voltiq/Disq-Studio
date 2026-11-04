import { useEffect, useRef } from "react";
import { FolderSearch, ShoppingBasket, Trash2, X } from "lucide-react";
import { formatBytes, plural } from "../lib/format";
import { EntryIcon } from "../lib/icons";
import type { BasketItem } from "./Duplicates";
import { Button, IconButton } from "./ui/Button";
import { EmptyState } from "./ui/Feedback";

interface BasketProps {
  items: BasketItem[];
  onRemove: (path: string) => void;
  onClear: () => void;
  onReveal: (path: string) => void;
  /** Recycle everything in the basket (asks first, with the Recycle Bin check). */
  onRecycleAll: () => void;
  onClose: () => void;
}

function splitPath(path: string) {
  const i = Math.max(path.lastIndexOf("\\"), path.lastIndexOf("/"));
  return { dir: path.slice(0, i), name: path.slice(i + 1) };
}

/** Things collected from the map, Duplicates and Cleanup, to review and recycle in one go. */
export function Basket({ items, onRemove, onClear, onReveal, onRecycleAll, onClose }: BasketProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const total = items.reduce((s, i) => s + i.size, 0);
  const sorted = [...items].sort((a, b) => b.size - a.size);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return (
    <div className="blanket" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-medium basket" role="dialog" aria-modal="true" aria-labelledby="basket-title">
        <div className="modal-header">
          <h2 className="modal-title" id="basket-title">
            Cleanup basket
          </h2>
          <IconButton ref={closeRef} icon={X} label="Close" onClick={onClose} />
        </div>
        <div className="modal-body">
          {items.length === 0 ? (
            <EmptyState icon={ShoppingBasket} title="The basket is empty" compact>
              Add things from the map (right-click › Add to basket), from Duplicates or from Cleanup, then recycle them
              all here in one go.
            </EmptyState>
          ) : (
            <>
              <p className="dialog-text">
                {plural(items.length, "item", "items")}, about <span className="path-text">{formatBytes(total)}</span> on
                disk. Nothing is removed until you recycle them.
              </p>
              <ul className="basket-list">
                {sorted.map((item) => {
                  const { dir, name } = splitPath(item.path);
                  return (
                    <li key={item.path} className="dup-file">
                      <span className="dup-check">
                        <EntryIcon name={name} kind={item.kind} />
                        <span className="dup-file-text">
                          <span className="dup-file-name">{name}</span>
                          <span className="dup-file-dir">{"‎" + dir}</span>
                        </span>
                      </span>
                      <span className="junk-size mono">{formatBytes(item.size)}</span>
                      <span className="dup-file-actions">
                        <IconButton icon={FolderSearch} label="Show in Explorer" spacing="compact" onClick={() => onReveal(item.path)} />
                        <IconButton icon={X} label={`Take ${name} out of the basket`} spacing="compact" onClick={() => onRemove(item.path)} />
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
        <div className="modal-footer">
          {items.length > 0 && (
            <Button appearance="subtle" className="footer-start" onClick={onClear}>
              Empty the basket
            </Button>
          )}
          <Button appearance="subtle" onClick={onClose}>
            Close
          </Button>
          <Button appearance="danger" iconBefore={Trash2} disabled={items.length === 0} onClick={onRecycleAll}>
            Recycle all
          </Button>
        </div>
      </div>
    </div>
  );
}
