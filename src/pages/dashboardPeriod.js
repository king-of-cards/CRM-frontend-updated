// The Dashboard's date filter (docs/API_REFERENCE.md, "9. Dashboard: date filter").
// Pure helpers, no React. Dates are "YYYY-MM-DD" India calendar days, as the API expects.
// A period is { from, to } or { all: true } (All time: ?period=all on the Dashboard; for the
// lead lists, no date at all).

export const PRESETS = [
  { value: "7", label: "Last 7 days", days: 7 },
  { value: "15", label: "Last 15 days", days: 15 },
  { value: "30", label: "Last 30 days", days: 30 },
];
export const MODES = [
  { value: "all", label: "All time" },
  ...PRESETS,
  { value: "single", label: "Single date" },
  { value: "range", label: "Date range" },
];
export const DEFAULT_PRESET = "30";
export const MAX_DAYS = 366; // the API's limit, both ends counted ("max range 1 year")

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Today in India (so a browser in another time zone never asks for a "future" day)
export function todayIst(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(now);
}

const toUtc = (iso) => new Date(`${iso}T00:00:00Z`);

export function addDays(iso, n) {
  const d = toUtc(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Days in [from, to], both ends counted
export const daysInclusive = (from, to) => Math.round((toUtc(to) - toUtc(from)) / 86400000) + 1;

export function presetPeriod(value, today) {
  const p = PRESETS.find((x) => x.value === value) ?? PRESETS.find((x) => x.value === DEFAULT_PRESET);
  return { from: addDays(today, -(p.days - 1)), to: today };
}

// ?period=all -> All time; ?from=&to= -> { from, to } (only one: that single day);
// nothing: All time (the Dashboard default). Values are passed on as written; the API
// rejects bad ones (400).
export function periodFromSearch(params, today) {
  if (params.get("period") === "all") return { all: true };
  const from = params.get("from") || "";
  const to = params.get("to") || "";
  if (!from && !to) return { all: true };
  return { from: from || to, to: to || from };
}

// What the dropdown shows: a preset ending today, else "single" (from = to) or "range"
export function modeOf({ all, from, to }, today) {
  if (all) return "all";
  if (to === today) {
    const p = PRESETS.find((x) => presetPeriod(x.value, today).from === from);
    if (p) return p.value;
  }
  return from === to ? "single" : "range";
}

// A reason the period can't be sent, or null (the same rules as the API)
export function periodError({ all, from, to }, today) {
  if (all) return null;
  if (!ISO_DATE.test(from) || !ISO_DATE.test(to) || Number.isNaN(toUtc(from).getTime()) || Number.isNaN(toUtc(to).getTime()))
    return "Pick a valid date.";
  if (from > today || to > today) return "Dates can't be in the future.";
  if (from > to) return "The start date must be on or before the end date.";
  if (daysInclusive(from, to) > MAX_DAYS) return "The period can be at most 1 year.";
  return null;
}

function parts(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m: MONTHS[m - 1], d };
}

// "16 Nov 2026" · "18 Oct – 16 Nov 2026" · "2 – 8 Nov 2026" · "18 Dec 2025 – 16 Jan 2026"
export function periodLabel(from, to) {
  if (!from || !to) return "";
  const a = parts(from);
  const b = parts(to);
  if (from === to) return `${b.d} ${b.m} ${b.y}`;
  if (a.y !== b.y) return `${a.d} ${a.m} ${a.y} – ${b.d} ${b.m} ${b.y}`;
  if (a.m !== b.m) return `${a.d} ${a.m} – ${b.d} ${b.m} ${b.y}`;
  return `${a.d} – ${b.d} ${b.m} ${b.y}`;
}

// "All time", or the dates as in periodLabel
export const periodText = (period) => (period.all ? "All time" : periodLabel(period.from, period.to));
