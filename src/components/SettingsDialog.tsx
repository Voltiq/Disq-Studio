import { useEffect, useRef, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { open as pickFolder, save as pickSaveFile } from "@tauri-apps/plugin-dialog";
import { exportSettings, importSettings } from "../lib/settingsFile";
import { findUpdate, installUpdate, type Update } from "../lib/updates";
import { BellRing, Check, CloudDownload, FileDown, FileUp, FolderMinus, FolderPlus, ListPlus, RefreshCw, ShieldCheck, Trash2, X } from "lucide-react";
import { api, errorText, SIZE_MODE_LABEL } from "../lib/api";
import type { BackgroundConfig, Finding, Volume } from "../lib/types";
import { ACCENTS, type Prefs } from "../lib/settings";
import type { SizeMode, ThemePreference } from "../lib/types";
import { cx } from "../lib/utils";
import { Button, IconButton } from "./ui/Button";

interface SettingsDialogProps {
  theme: ThemePreference;
  sizeMode: SizeMode;
  prefs: Prefs;
  /** True when a scan is open, so excluded-folder changes can offer a rescan. */
  canRescan: boolean;
  /** Running as administrator. */
  elevated: boolean;
  /** Drives, for choosing which the background check scans. */
  volumes: Volume[] | null;
  onRelaunchAsAdmin: () => void;
  onTheme: (theme: ThemePreference) => void;
  onSizeMode: (mode: SizeMode) => void;
  onPrefs: (prefs: Prefs) => void;
  onRescan: () => void;
  onClose: () => void;
}

const THEMES: { value: ThemePreference; label: string }[] = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
  { value: "system", label: "Follow Windows" },
];

