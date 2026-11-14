const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

// 482500 -> "₹4,82,500"
export function formatINR(amount) {
  return inr.format(amount);
}

// "Aarav Mehta" -> "AM"
export function initials(name) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const dateTime = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

// new Date() -> "11 Nov, 3:42 pm"
export function formatDateTime(date) {
  return dateTime.format(date);
}

const dayFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });
const timeFormat = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" });
const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// "Today", "Yesterday" or "10 Nov 2026"
export function formatDay(date) {
  const days = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return dayFormat.format(date);
}

// "1 Oct 2026"
export function formatDate(date) {
  return dayFormat.format(date);
}

// "10:02 am"
export function formatTime(date) {
  return timeFormat.format(date);
}

// "just now", "5 minutes ago", "3 days ago"
export function timeAgo(date) {
  const seconds = Math.round((date - Date.now()) / 1000);
  if (Math.abs(seconds) < 45) return "just now";
  const units = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return "just now";
}