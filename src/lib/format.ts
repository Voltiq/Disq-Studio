const BINARY_UNITS = ["bytes", "KB", "MB", "GB", "TB", "PB"];
const DECIMAL_UNITS = ["bytes", "kB", "MB", "GB", "TB", "PB"];

// Set from Settings. Windows counts 1 KB as 1,024 bytes; drive makers count 1,000.
let base = 1024;

export function setDecimalUnits(decimal: boolean) {
  base = decimal ? 1000 : 1024;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 bytes";
  if (bytes < base) return bytes === 1 ? "1 byte" : `${bytes} bytes`;
  const UNITS = base === 1000 ? DECIMAL_UNITS : BINARY_UNITS;
  const i = Math.min(UNITS.length - 1, Math.floor(Math.log(bytes) / Math.log(base)));
  const value = bytes / base ** i;
  const digits = value < 10 ? 2 : value < 100 ? 1 : 0;
  return `${value.toFixed(digits)} ${UNITS[i]}`;
}

export function formatCount(n: number): string {
  return n.toLocaleString();
}

export function plural(n: number, one: string, many: string): string {
  return `${n.toLocaleString()} ${n === 1 ? one : many}`;
}

export function formatShare(part: number, whole: number): string {
  if (whole <= 0) return "";
  const pct = (part / whole) * 100;
  if (pct > 0 && pct < 0.1) return "<0.1%";
  return `${pct.toFixed(pct < 10 ? 1 : 0)}%`;
}

export function formatElapsed(ms: number): string {
  const s = ms / 1000;
  if (s < 10) return `${s.toFixed(1)} s`;
  if (s < 60) return `${Math.round(s)} s`;
  const m = Math.floor(s / 60);
  return `${m} min ${Math.round(s % 60)} s`;
}

const dateFmt = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" });

export function formatDate(ms: number): string {
  if (!ms) return "—";
  return dateFmt.format(new Date(ms));
}

const shortDateFmt = new Intl.DateTimeFormat(undefined, { day: "2-digit", month: "2-digit", year: "numeric" });

/** All digits, for a narrow column. */
export function formatShortDate(ms: number): string {
  if (!ms) return "—";
  return shortDateFmt.format(new Date(ms));
}

const dateTimeFmt = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDateTime(ms: number): string {
  if (!ms) return "—";
  return dateTimeFmt.format(new Date(ms));
}

/** A change in bytes with its sign: "+1.20 GB", "−300 MB", "no change". */
export function formatChange(bytes: number): string {
  if (bytes === 0) return "no change";
  return `${bytes > 0 ? "+" : "−"}${formatBytes(Math.abs(bytes))}`;
}
