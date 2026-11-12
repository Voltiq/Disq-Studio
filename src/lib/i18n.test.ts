import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { de } from "./de";
import { setLanguage, t, te } from "./i18n";

/** Strings that stay the same in German: names, and sizes such as "64 KB". */
const SAME = /^(Disq|Studio|Disq Studio|English|Deutsch)$/;
const technical = (k: string) => SAME.test(k) || !/[A-Za-z]{3}/.test(k.replace(/\{\d+\}/g, ""));

describe("German", () => {
  it("has every interface string", () => {
    const keys: string[] = JSON.parse(execFileSync("node", ["scripts/i18n-wrap.mjs", "--keys"], { encoding: "utf8" }));
    expect(keys.length).toBeGreaterThan(400);
    const missing = keys.filter((k) => !(k in de) && !technical(k));
    expect(missing).toEqual([]);
  });

  it("keeps the placeholders of every string", () => {
    const holes = (s: string) => [...new Set([...s.matchAll(/\{(\d+)\}/g)].map((m) => m[1]))].sort().join();
    const wrong = Object.entries(de).filter(([en, own]) => holes(en) !== holes(own));
    expect(wrong.map(([en]) => en)).toEqual([]);
  });
});

describe("translation", () => {
  it("translates, fills in and falls back", () => {
    setLanguage("de");
    expect(t("{0} free of {1}", "12 GB", "500 GB")).toBe("12 GB von 500 GB frei");
    expect(t("Not in the table {0}", "x")).toBe("Not in the table x");
    setLanguage("en");
    expect(t("{0} free of {1}", "12 GB", "500 GB")).toBe("12 GB free of 500 GB");
  });

  it("translates messages from the Rust side", () => {
    setLanguage("de");
    expect(te("Nothing has been scanned yet.")).toBe("Es wurde noch nichts gescannt.");
    // Drive paths and sizes are placeholders.
    expect(te("D:\\ has no Recycle Bin")).toBe("D:\\ hat keinen Papierkorb");
    expect(te("bigger than the Recycle Bin on C:\\, which holds 12.5 GB")).toBe(
      "größer als der Papierkorb auf C:\\, der 12.5 GB fasst",
    );
    // A cleanup description with a number in it is found as it is.
    expect(te("Log files of 1 MB or more. Usually safe, but check none is a log you need.")).toMatch(/^Protokolldateien ab 1 MB/);
    // "Prefix: detail": the detail stays as it came.
    expect(te("Not a Disq Studio snapshot, or a damaged one: bad header")).toBe(
      "Keine Momentaufnahme von Disq Studio oder eine beschädigte: bad header",
    );
    expect(te("Something the table does not know")).toBe("Something the table does not know");
    setLanguage("en");
    expect(te("Nothing has been scanned yet.")).toBe("Nothing has been scanned yet.");
  });
});
