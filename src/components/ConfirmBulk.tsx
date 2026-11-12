import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Trash2, X } from "lucide-react";
import { formatBytes, plural } from "../lib/format";
import type { RecycleCheck } from "../lib/types";
import { confirmLabel } from "../lib/recycle";
import { RecycleSafety } from "./RecycleSafety";
import { Button, IconButton } from "./ui/Button";
import { SectionMessage } from "./ui/Feedback";
import { t, locale } from "../lib/i18n";
import { tx } from "../lib/tx";

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
              ? t("Delete {0} permanently?", plural(count, "item", "items"))
              : t("Move {0} to the Recycle Bin?", plural(count, "item", "items"))}
          </h2>
          <IconButton icon={X} label={t("Close")} onClick={onClose} />
        </div>
        {permanent ? (
          <div className="modal-body">
            <SectionMessage appearance="danger" title={t("This can't be undone")}>
              {count === 1
                ? t("Nothing goes to the Recycle Bin: 1 item ({0}) will be deleted for good, with no way to restore it.", formatBytes(bytes))
                : t("Nothing goes to the Recycle Bin: {0} items ({1}) will be deleted for good, with no way to restore them.", count.toLocaleString(locale()), formatBytes(bytes))}
            </SectionMessage>
            <ul className="dup-confirm-list">
              {paths.map((p, i) => (
                <li key={i} className="inspector-path">
                  {p}
                </li>
              ))}
              {count > paths.length && <li className="hud-stat">{t("and {0} more", (count - paths.length).toLocaleString(locale()))}</li>}
            </ul>
          </div>
        ) : (
        <div className="modal-body">
          <p className="dialog-text">
            {tx(
              "This frees about {0} once the Recycle Bin is emptied, and you can restore anything from there until then.",
              <span className="path-text">{formatBytes(bytes)}</span>,
            )}
          </p>
          {note && <div className="dialog-text">{note}</div>}
          <ul className="dup-confirm-list">
            {paths.map((p, i) => (
              <li key={i} className="inspector-path">
                {p}
              </li>
            ))}
            {count > paths.length && <li className="hud-stat">{t("and {0} more", (count - paths.length).toLocaleString(locale()))}</li>}
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
                {t("Back")}
              </Button>
              <Button appearance="danger" iconBefore={Trash2} loading={busy} onClick={onDeletePermanently}>
                {t("Delete permanently")}
              </Button>
            </>
          ) : (
            <>
              {onDeletePermanently && (
                <Button appearance="subtle" className="footer-start" onClick={() => setPermanent(true)} disabled={busy}>
                  {t("Delete permanently…")}
                </Button>
              )}
              <Button appearance="subtle" onClick={onClose}>
                {t("Cancel")}
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
