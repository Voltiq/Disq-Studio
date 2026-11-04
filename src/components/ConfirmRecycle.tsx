import { useCallback, useEffect, useRef, useState } from "react";
import { Trash2, X } from "lucide-react";
import { formatBytes, plural } from "../lib/format";
import type { NodeInfo, RecycleCheck } from "../lib/types";
import { confirmLabel } from "../lib/recycle";
import { RecycleSafety } from "./RecycleSafety";
import { Button, IconButton } from "./ui/Button";
import { SectionMessage } from "./ui/Feedback";

interface ConfirmRecycleProps {
  item: NodeInfo;
  busy: boolean;
  onConfirm: (allowPermanent: boolean) => void;
  /** Set when Settings allows it: delete for good instead, after a second confirmation. */
  onDeletePermanently?: () => void;
  onClose: () => void;
}

export function ConfirmRecycle({ item, busy, onConfirm, onDeletePermanently, onClose }: ConfirmRecycleProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const [permanent, setPermanent] = useState(false);
  const [check, setCheck] = useState<RecycleCheck | null>(null);
  const [allowPermanent, setAllowPermanent] = useState(false);
  const onCheck = useCallback((c: RecycleCheck | null) => setCheck(c), []);
  const blocked = !!check && check.blocked.length > 0;

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

  const isDir = item.kind === "dir" || item.kind === "denied";
  return (
    <div className="blanket" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-small" role="alertdialog" aria-modal="true" aria-labelledby="recycle-title">
        <div className="modal-header">
          <h2 className="modal-title" id="recycle-title">
            {blocked || permanent ? "Delete permanently?" : "Move to Recycle Bin?"}
          </h2>
          <IconButton icon={X} label="Close" onClick={onClose} />
        </div>
        <div className="modal-body">
          <p className="dialog-text">
            <span className="path-text">{item.name}</span>
            {/* Real sizes, not filtered ones: everything in a folder goes, matching or not. */}
            {isDir
              ? ` and everything in it (${plural(item.files, "file", "files")}, ${formatBytes(item.logical)})`
              : ` (${formatBytes(item.logical)})`}{" "}
            {blocked ? "would be deleted." : "will be moved to the Recycle Bin. You can restore it from there."}
          </p>
          <p className="inspector-path">{item.path}</p>
          {permanent ? (
            <SectionMessage appearance="danger" title="This can't be undone">
              It won't go to the Recycle Bin: it will be deleted for good, with no way to restore it.
            </SectionMessage>
          ) : (
            <RecycleSafety
              ids={[item.id]}
              allowPermanent={allowPermanent}
              onAllowPermanent={setAllowPermanent}
              onCheck={onCheck}
            />
          )}
        </div>
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
                disabled={!check || (blocked && !allowPermanent)}
                onClick={() => onConfirm(allowPermanent)}
              >
                {confirmLabel(check, 1, allowPermanent)}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
