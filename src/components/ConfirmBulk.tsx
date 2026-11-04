import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Trash2, X } from "lucide-react";
import { formatBytes, plural } from "../lib/format";
import type { RecycleCheck } from "../lib/types";
import { confirmLabel } from "../lib/recycle";
import { RecycleSafety } from "./RecycleSafety";
import { Button, IconButton } from "./ui/Button";
import { SectionMessage } from "./ui/Feedback";

interface ConfirmBulkProps {
  ids: number[];
  bytes: number;
  /** A few of the paths, to show what's going. */
  paths: string[];
  busy: boolean;
  /** Extra lines under the summary, specific to where the items came from. */
  note?: ReactNode;
  onConfirm: (allowPermanent: boolean) => void;
  /** Set when Settings allows it: delete for good instead, after a second confirmation. */
  onDeletePermanently?: () => void;
  onClose: () => void;
}

/** Asks before moving several items to the Recycle Bin. */
export function ConfirmBulk({ ids, bytes, paths, busy, note, onConfirm, onDeletePermanently, onClose }: ConfirmBulkProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const [permanent, setPermanent] = useState(false);
  const [check, setCheck] = useState<RecycleCheck | null>(null);
  const [allowPermanent, setAllowPermanent] = useState(false);
  const onCheck = useCallback((c: RecycleCheck | null) => setCheck(c), []);
  const count = ids.length;
  const nothingToDo = !!check && check.blocked.length === count && !allowPermanent;

  useEffect(() => {
    confirmRef.current?.focus();
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
      <div className="modal modal-medium" role="alertdialog" aria-modal="true" aria-labelledby="bulk-title">
        <div className="modal-header">
          <h2 className="modal-title" id="bulk-title">
            {permanent
              ? `Delete ${plural(count, "item", "items")} permanently?`
              : `Move ${plural(count, "item", "items")} to the Recycle Bin?`}
          </h2>
          <IconButton icon={X} label="Close" onClick={onClose} />
        </div>
        {permanent ? (
          <div className="modal-body">
            <SectionMessage appearance="danger" title="This can't be undone">
              Nothing goes to the Recycle Bin: {plural(count, "item", "items")} ({formatBytes(bytes)}) will be deleted for
              good, with no way to restore {count === 1 ? "it" : "them"}.
            </SectionMessage>
            <ul className="dup-confirm-list">
              {paths.map((p, i) => (
                <li key={i} className="inspector-path">
                  {p}
                </li>
              ))}
              {count > paths.length && <li className="hud-stat">and {(count - paths.length).toLocaleString()} more</li>}
            </ul>
          </div>
        ) : (
        <div className="modal-body">
          <p className="dialog-text">
            This frees about <span className="path-text">{formatBytes(bytes)}</span> once the Recycle Bin is emptied,
            and you can restore anything from there until then.
          </p>
          {note && <div className="dialog-text">{note}</div>}
          <ul className="dup-confirm-list">
            {paths.map((p, i) => (
              <li key={i} className="inspector-path">
                {p}
              </li>
            ))}
            {count > paths.length && <li className="hud-stat">and {(count - paths.length).toLocaleString()} more</li>}
          </ul>
          <RecycleSafety
            ids={ids}
            allowPermanent={allowPermanent}
            onAllowPermanent={setAllowPermanent}
            onCheck={onCheck}
          />
        </div>
        )}
        <div className="modal-footer">
          {permanent ? (
            <>
              <Button appearance="subtle" onClick={() => setPermanent(false)} disabled={busy}>
                Back
              </Button>
              <Button appearance="danger" iconBefore={Trash2} loading={busy} onClick={onDeletePermanently}>
                Delete permanently
              </Button>
            </>
          ) : (
            <>
              {onDeletePermanently && (
                <Button appearance="subtle" className="footer-start" onClick={() => setPermanent(true)} disabled={busy}>
                  Delete permanently…
                </Button>
              )}
              <Button appearance="subtle" onClick={onClose}>
                Cancel
              </Button>
              <Button
                ref={confirmRef}
                appearance="danger"
                iconBefore={Trash2}
                loading={busy}
                disabled={!check || nothingToDo}
                onClick={() => onConfirm(allowPermanent)}
              >
                {confirmLabel(check, count, allowPermanent)}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
