/*
 * File-type categories for colouring the treemap. Colours come from the
 * Graphiq decorative accents, so they follow the theme.
 */

import { t } from "./i18n";

export type Category =
  | "video"
  | "image"
  | "audio"
  | "archive"
  | "code"
  | "document"
  | "app"
  | "system"
  | "other";

export const CATEGORY_LABEL: Record<Category, string> = {
  video: t("Video"),
  image: t("Images"),
  audio: t("Audio"),
  archive: t("Archives & disk images"),
  code: t("Code & data"),
  document: t("Documents"),
  app: t("Programs"),
  system: t("System & cache"),
  other: t("Other"),
};

/** CSS variable holding each category's colour. */
export const CATEGORY_VAR: Record<Category, string> = {
  video: "--accent-orange",
  image: "--accent-teal",
  audio: "--accent-magenta",
  archive: "--accent-yellow",
  code: "--accent-blue",
  document: "--accent-lime",
  app: "--accent-purple",
  system: "--accent-red",
  other: "--accent-gray",
};

const GROUPS: Record<Exclude<Category, "other">, string[]> = {
  video: ["mp4", "mkv", "mov", "avi", "wmv", "webm", "m4v", "flv", "mpg", "mpeg", "ts", "m2ts", "braw", "r3d", "prproj"],
  image: ["jpg", "jpeg", "png", "gif", "bmp", "tif", "tiff", "webp", "heic", "heif", "raw", "cr2", "cr3", "nef", "arw", "dng", "psd", "psb", "svg", "ico", "kra", "xcf", "exr", "hdr"],
  audio: ["mp3", "wav", "flac", "aac", "ogg", "m4a", "wma", "aiff", "aif", "opus", "mid", "midi"],
  archive: ["zip", "rar", "7z", "tar", "gz", "bz2", "xz", "zst", "iso", "img", "vhd", "vhdx", "vmdk", "qcow2", "dmg", "cab", "wim", "esd"],
  code: ["js", "ts", "tsx", "jsx", "rs", "py", "c", "cpp", "h", "hpp", "cs", "java", "go", "rb", "php", "json", "xml", "yaml", "yml", "toml", "html", "css", "sql", "db", "sqlite", "rlib", "rmeta", "pdb", "o", "obj", "lib", "a", "pack", "idx", "map", "wasm"],
  document: ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "odt", "ods", "odp", "txt", "md", "rtf", "csv", "epub", "pst", "ost"],
  app: ["exe", "msi", "msix", "appx", "dll", "sys", "apk", "jar", "app", "pak", "bin", "dat", "unity3d", "assets", "bundle", "uasset", "ucas", "utoc", "vpk"],
  system: ["tmp", "temp", "log", "bak", "old", "cache", "etl", "evtx", "dmp", "mdmp", "pf", "cab_", "chk", "swp", "lock"],
};

const BY_EXT = new Map<string, Category>();
for (const [cat, exts] of Object.entries(GROUPS)) {
  for (const ext of exts) BY_EXT.set(ext, cat as Category);
}

const SYSTEM_NAMES = new Set(["pagefile.sys", "hiberfil.sys", "swapfile.sys", "memory.dmp"]);

export function extensionOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i > 0 && i < name.length - 1 ? name.slice(i + 1).toLowerCase() : "";
}

export function categoryOf(name: string): Category {
  if (SYSTEM_NAMES.has(name.toLowerCase())) return "system";
  return categoryOfExt(extensionOf(name));
}

export function categoryOfExt(ext: string): Category {
  return BY_EXT.get(ext) ?? "other";
}

export const CATEGORIES = Object.keys(CATEGORY_VAR) as Category[];

/** Extensions in a category; "other" has no fixed list, so it has none. */
export function extsOf(category: Category): string[] {
  return category === "other" ? [] : GROUPS[category];
}

/** Every extension some category other than "other" claims. */
export function knownExts(): string[] {
  return [...BY_EXT.keys()];
}
