import type { RecycleCheck } from "./types";
import { t } from "./i18n";

/** The confirm button's label, given what the Recycle Bin check found. */
export function confirmLabel(check: RecycleCheck | null, count: number, allowPermanent: boolean): string {
  if (!check || check.blocked.length === 0) return t("Move to Recycle Bin");
  if (check.blocked.length === count) return allowPermanent ? t("Delete permanently") : t("Nothing can be recycled");
  return allowPermanent
    ? t("Recycle and delete the rest")
    : t("Recycle {0}, skip {1}", count - check.blocked.length, check.blocked.length);
}
