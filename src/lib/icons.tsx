import {
  AppWindow,
  Archive,
  Cloud,
  Code,
  Cog,
  EyeOff,
  File,
  FileText,
  Film,
  Folder,
  Image,
  Layers,
  Link,
  Link2,
  Lock,
  Music,
  type LucideIcon,
} from "lucide-react";
import { CATEGORY_VAR, categoryOf, type Category } from "./fileTypes";
import type { Kind } from "./types";

const CATEGORY_ICON: Record<Category, LucideIcon> = {
  video: Film,
  image: Image,
  audio: Music,
  archive: Archive,
  code: Code,
  document: FileText,
  app: AppWindow,
  system: Cog,
  other: File,
};

export function EntryIcon({ name, kind, size = 16 }: { name: string; kind: Kind | "rest"; size?: number }) {
  if (kind === "dir")
    return <Folder size={size} aria-hidden="true" style={{ color: "var(--folder-front)" }} fill="var(--folder-back)" />;
  if (kind === "denied") return <Lock size={size} aria-hidden="true" style={{ color: "var(--icon-warning)" }} />;
  if (kind === "link") return <Link2 size={size} aria-hidden="true" style={{ color: "var(--icon-subtlest)" }} />;
  if (kind === "excluded") return <EyeOff size={size} aria-hidden="true" style={{ color: "var(--icon-subtlest)" }} />;
  if (kind === "hardlink") return <Link size={size} aria-hidden="true" style={{ color: "var(--icon-subtlest)" }} />;
  if (kind === "rest") return <Layers size={size} aria-hidden="true" style={{ color: "var(--icon-subtlest)" }} />;
  const cat = categoryOf(name);
  const Icon = CATEGORY_ICON[cat];
  return <Icon size={size} aria-hidden="true" style={{ color: `var(${CATEGORY_VAR[cat]})` }} />;
}

/** Marks an online-only cloud file next to its name. */
export function OnlineBadge() {
  return (
    <Cloud
      size={13}
      className="online-badge"
      aria-label="Online only"
      role="img"
      data-tooltip="Online only: stored in the cloud, not on this drive"
    />
  );
}
