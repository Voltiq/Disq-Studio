/*
 * Settings as a file, to move them to another PC or keep a copy: every
 * preference kept in this window's storage (theme, colours, folders to skip,
 * rules, saved searches, list columns…) and the daily check.
 */

import { invoke } from "@tauri-apps/api/core";
import { api } from "./api";
import type { BackgroundConfig } from "./types";

const PREFIX = "disk-studio.";
const FORMAT = "disq-studio-settings";

interface SettingsFile {
  format: typeof FORMAT;
  version: 1;
  exportedAt: string;
  /** Storage key (without the prefix) → its stored text. */
  stored: Record<string, string>;
  background?: BackgroundConfig;
}

export async function exportSettings(path: string): Promise<void> {
  const stored: Record<string, string> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(PREFIX)) stored[key.slice(PREFIX.length)] = localStorage.getItem(key) ?? "";
    }
  } catch {
    // Storage unavailable: export what there is.
  }
  const background = await api.backgroundState().then((s) => s.config).catch(() => undefined);
  const file: SettingsFile = { format: FORMAT, version: 1, exportedAt: new Date().toISOString(), stored, background };
  await invoke("write_settings_file", { path, contents: JSON.stringify(file, null, 2) });
}

/** Reads a settings file and applies it; the window reloads afterwards to show it. Returns what changed. */
export async function importSettings(path: string): Promise<{ keys: number; background: boolean }> {
  const text = await invoke<string>("read_settings_file", { path });
  let file: SettingsFile;
  try {
    file = JSON.parse(text);
  } catch {
    throw new Error("That file isn't Disq Studio settings.");
  }
  if (file?.format !== FORMAT || typeof file.stored !== "object" || file.stored === null) {
    throw new Error("That file isn't Disq Studio settings.");
  }
  let keys = 0;
  for (const [key, value] of Object.entries(file.stored)) {
    // Only plain names and text values: nothing else gets written.
    if (!/^[A-Za-z0-9_.-]{1,64}$/.test(key) || typeof value !== "string") continue;
    localStorage.setItem(PREFIX + key, value);
    keys++;
  }
  let background = false;
  if (file.background && typeof file.background.enabled === "boolean") {
    await api.setBackground(file.background);
    background = true;
  }
  return { keys, background };
}
