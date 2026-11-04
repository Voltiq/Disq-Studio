import { useEffect, useState } from "react";
import { api, errorText } from "../lib/api";
import { formatBytes, plural } from "../lib/format";
import type { RecycleCheck } from "../lib/types";
import { SectionMessage, Spinner } from "./ui/Feedback";

interface RecycleSafetyProps {
  ids: number[];
  allowPermanent: boolean;
  onAllowPermanent: (allow: boolean) => void;
  /** Reports the check once it's in, so the dialog can set its button. */
  onCheck: (check: RecycleCheck | null) => void;
}

/**
 * Says what will really happen before anything is deleted. Windows deletes
 * items it can't recycle permanently, without asking, so those are held
 * back unless the user ticks the box.
 */
export function RecycleSafety({ ids, allowPermanent, onAllowPermanent, onCheck }: RecycleSafetyProps) {
  const [check, setCheck] = useState<RecycleCheck | null>(null);
  const [error, setError] = useState<string | null>(null);
  const key = ids.join(",");

  useEffect(() => {
    let stale = false;
    setCheck(null);
    onCheck(null);
    api
      .recycleCheck(ids)
      .then((c) => {
        if (stale) return;
        setCheck(c);
        onCheck(c);
      })
      .catch((err) => !stale && setError(errorText(err)));
    return () => {
      stale = true;
    };
    // `ids` is compared by value through `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (error) {
    return (
      <SectionMessage appearance="warning" title="Couldn't check the Recycle Bin">
        {error}
      </SectionMessage>
    );
  }
  if (!check) {
    return (
      <div className="safety-loading">
        <Spinner size={14} />
        <span className="hud-stat">Checking the Recycle Bin…</span>
      </div>
    );
  }

  const blocked = check.blocked;
  const all = blocked.length === ids.length;
  const blockedBytes = blocked.reduce((s, b) => s + b.size, 0);
  const limit = check.maxBytes != null && `${check.maxIsEstimate ? "about " : ""}${formatBytes(check.maxBytes)}`;

  return (
    <div className="safety">
      {blocked.length > 0 && (
        <SectionMessage
          appearance="danger"
          title={
            all
              ? "These can't go to the Recycle Bin"
              : `${plural(blocked.length, "item", "items")} can't go to the Recycle Bin`
          }
        >
          <p>
            {blocked.length === 1
              ? `Windows would delete it permanently, with no way to restore it: ${blocked[0].reason}.`
              : `Windows would delete ${all ? "them" : "these"} permanently, with no way to restore them.`}
          </p>
          <ul className="safety-list">
            {blocked.slice(0, 3).map((b) => (
              <li key={b.id}>
                <span className="inspector-path">{b.path}</span>
                <span className="hud-stat">
                  {formatBytes(b.size)}
                  {blocked.length > 1 && ` · ${b.reason}`}
                </span>
              </li>
            ))}
            {blocked.length > 3 && <li className="hud-stat">and {blocked.length - 3} more</li>}
          </ul>
          <label className="safety-allow">
            <input type="checkbox" checked={allowPermanent} onChange={(e) => onAllowPermanent(e.target.checked)} />
            <span>
              Delete {blocked.length === 1 ? "it" : `these ${blocked.length}`} permanently ({formatBytes(blockedBytes)})
            </span>
          </label>
          {!allowPermanent && !all && (
            <p className="hud-stat">Left unticked, they're skipped and everything else goes to the Recycle Bin.</p>
          )}
        </SectionMessage>
      )}

      {check.overflowBytes > 0 && (
        <SectionMessage appearance="warning" title="The Recycle Bin will make room">
          The Recycle Bin on {check.root} holds {limit} and already has {formatBytes(check.usedBytes)}. Windows will
          permanently remove about {formatBytes(check.overflowBytes)} of the oldest things in it to fit these.
        </SectionMessage>
      )}

      {check.onlineItems > 0 && (
        <SectionMessage appearance="information" title="Online-only OneDrive files skip the Recycle Bin">
          {check.onlineItems === ids.length && ids.length === 1 ? "This holds " : `${plural(check.onlineItems, "of these holds", "of these hold")} `}
          {formatBytes(check.onlineBytes)} of files that are only in the cloud. Deleting them removes them from OneDrive
          on all your devices; they can be restored from the OneDrive recycle bin on the web for 30 days (93 for work
          or school accounts), not from Windows&apos; Recycle Bin. Undo can&apos;t bring them back.
        </SectionMessage>
      )}

      {check.onlineItems > 0 && (
        <SectionMessage appearance="information" title="Online-only OneDrive files skip the Recycle Bin">
          {ids.length === 1 ? "This holds " : `${plural(check.onlineItems, "of these holds", "of these hold")} `}
          {formatBytes(check.onlineBytes)} of files that are only in the cloud. Deleting them removes them from OneDrive
          on all your devices. They can be restored from the OneDrive recycle bin on the web for 30 days (93 for work
          or school accounts), but not from Windows' Recycle Bin, and Undo can't bring them back.
        </SectionMessage>
      )}

      {blocked.length === 0 && check.overflowBytes === 0 && (
        <p className="safety-ok">
          Everything fits in the Recycle Bin on {check.root}
          {limit && ` (${formatBytes(check.usedBytes)} of ${limit} used)`}, so it can all be restored.
        </p>
      )}
    </div>
  );
}
