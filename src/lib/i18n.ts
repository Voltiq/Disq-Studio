/*
 * Translation, as in Inq and Uplinq Studio. English is the language the
 * interface is written in; the English text is also the key.
 * `t("Scan {0}", path)` gives the text in the language in use, or the
 * English when a translation is missing. Placeholders are numbered:
 * t("{0} of {1}", 3, 12).
 *
 * The language is fixed when the app starts (from Settings, or from
 * Windows), because labels are also built once when the modules load.
 * Changing it in Settings applies at the next start.
 */

import { de } from "./de";
import { es } from "./es";
import { fr } from "./fr";

export type Language = "en" | "de" | "es" | "fr";
export type LanguageChoice = Language | "system";
export const LANGUAGES: Language[] = ["en", "de", "es", "fr"];

/** Where the language choice is kept; read here directly so it's known before anything renders. */
const KEY = "disk-studio.language";

export function languageChoice(): LanguageChoice {
  try {
    const saved = localStorage.getItem(KEY);
    if (LANGUAGES.includes(saved as Language)) return saved as Language;
  } catch {
    // Storage unavailable: follow Windows.
  }
  return "system";
}

export function saveLanguageChoice(choice: LanguageChoice) {
  try {
    if (choice === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, choice);
  } catch {
    // Not fatal: the choice just won't be remembered.
  }
}

function detect(): Language {
  const choice = languageChoice();
  if (choice !== "system") return choice;
  const system = (typeof navigator === "undefined" ? "en" : navigator.language).slice(0, 2).toLowerCase();
  return LANGUAGES.includes(system as Language) ? (system as Language) : "en";
}

let language: Language = detect();
const tables: Record<Language, Record<string, string>> = { en: {}, de, es, fr };

if (typeof document !== "undefined") document.documentElement.lang = language;

export function currentLanguage(): Language {
  return language;
}

/** The locale dates and numbers are written in: the interface's, not whatever Windows is set to. */
export function locale(): string {
  return { en: "en-GB", de: "de-DE", es: "es-ES", fr: "fr-FR" }[language];
}

/** For tests. */
export function setLanguage(l: Language) {
  language = l;
}

export function t(text: string, ...args: (string | number | null | undefined)[]): string {
  const found = tables[language][text] ?? text;
  return args.length ? found.replace(/\{(\d+)\}/g, (_, i) => String(args[Number(i)] ?? "")) : found;
}

/**
 * Text that comes from the Rust side (errors, cleanup categories). It is
 * written in English; sentences the table knows are shown translated, with
 * their numbers, paths and quoted names put back in. Unknown text stays English.
 */
export function te(text: string): string {
  if (language === "en" || !text) return text;
  const table = tables[language];
  const direct = table[text];
  if (direct) return direct;

  // "C:\ has no Recycle Bin" matches the key "{0} has no Recycle Bin": paths, sizes,
  // numbers and quoted names are placeholders.
  const args: string[] = [];
  const key = text.replace(/“[^”]*”|[A-Za-z]:\\[^\s,;)]*|\d+(?:[.,]\d+)?(?: (?:bytes|KB|MB|GB|TB|Ko|Mo|Go|To))?/g, (m) => {
    args.push(m);
    return `{${args.length - 1}}`;
  });
  const found = table[key];
  if (found) return found.replace(/\{(\d+)\}/g, (_, i) => args[Number(i)] ?? "");

  // Details from Windows at the end, "… (Access is denied. (os error 5))": the sentence
  // is translated, the details stay as they came.
  const colon = /^([^:]{3,}): (.+)$/s.exec(text);
  if (colon) {
    const head = table[`${colon[1]}: {0}`];
    if (head) return head.replace("{0}", colon[2]);
  }
  return text;
}