/** Every change applies straight away; there's nothing to save. */
export function SettingsDialog({
  theme,
  sizeMode,
  prefs,
  canRescan,
  elevated,
  volumes,
  onRelaunchAsAdmin,
  onTheme,
  onSizeMode,
  onPrefs,
  onRescan,
  onClose,
}: SettingsDialogProps) {
  const doneRef = useRef<HTMLButtonElement>(null);
  const [version, setVersion] = useState<string | null>(null);
  const [excludesChanged, setExcludesChanged] = useState(false);
  const [rule, setRule] = useState("");
  const [bg, setBg] = useState<BackgroundConfig | null>(null);
  const [scheduled, setScheduled] = useState(false);
  const [bgBusy, setBgBusy] = useState(false);
  const [bgError, setBgError] = useState<string | null>(null);
  const [findings, setFindings] = useState<Finding[] | null>(null);

  useEffect(() => {
    api
      .backgroundState()
      .then((s) => {
        setBg(s.config);
        setScheduled(s.scheduled);
      })
      .catch((e) => setBgError(errorText(e)));
  }, []);

  /** Saves the background settings, which also sets up or removes the daily task. */
  async function updateBg(next: BackgroundConfig) {
    setBg(next);
    setBgBusy(true);
    setBgError(null);
    try {
      const s = await api.setBackground(next);
      setScheduled(s.scheduled);
    } catch (e) {
      setBgError(errorText(e));
    } finally {
      setBgBusy(false);
    }
  }

  async function checkNow() {
    setBgBusy(true);
    setFindings(null);
    try {
      setFindings(await api.checkNow());
    } catch (e) {
      setBgError(errorText(e));
    } finally {
      setBgBusy(false);
    }
  }

  function addRule() {
    const text = rule.trim();
    if (!text || prefs.cleanupRules.includes(text)) return;
    onPrefs({ ...prefs, cleanupRules: [...prefs.cleanupRules, text] });
    setRule("");
  }

  useEffect(() => {
    doneRef.current?.focus();
    getVersion().then(setVersion).catch(() => {});
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const [update, setUpdate] = useState<Update | null>(null);
  const [updateState, setUpdateState] = useState<"idle" | "checking" | "none" | "found" | "installing" | "failed">("idle");
  const [updateNote, setUpdateNote] = useState<string | null>(null);

  async function checkForUpdate() {
    setUpdateState("checking");
    setUpdateNote(null);
    try {
      const found = await findUpdate();
      setUpdate(found);
      setUpdateState(found ? "found" : "none");
    } catch (e) {
      setUpdateState("failed");
      setUpdateNote(errorText(e));
    }
  }

  async function install() {
    if (!update) return;
    setUpdateState("installing");
    try {
      await installUpdate(update, (f) => setUpdateNote(f == null ? "Downloading…" : `Downloading… ${Math.round(f * 100)}%`));
    } catch (e) {
      setUpdateState("failed");
      setUpdateNote(errorText(e));
    }
  }

  const [skipPattern, setSkipPattern] = useState("");
  const [fileNote, setFileNote] = useState<string | null>(null);

  function addSkipPattern() {
    const text = skipPattern.trim();
    if (!text || prefs.excludes.includes(text)) return;
    onPrefs({ ...prefs, excludes: [...prefs.excludes, text] });
    setSkipPattern("");
    setExcludesChanged(true);
  }

  async function saveSettingsFile() {
    const path = await pickSaveFile({
      title: "Export settings",
      defaultPath: "Disq Studio settings.json",
      filters: [{ name: "Settings", extensions: ["json"] }],
    });
    if (!path) return;
    try {
      await exportSettings(path);
      setFileNote(`Saved to ${path}.`);
    } catch (e) {
      setFileNote(errorText(e));
    }
  }

  async function loadSettingsFile() {
    const path = await pickFolder({ title: "Import settings", filters: [{ name: "Settings", extensions: ["json"] }], multiple: false });
    if (typeof path !== "string") return;
    try {
      await importSettings(path);
      // Everything reads its settings at start: start again with the imported ones.
      window.location.reload();
    } catch (e) {
      setFileNote(errorText(e));
    }
  }

  async function addExclude() {
    const picked = await pickFolder({ directory: true, title: "Choose a folder Disq Studio should skip" });
    if (typeof picked !== "string") return;
    const key = (p: string) => p.toLowerCase().replace(/[\\/]+$/, "");
    if (prefs.excludes.some((p) => key(p) === key(picked))) return;
    onPrefs({ ...prefs, excludes: [...prefs.excludes, picked] });
    setExcludesChanged(true);
  }

  function removeExclude(path: string) {
    onPrefs({ ...prefs, excludes: prefs.excludes.filter((p) => p !== path) });
    setExcludesChanged(true);
  }

  return (
    <div className="blanket" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-medium settings" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <div className="modal-header">
          <h2 className="modal-title" id="settings-title">
            Settings
          </h2>
          <IconButton icon={X} label="Close" onClick={onClose} />
        </div>

        <div className="modal-body">
          <section className="settings-section" aria-labelledby="set-look">
            <h3 className="eyebrow" id="set-look">
              Appearance
            </h3>
            <div className="settings-row">
              <span className="settings-label">Theme</span>
              <div className="segmented" role="radiogroup" aria-label="Theme">
                {THEMES.map((t) => (
                  <button
                    key={t.value}
                    className={cx("segment", theme === t.value && "is-selected")}
                    role="radio"
                    aria-checked={theme === t.value}
                    onClick={() => onTheme(t.value)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="settings-row">
              <span className="settings-label">Accent colour</span>
              <div className="accent-swatches" role="radiogroup" aria-label="Accent colour">
                {ACCENTS.map((a) => {
                  const on = prefs.accent === a.value;
                  return (
                    <button
                      key={a.value}
                      className={cx("accent-swatch", on && "is-selected")}
                      role="radio"
                      aria-checked={on}
                      aria-label={a.name}
                      data-tooltip={a.name}
                      style={{ ["--swatch" as string]: a.value }}
                      onClick={() => onPrefs({ ...prefs, accent: a.value })}
                    >
                      {on && <Check size={14} aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="settings-section" aria-labelledby="set-sizes">
            <h3 className="eyebrow" id="set-sizes">
              Sizes
            </h3>
            <div className="settings-row">
              <span className="settings-label">
                Measure by
                <span className="settings-hint">
                  Size is how long files are; on disk is the space they really take.
                </span>
              </span>
              <div className="segmented" role="radiogroup" aria-label="Measure sizes by">
                {(["logical", "allocated"] as const).map((m) => (
                  <button
                    key={m}
                    className={cx("segment", sizeMode === m && "is-selected")}
                    role="radio"
                    aria-checked={sizeMode === m}
                    onClick={() => onSizeMode(m)}
                  >
                    {SIZE_MODE_LABEL[m]}
                  </button>
                ))}
              </div>
            </div>
            <div className="settings-row">
              <span className="settings-label">
                Units
                <span className="settings-hint">
                  {prefs.units === "binary"
                    ? "Matches Explorer: a 500 GB drive shows as about 466 GB."
                    : "Matches the box: a 500 GB drive shows as 500 GB."}
                </span>
              </span>
              <div className="segmented" role="radiogroup" aria-label="Units">
                <button
                  className={cx("segment", prefs.units === "binary" && "is-selected")}
                  role="radio"
                  aria-checked={prefs.units === "binary"}
                  onClick={() => onPrefs({ ...prefs, units: "binary" })}
                >
                  Like Windows (1,024)
                </button>
                <button
                  className={cx("segment", prefs.units === "decimal" && "is-selected")}
                  role="radio"
                  aria-checked={prefs.units === "decimal"}
                  onClick={() => onPrefs({ ...prefs, units: "decimal" })}
                >
                  Decimal (1,000)
                </button>
              </div>
            </div>
          </section>

          <section className="settings-section" aria-labelledby="set-scan">
            <h3 className="eyebrow" id="set-scan">
              Folders to skip
            </h3>
            <p className="settings-hint">
              These are never read. They show up as skipped, with no size, in every scan that would include them. Add a
              folder, or a name to skip wherever it is: <code>node_modules</code> skips every folder of that name,{" "}
              <code>*cache*</code> any with "cache" in it, <code>steamapps\shadercache</code> that path ending.
            </p>
            {prefs.excludes.length > 0 ? (
              <ul className="exclude-list">
                {prefs.excludes.map((p) => (
                  <li key={p}>
                    <span className="inspector-path">{p}</span>
                    <IconButton
                      icon={FolderMinus}
                      label={`Stop skipping ${p}`}
                      spacing="compact"
                      onClick={() => removeExclude(p)}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="hud-stat">Nothing is skipped.</p>
            )}
            <div className="actions">
              <Button spacing="compact" iconBefore={FolderPlus} onClick={addExclude}>
                Add folder…
              </Button>
              <label className="filter-search rule-input">
                <input
                  value={skipPattern}
                  placeholder="or a name: node_modules, *cache*…"
                  aria-label="Folder name or pattern to skip everywhere"
                  spellCheck={false}
                  onChange={(e) => setSkipPattern(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addSkipPattern();
                    }
                  }}
                />
              </label>
              <Button spacing="compact" iconBefore={ListPlus} disabled={!skipPattern.trim()} onClick={addSkipPattern}>
                Add
              </Button>
              {excludesChanged && canRescan && (
                <Button spacing="compact" appearance="subtle" onClick={onRescan}>
                  Rescan now to apply
                </Button>
              )}
            </div>
          </section>

          <section className="settings-section" aria-labelledby="set-cleanup">
            <h3 className="eyebrow" id="set-cleanup">
              Cleanup rules
            </h3>
            <p className="settings-hint">
              Your own suggestions for the Cleanup tab, under "Your rules". Write them like a search: a name such as{" "}
              <code>*.bak</code>, or a path such as <code>Renders\scratch</code> (a matching folder is suggested whole).
            </p>
            {prefs.cleanupRules.length > 0 ? (
              <ul className="exclude-list">
                {prefs.cleanupRules.map((r) => (
                  <li key={r}>
                    <span className="inspector-path">{r}</span>
                    <IconButton
                      icon={X}
                      label={`Remove the rule ${r}`}
                      spacing="compact"
                      onClick={() => onPrefs({ ...prefs, cleanupRules: prefs.cleanupRules.filter((x) => x !== r) })}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="hud-stat">No rules of your own yet.</p>
            )}
            <div className="actions">
              <label className="filter-search rule-input">
                <input
                  value={rule}
                  placeholder="*.bak, Renders\scratch…"
                  aria-label="New cleanup rule"
                  spellCheck={false}
                  onChange={(e) => setRule(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addRule();
                    }
                  }}
                />
              </label>
              <Button spacing="compact" iconBefore={ListPlus} disabled={!rule.trim()} onClick={addRule}>
                Add rule
              </Button>
            </div>
          </section>

          <section className="settings-section" aria-labelledby="set-delete">
            <h3 className="eyebrow" id="set-delete">
              Deleting
            </h3>
            <label className="settings-row settings-check">
              <span className="settings-label">
                Offer "Delete permanently"
                <span className="settings-hint">
                  Adds a button to delete confirmations that skips the Recycle Bin. Everything it deletes is gone for
                  good, so it always asks a second time.
                </span>
              </span>
              <input
                type="checkbox"
                checked={prefs.allowPermanentDelete}
                onChange={(e) => onPrefs({ ...prefs, allowPermanentDelete: e.target.checked })}
              />
            </label>
            {prefs.allowPermanentDelete && (
              <p className="settings-hint settings-warning">
                <Trash2 size={13} aria-hidden="true" /> Permanent delete is on.
              </p>
            )}
          </section>

          <section className="settings-section" aria-labelledby="set-history">
            <h3 className="eyebrow" id="set-history">
              History
            </h3>
            <label className="settings-row settings-check">
              <span className="settings-label">
                Keep a snapshot of every scan
                <span className="settings-hint">
                  The newest 8 of each drive or folder, about 30 MB each for a full C: drive. History compares them with
                  the scan in view.
                </span>
              </span>
              <input
                type="checkbox"
                className="accent-check"
                checked={prefs.keepHistory}
                onChange={(e) => onPrefs({ ...prefs, keepHistory: e.target.checked })}
              />
            </label>
          </section>

          <section className="settings-section" aria-labelledby="set-background">
            <h3 className="eyebrow" id="set-background">
              Daily check
            </h3>
            {!bg ? (
              <p className="hud-stat">{bgError ?? "Reading…"}</p>
            ) : (
              <>
                <label className="settings-row settings-check">
                  <span className="settings-label">
                    Check my drives once a day
                    <span className="settings-hint">
                      Runs without opening a window, through Windows' Task Scheduler, and sends a notification when a
                      drive is getting full. A check missed while the PC was off runs at the next sign-in.
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    className="accent-check"
                    checked={bg.enabled}
                    disabled={bgBusy}
                    onChange={(e) => updateBg({ ...bg, enabled: e.target.checked })}
                  />
                </label>
                <div className="settings-row">
                  <span className="settings-label">At</span>
                  <select
                    className="filter-select"
                    aria-label="Time of the daily check"
                    value={bg.hour}
                    disabled={bgBusy}
                    onChange={(e) => updateBg({ ...bg, hour: Number(e.target.value) })}
                  >
                    {Array.from({ length: 24 }, (_, h) => (
                      <option key={h} value={h}>
                        {String(h).padStart(2, "0")}:00
                      </option>
                    ))}
                  </select>
                </div>
                <div className="settings-row">
                  <span className="settings-label">Warn when a drive has less free than</span>
                  <select
                    className="filter-select"
                    aria-label="Warn when a drive has less free than"
                    value={bg.minFreePercent}
                    disabled={bgBusy}
                    onChange={(e) => updateBg({ ...bg, minFreePercent: Number(e.target.value) })}
                  >
                    {[5, 10, 15, 20, 25].map((p) => (
                      <option key={p} value={p}>
                        {p}% of its size
                      </option>
                    ))}
                  </select>
                </div>
                <div className="settings-row settings-row-top">
                  <span className="settings-label">
                    Also scan and keep history of
                    <span className="settings-hint">
                      Takes a snapshot each day, and says when a drive grew {bg.growAlertGb} GB or more since the last one.
                    </span>
                  </span>
                  <div className="settings-drives">
                    {(volumes ?? [])
                      .filter((v) => v.kind === "fixed")
                      .map((v) => {
                        const on = bg.snapshotRoots.some((r) => r.toLowerCase() === v.path.toLowerCase());
                        return (
                          <label key={v.path} className="settings-drive">
                            <input
                              type="checkbox"
                              className="accent-check"
                              checked={on}
                              disabled={bgBusy}
                              onChange={() =>
                                updateBg({
                                  ...bg,
                                  snapshotRoots: on
                                    ? bg.snapshotRoots.filter((r) => r.toLowerCase() !== v.path.toLowerCase())
                                    : [...bg.snapshotRoots, v.path],
                                })
                              }
                            />
                            {v.label ? `${v.label} (${v.path.replace(/\\$/, "")})` : v.path}
                          </label>
                        );
                      })}
                  </div>
                </div>
                <div className="actions">
                  <Button spacing="compact" iconBefore={BellRing} loading={bgBusy} onClick={checkNow}>
                    Check now
                  </Button>
                  <span className="hud-stat">
                    {bg.enabled ? (scheduled ? "Scheduled in Task Scheduler." : "Not scheduled yet.") : "Off."}
                  </span>
                </div>
                {findings && (
                  <p className="settings-hint">
                    {findings.length === 0
                      ? "Nothing to report: every drive has room to spare."
                      : findings.map((f) => `${f.title}. ${f.body}`).join(" ")}
                  </p>
                )}
                {bgError && <p className="settings-hint settings-warning">{bgError}</p>}
              </>
            )}
          </section>

          <section className="settings-section" aria-labelledby="set-file">
            <h3 className="eyebrow" id="set-file">
              Settings file
            </h3>
            <p className="settings-hint">
              Everything set here, saved searches and list columns, in one file: to keep a copy, or to set up another PC
              the same way.
            </p>
            <div className="actions">
              <Button spacing="compact" iconBefore={FileDown} onClick={saveSettingsFile}>
                Export…
              </Button>
              <Button spacing="compact" iconBefore={FileUp} onClick={loadSettingsFile}>
                Import…
              </Button>
            </div>
            {fileNote && <p className="settings-hint">{fileNote}</p>}
          </section>

          <section className="settings-section" aria-labelledby="set-admin">
            <h3 className="eyebrow" id="set-admin">
              Administrator
            </h3>
            <div className="settings-row">
              <span className="settings-label">
                {elevated ? "Running as administrator" : "Running normally"}
                <span className="settings-hint">
                  {elevated
                    ? "Every folder can be read, and whole NTFS drives are read from their file table in a few seconds."
                    : "As administrator, Disq Studio can read folders your account can't, and reads whole NTFS drives from their file table in a few seconds."}
                </span>
              </span>
              {!elevated && (
                <Button spacing="compact" iconBefore={ShieldCheck} onClick={onRelaunchAsAdmin}>
                  Restart as administrator
                </Button>
              )}
            </div>
          </section>

          <section className="settings-section" aria-labelledby="set-updates">
            <h3 className="eyebrow" id="set-updates">
              Updates
            </h3>
            <div className="settings-row">
              <span className="settings-label">
                {updateState === "found" && update
                  ? `Disq Studio ${update.version} is available`
                  : updateState === "none"
                    ? "Disq Studio is up to date"
                    : updateState === "installing"
                      ? "Installing the update…"
                      : "Checks for a new version once a day"}
                <span className="settings-hint">
                  {updateState === "found"
                    ? "It installs on its own and Disq Studio starts again, where you were."
                    : updateNote ?? "New versions come from the project's releases on GitHub, signed so only real ones install."}
                </span>
              </span>
              {updateState === "found" ? (
                <Button spacing="compact" appearance="primary" iconBefore={CloudDownload} onClick={install}>
                  Install and restart
                </Button>
              ) : (
                <Button
                  spacing="compact"
                  iconBefore={RefreshCw}
                  loading={updateState === "checking" || updateState === "installing"}
                  onClick={checkForUpdate}
                >
                  Check now
                </Button>
              )}
            </div>
            {updateState === "installing" && updateNote && <p className="settings-hint">{updateNote}</p>}
          </section>

          <section className="settings-section" aria-labelledby="set-about">
            <h3 className="eyebrow" id="set-about">
              About
            </h3>
            <p className="dialog-text">
              Disq Studio{version ? ` ${version}` : ""}. Everything stays on this PC: Disq Studio doesn't send your files, folder
              names or usage anywhere.
            </p>
          </section>
        </div>

        <div className="modal-footer">
          <Button ref={doneRef} appearance="primary" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
