import { useEffect, useState } from "react";
import { api, errorText } from "../lib/api";
import { formatBytes, plural } from "../lib/format";
import type { RecycleCheck } from "../lib/types";
import { SectionMessage, Spinner } from "./ui/Feedback";
import { t, te } from "../lib/i18n";

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
      <SectionMessage appearance="warning" title={t("Couldn't check the Recycle Bin")}>
        {error}
      </SectionMessage>
    );
  }
  if (!check) {
    return (
      <div className="safety-loading">
        <Spinner size={14} />
        <span className="hud-stat">{t("Checking the Recycle Bin…")}</span>
      </div>
    );
  }

  const blocked = check.blocked;
  const all = blocked.length === ids.length;
  const blockedBytes = blocked.reduce((s, b) => s + b.size, 0);
  const limit =
    check.maxBytes != null && (check.maxIsEstimate ? t("about {0}", formatBytes(check.maxBytes)) : formatBytes(check.maxBytes));

  return (
    <div className="safety">
      {blocked.length > 0 && (
        <SectionMessage
          appearance="danger"
          title={
            all
              ? t("These can't go to the Recycle Bin")
              : t("{0} can't go to the Recycle Bin", plural(blocked.length, "item", "items"))
          }
        >
          <p>
            {blocked.length === 1
              ? t("Windows would delete it permanently, with no way to restore it: {0}.", te(blocked[0].reason))
              : all
                ? t("Windows would delete them permanently, with no way to restore them.")
                : t("Windows would delete these permanently, with no way to restore them.")}
          </p>
          <ul className="safety-list">
            {blocked.slice(0, 3).map((b) => (
              <li key={b.id}>
                <span className="inspector-path">{b.path}</span>
                <span className="hud-stat">
                  {formatBytes(b.size)}
                  {blocked.length > 1 && ` · ${te(b.reason)}`}
                </span>
              </li>
            ))}
            {blocked.length > 3 && <li className="hud-stat">{t("and {0} more", blocked.length - 3)}</li>}
          </ul>
          <label className="safety-allow">
            <input type="checkbox" checked={allowPermanent} onChange={(e) => onAllowPermanent(e.target.checked)} />
            <span>
              {blocked.length === 1
                ? t("Delete it permanently ({0})", formatBytes(blockedBytes))
                : t("Delete these {0} permanently ({1})", blocked.length, formatBytes(blockedBytes))}
            </span>
          </label>
          {!allowPermanent && !all && (
            <p className="hud-stat">{t("Left unticked, they're skipped and everything else goes to the Recycle Bin.")}</p>
          )}
        </SectionMessage>
      )}

      {check.overflowBytes > 0 && (
        <SectionMessage appearance="warning" title={t("The Recycle Bin will make room")}>
          {t(
            "The Recycle Bin on {0} holds {1} and already has {2}. Windows will permanently remove about {3} of the oldest things in it to fit these.",
            check.root,
            limit || "",
            formatBytes(check.usedBytes),
            formatBytes(check.overflowBytes),
          )}
        </SectionMessage>
      )}

      {check.onlineItems > 0 && (
        <SectionMessage appearance="information" title={t("Online-only OneDrive files skip the Recycle Bin")}>
          {ids.length === 1
            ? t("This holds {0} of files that are only in the cloud.", formatBytes(check.onlineBytes))
            : check.onlineItems === 1
              ? t("1 of these holds {0} of files that are only in the cloud.", formatBytes(check.onlineBytes))
              : t("{0} of these hold {1} of files that are only in the cloud.", check.onlineItems, formatBytes(check.onlineBytes))}{" "}
          {t(
            "Deleting them removes them from OneDrive on all your devices. They can be restored from the OneDrive recycle bin on the web for 30 days (93 for work or school accounts), but not from Windows' Recycle Bin, and Undo can't bring them back.",
          )}
        </SectionMessage>
      )}

      {blocked.length === 0 && check.overflowBytes === 0 && (
        <p className="safety-ok">
          {limit
            ? t("Everything fits in the Recycle Bin on {0} ({1} of {2} used), so it can all be restored.", check.root, formatBytes(check.usedBytes), limit)
            : t("Everything fits in the Recycle Bin on {0}, so it can all be restored.", check.root)}
        </p>
      )}
    </div>
  );
}
