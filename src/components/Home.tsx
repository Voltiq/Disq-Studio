import { Disc, FolderPlus, HardDrive, History, MemoryStick, Network, RefreshCw, Usb, type LucideIcon } from "lucide-react";
import { formatBytes } from "../lib/format";
import type { Volume } from "../lib/types";
import { Button } from "./ui/Button";
import { ProgressBar, Spinner } from "./ui/Feedback";
import { t } from "../lib/i18n";
import { tx } from "../lib/tx";

const DRIVE_ICON: Record<Volume["kind"], LucideIcon> = {
  fixed: HardDrive,
  removable: Usb,
  network: Network,
  optical: Disc,
  ram: MemoryStick,
};

const KIND: Record<Volume["kind"], string> = {
  fixed: t("fixed"),
  removable: t("removable"),
  network: t("network"),
  optical: t("optical"),
  ram: t("RAM disk"),
};

interface HomeProps {
  volumes: Volume[] | null;
  onScan: (path: string) => void;
  onPickFolder: () => void;
  onRefresh: () => void;
  /** Earlier scans: open or compare snapshots. */
  onHistory: () => void;
}

export function Home({ volumes, onScan, onPickFolder, onRefresh, onHistory }: HomeProps) {
  return (
    <main className="home">
      <div className="home-inner">
        <div className="hero">
          <div className="hero-text">
            <span className="eyebrow">{t("Disq Studio")}</span>
            <h1>{t("See what's filling your drive.")}</h1>
            <p>
              {t("Pick a drive or folder. Disq Studio reads it on every core, then draws each file as a block sized by the space it takes, so the biggest things are impossible to miss.")}
            </p>
          </div>
          <div className="actions">
            <Button iconBefore={History} appearance="subtle" onClick={onHistory}>
              {t("History")}
            </Button>
            <Button iconBefore={RefreshCw} appearance="subtle" onClick={onRefresh}>
              {t("Refresh drives")}
            </Button>
          </div>
        </div>

        <div className="drive-grid">
          {!volumes && <Spinner size={20} label={t("Looking for drives")} />}
          {volumes?.map((v) => {
            const used = v.total - v.free;
            const share = v.total > 0 ? used / v.total : 0;
            const Icon = DRIVE_ICON[v.kind];
            const label = v.label || (v.kind === "fixed" ? t("Local Disk") : t("Drive"));
            return (
              <button key={v.path} className="drive-card" onClick={() => onScan(v.path)}>
                <div className="drive-top">
                  <span className="icon-tile icon-tile-large" aria-hidden="true">
                    <Icon />
                  </span>
                  <span className="drive-title">
                    <span className="drive-name">
                      {label} ({v.path.replace(/\\$/, "")})
                    </span>
                    <span className="drive-sub">
                      {v.fileSystem || t("Unknown")} · {KIND[v.kind]}
                    </span>
                  </span>
                </div>
                <ProgressBar
                  value={share}
                  appearance={share > 0.9 ? "danger" : "default"}
                  label={t("{0}% used", Math.round(share * 100))}
                />
                <span className="drive-usage">
                  <span>{tx("{0} used", <b>{formatBytes(used)}</b>)}</span>
                  <span>
                    {tx("{0} free of {1}", <b>{formatBytes(v.free)}</b>, formatBytes(v.total))}
                  </span>
                </span>
              </button>
            );
          })}
          <button className="drive-card is-folder" onClick={onPickFolder}>
            <FolderPlus size={22} aria-hidden="true" />
            <span className="drive-name">{t("Choose a folder…")}</span>
            <span className="drive-sub">{t("Scan just one folder and what's inside it")}</span>
          </button>
        </div>
      </div>
    </main>
  );
}
