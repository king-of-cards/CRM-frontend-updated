// One way to show dates everywhere: "19 Nov 2026" and "19 Nov 2026, 10:30 am" (India time).
// Built by hand (not toLocaleString) so every browser shows the same text ("Sep", never "Sept",
// no commas or dashes that vary by locale data). Pure, no React.

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const IST_OFFSET_MS = 330 * 60 * 1000;
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
// A date-time: has a time part (ISO "T" or a space before hh:mm)
const DATE_TIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/;

// The parts of a moment in India time
function istParts(date) {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  return {
    y: ist.getUTCFullYear(),
    m: ist.getUTCMonth(),
    d: ist.getUTCDate(),
    h: ist.getUTCHours(),
    min: ist.getUTCMinutes(),
  };
}

function toDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const text = String(value);
  // A date-time without a zone is India time (as the API reads it)
  const zoned = DATE_TIME.test(text) && !/(Z|[+-]\d{2}:?\d{2})$/.test(text) ? `${text.replace(" ", "T")}+05:30` : text;
  const d = new Date(zoned);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * "2026-11-19" or an ISO date-time -> "19 Nov 2026" (date-times in India time).
 * Empty -> fallback (""), text that isn't a date (e.g. "April 2027") -> as written.
 */
export function formatDay(value, fallback = "") {
  if (value === null || value === undefined || value === "") return fallback;
  const text = value instanceof Date ? "" : String(value).trim();
  const only = DATE_ONLY.exec(text);
  if (only) {
    const month = Number(only[2]);
    if (month >= 1 && month <= 12) return `${Number(only[3])} ${MONTHS[month - 1]} ${only[1]}`;
    return text;
  }
  if (!(value instanceof Date) && !DATE_TIME.test(text)) return text;
  const d = toDate(value);
  if (!d) return text;
  const p = istParts(d);
  return `${p.d} ${MONTHS[p.m]} ${p.y}`;
}

/** ISO date-time -> "19 Nov 2026, 10:30 am" (India time). A plain date -> "19 Nov 2026". */
export function formatDateTime(value, fallback = "") {
  if (value === null || value === undefined || value === "") return fallback;
  const text = value instanceof Date ? "" : String(value).trim();
  if (DATE_ONLY.test(text)) return formatDay(text, fallback);
  if (!(value instanceof Date) && !DATE_TIME.test(text)) return text;
  const d = toDate(value);
  if (!d) return text;
  const p = istParts(d);
  const hour = p.h % 12 === 0 ? 12 : p.h % 12;
  const time = `${String(hour).padStart(2, "0")}:${String(p.min).padStart(2, "0")} ${p.h < 12 ? "am" : "pm"}`;
  return `${p.d} ${MONTHS[p.m]} ${p.y}, ${time}`;
}

// The name of who added or updated something, as the API sends it ("Deleted user" included).
// Only when there is no name at all does a screen show its own fallback ("—").
export function personName(name, fallback = "—") {
  return typeof name === "string" && name.trim() ? name.trim() : fallback;
}
