import type { RecycleCheck } from "./types";

/** The confirm button's label, given what the Recycle Bin check found. */
export function confirmLabel(check: RecycleCheck | null, count: number, allowPermanent: boolean): string {
  if (!check || check.blocked.length === 0) return "Move to Recycle Bin";
  if (check.blocked.length === count) return allowPermanent ? "Delete permanently" : "Nothing can be recycled";
  return allowPermanent
    ? "Recycle and delete the rest"
    : `Recycle ${count - check.blocked.length}, skip ${check.blocked.length}`;
}
